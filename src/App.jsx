import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import { Check, X, HelpCircle, RefreshCcw, Cpu, AlertTriangle } from 'lucide-react';
import './App.css';

const getApiBase = () => {
  const envBase = import.meta.env.VITE_API_BASE;
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    if (!envBase || envBase.includes('localhost') || envBase.includes('127.0.0.1')) {
      return 'https://nest-news-bot-1.onrender.com/api';
    }
  }
  return envBase || 'https://nest-news-bot-1.onrender.com/api';
};

const API_BASE = getApiBase();

const App = () => {
  const [messages, setMessages] = useState([]);
  const [activeTab, setActiveTab] = useState('new');
  const [loading, setLoading] = useState(true);
  const [isWaking, setIsWaking] = useState(false);
  const [botStatus, setBotStatus] = useState({ online: false, name: 'NestNews Bot', avatar: null });

  const [apiCheckStatus, setApiCheckStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'
  const [apiRemaining, setApiRemaining] = useState(null);
  const [apiError, setApiError] = useState('');
  const [customApiKey, setCustomApiKey] = useState('');

  const handleTestApi = async () => {
    setApiCheckStatus('loading');
    setApiError('');
    try {
      const url = customApiKey
        ? `${API_BASE}/test-limit?key=${encodeURIComponent(customApiKey)}`
        : `${API_BASE}/test-limit`;
      const response = await fetch(url);
      const data = await response.json();
      if (response.ok && data.success) {
        setApiRemaining(data.remaining);
        setApiCheckStatus('success');
      } else {
        setApiError(data.error || 'Neznámá chyba při testování API.');
        setApiCheckStatus('error');
      }
    } catch (error) {
      setApiError('Nepodařilo se připojit k API serveru.');
      setApiCheckStatus('error');
    }
  };

  // Motion values for swipe feedback
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-30, 30]);
  const opacityLeft = useTransform(x, [-150, -50], [1, 0]);
  const opacityRight = useTransform(x, [50, 150], [0, 1]);
  const opacityUp = useTransform(y, [-150, -50], [1, 0]);

  const fetchBotStatus = async () => {
    try {
      const response = await fetch(`${API_BASE}/status`);
      const data = await response.json();
      setBotStatus(data);
    } catch (error) {
      setBotStatus(prev => ({ ...prev, online: false }));
    }
  };

  const fetchMessages = async (tab) => {
    setLoading(true);
    try {
      const endpoint = tab === 'new' ? '/messages' : '/questions';
      const response = await fetch(`${API_BASE}${endpoint}`);
      const data = await response.json();
      
      if (Array.isArray(data)) {
        setMessages(data);
      } else {
        console.error('Server returned non-array:', data);
        setMessages([]);
      }
    } catch (error) {
      console.error('Error fetching:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWakeUp = async () => {
    setIsWaking(true);
    try {
      // Ping the Render bot to wake it up
      await fetch('https://nest-news-bot-1.onrender.com', { mode: 'no-cors' });
      await new Promise(resolve => setTimeout(resolve, 2000)); // Slightly longer delay for wakeup
      await fetchBotStatus();
      await fetchMessages(activeTab);
    } catch (error) {
      console.error('Wake up failed:', error);
    } finally {
      setIsWaking(false);
    }
  };

  useEffect(() => {
    fetchBotStatus();
    fetchMessages(activeTab);
    
    // Poll status every 30s
    const interval = setInterval(fetchBotStatus, 30000);
    return () => clearInterval(interval);
  }, [activeTab]);

  const handleSwipe = async (messageId, direction) => {
    console.log('👆 Swipe Detected:', { messageId, direction });
    let action = '';
    if (direction === 'left') action = 'approve';
    if (direction === 'right') action = 'delete';
    if (direction === 'up') action = 'question';

    try {
      console.log(`📡 Sending action ${action} for ${messageId}...`);
      const res = await fetch(`${API_BASE}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, action }),
      });
      const data = await res.json();
      console.log('✅ Action Response:', data);
      setMessages(prev => prev.filter(m => m.id !== messageId));
    } catch (error) {
      console.error('❌ Action failed:', error);
    }
  };

  const triggerAction = async (direction) => {
    if (messages.length === 0 || loading) return;
    const activeMsgId = messages[messages.length - 1].id;
    
    // Animate out dynamically based on direction
    if (direction === 'left') {
      await animate(x, -500, { duration: 0.3 });
    } else if (direction === 'right') {
      await animate(x, 500, { duration: 0.3 });
    } else if (direction === 'up') {
      await animate(y, -500, { duration: 0.3 });
    }
    
    await handleSwipe(activeMsgId, direction);
    x.set(0);
    y.set(0);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Disallow keypress if waking/loading to prevent overlap
      if (loading) return;
      if (e.key === 'ArrowLeft') triggerAction('left');
      if (e.key === 'ArrowRight') triggerAction('right');
      if (e.key === 'ArrowUp') triggerAction('up');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [messages, loading, x, y]);

  return (
    <div className="app-container">
      <header>
        <div className="header-top">
          <div className="title-group" style={{ width: '100%' }}>
            <div className={`bot-status ${botStatus.online ? 'online' : 'offline'}`} style={{ marginBottom: '0.8rem' }}>
              <span className="status-dot"></span>
              {botStatus.name} {botStatus.online ? 'ONLINE' : 'OFFLINE'}
            </div>
            <div className="api-test-container">
              <input 
                type="text" 
                className="api-test-input"
                placeholder="Vložte Gemini API klíč (volitelné)..."
                value={customApiKey}
                onChange={(e) => setCustomApiKey(e.target.value)}
                disabled={apiCheckStatus === 'loading'}
              />
              <button 
                className={`api-test-btn ${apiCheckStatus === 'loading' ? 'loading' : ''}`}
                onClick={handleTestApi}
                disabled={apiCheckStatus === 'loading'}
              >
                <Cpu size={16} className={apiCheckStatus === 'loading' ? 'spinning' : ''} />
                <span>Otestovat API</span>
              </button>
            </div>
            <div className={`api-test-status ${apiCheckStatus}`} style={{ marginTop: '0.6rem', paddingLeft: '0.2rem' }}>
              {apiCheckStatus === 'idle' && <span>Klepnutím otestujete limit API</span>}
              {apiCheckStatus === 'loading' && <span>Testuji...</span>}
              {apiCheckStatus === 'success' && (
                apiRemaining === 'Bez omezení' ? (
                  <span>API aktivní • <strong>Bez omezení</strong> (Placený tarif)</span>
                ) : (
                  <span>Aplikace zvládne ještě <strong>{apiRemaining}</strong> článků</span>
                )
              )}
              {apiCheckStatus === 'error' && (
                <span className="error-text" title={apiError}>
                  <AlertTriangle size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                  Chyba API • 0 článků
                </span>
              )}
            </div>
          </div>
        </div>        
        <div className="tabs">
          <button 
            className={`tab-btn ${activeTab === 'new' ? 'active' : ''}`}
            onClick={() => setActiveTab('new')}
          >
            Nové
          </button>
          <button 
            className={`tab-btn ${activeTab === 'questions' ? 'active' : ''}`}
            onClick={() => setActiveTab('questions')}
          >
            Otazníky
          </button>
        </div>
      </header>

      <main className="card-container">
        {loading ? (
          <div className="empty-state">
            <RefreshCcw className="animate-spin" size={48} />
            <p>Načítám zprávy...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="empty-state">
            <Check size={64} style={{ color: 'var(--success)', marginBottom: '1rem' }} />
            <p>Vše čisté! Žádné zprávy k vyřízení.</p>
            <button 
              className="tab-btn" 
              style={{ marginTop: '1rem' }}
              onClick={() => fetchMessages(activeTab)}
            >
              Obnovit
            </button>
          </div>
        ) : (
          <AnimatePresence>
            {messages.map((msg, index) => (
              index === messages.length - 1 && (
                <motion.div
                  key={msg.id}
                  className="swipe-card"
                  drag
                  dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                  style={{ x, y, rotate }}
                  onDragEnd={(e, info) => {
                    if (info.offset.x < -100) handleSwipe(msg.id, 'left');
                    else if (info.offset.x > 100) handleSwipe(msg.id, 'right');
                    else if (info.offset.y < -100) handleSwipe(msg.id, 'up');
                  }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ 
                    x: x.get() < -100 ? -500 : x.get() > 100 ? 500 : 0,
                    y: y.get() < -100 ? -800 : 0,
                    opacity: 0,
                    scale: 0.5,
                    transition: { duration: 0.2 }
                  }}
                >
                  {/* Indicators */}
                  <motion.div className="indicator approve" style={{ opacity: opacityLeft }}>✅ OK</motion.div>
                  <motion.div className="indicator delete" style={{ opacity: opacityRight }}>❌ SMAZAT</motion.div>
                  <motion.div className="indicator question" style={{ opacity: opacityUp }}>❓ OTAZNÍK</motion.div>

                  {/* Visual Glow Overlays */}
                  <motion.div 
                    className="glow-overlay" 
                    style={{ background: 'radial-gradient(circle, var(--success), transparent)', opacity: opacityLeft }}
                  />
                  <motion.div 
                    className="glow-overlay" 
                    style={{ background: 'radial-gradient(circle, var(--danger), transparent)', opacity: opacityRight }}
                  />
                  <motion.div 
                    className="glow-overlay" 
                    style={{ background: 'radial-gradient(circle, var(--warning), transparent)', opacity: opacityUp }}
                  />

                  {/* Card Content */}
                  {msg.image && (
                    <img 
                      src={msg.image} 
                      alt="News" 
                      className="card-image" 
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  )}
                  <div className="card-content">
                    <div className="card-author">@ {msg.author}</div>
                    <div className="card-title">
                      {msg.title || msg.embeds?.[0]?.title || (msg.content?.length > 0 ? (msg.content.substring(0, 50) + (msg.content.length > 50 ? '...' : '')) : 'Bez názvu')}
                    </div>
                    <div className="card-text">
                      {msg.embeds?.[0]?.description || msg.content || 'Žádný text k dispozici.'}
                    </div>
                    {(msg.embeds?.[0]?.url || msg.url) && (
                      <a 
                        href={msg.embeds?.[0]?.url || msg.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="card-link"
                        style={{ marginTop: '1rem', display: 'block', fontSize: '0.8rem', color: 'var(--primary)', textDecoration: 'none' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        🔗 Otevřít odkaz
                      </a>
                    )}
                  </div>
                </motion.div>
              )
            ))}
          </AnimatePresence>
        )}

        {messages.length > 0 && !loading && (
          <div className="controls">
            <button className="control-btn approve-btn" onClick={() => triggerAction('left')} title="Schválit (Šipka vlevo)">
              <Check size={32} />
            </button>
            <button className="control-btn question-btn" onClick={() => triggerAction('up')} title="Otazník (Šipka nahoru)">
              <HelpCircle size={32} />
            </button>
            <button className="control-btn delete-btn" onClick={() => triggerAction('right')} title="Smazat (Šipka vpravo)">
              <X size={32} />
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
