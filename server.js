import express from 'express';
import cors from 'cors';
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import 'dotenv/config';

const app = express();
app.use(cors());
app.use(express.json());

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

const GUILD_ID = process.env.GUILD_ID;
const CHANNEL_ID = process.env.CHANNEL_ID;

client.once('ready', () => {
  console.log(`🤖 Discord Backend is online as ${client.user.tag}`);
});

// Helper to get news channel
async function getNewsChannel() {
  console.log(`📡 Pokouším se připojit: Guild=${GUILD_ID}, Channel=${CHANNEL_ID}`);
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    if (!guild) throw new Error('Guild nenalezena');
    
    const channel = await guild.channels.fetch(CHANNEL_ID);
    if (!channel) throw new Error('Kanál nenalezen');
    
    console.log(`✅ Připojeno k # ${channel.name}`);
    return channel;
  } catch (error) {
    console.error('❌ Chyba v getNewsChannel:', error.message);
    return null;
  }
}

// Fetch messages for the "New" tab (no computer, no question)
app.get('/api/messages', async (req, res) => {
  const channel = await getNewsChannel();
  if (!channel) return res.status(500).json({ error: 'Channel not found' });

  try {
    const messages = await channel.messages.fetch({ limit: 50 });
    const filtered = messages.filter(msg => {
      const hasComputer = msg.reactions.cache.has('💻');
      const hasQuestion = msg.reactions.cache.has('❓');
      return !hasComputer && !hasQuestion;
    }).map(msg => {
      // console.log('📦 Discord Message:', JSON.stringify(msg, null, 2));
      const urlMatches = msg.content?.match(/https?:\/\/[^\s]+/);
      const firstUrl = urlMatches ? urlMatches[0] : null;
      
      // Extract from specialized components (like Threads/Instagram previews)
      let componentTitle = '';
      let componentImage = '';
      let componentUrl = '';

      if (msg.components?.[0]?.components) {
        msg.components[0].components.forEach(c => {
          if (c.type === 10) componentTitle = c.content?.replace(/\*\*/g, ''); 
          if (c.type === 12 && c.items?.[0]?.media) {
            componentImage = c.items[0].media.proxy_url || c.items[0].media.url;
          }
          if (c.type === 1 && c.components?.[0]?.url) componentUrl = c.components[0].url;
        });
      }

      const attachments = msg.attachments.map(a => a.proxyURL || a.url);
      const finalImage = componentImage || msg.embeds?.[0]?.image?.proxyURL || msg.embeds?.[0]?.image?.url || attachments[0] || '';

      return {
        id: msg.id,
        content: msg.content || '',
        author: msg.author.username,
        timestamp: msg.createdAt,
        url: componentUrl || firstUrl,
        title: componentTitle,
        image: finalImage,
        embeds: msg.embeds.map(e => ({
          title: e.title,
          description: e.description,
          url: e.url,
          image: e.image?.proxyURL || e.image?.url || e.thumbnail?.proxyURL || e.thumbnail?.url
        })),
        attachments
      };
    });

    const sorted = Array.from(filtered.values()).sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    res.json(sorted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fetch messages for the "Questions" tab (has question, no computer)
app.get('/api/questions', async (req, res) => {
  const channel = await getNewsChannel();
  if (!channel) return res.status(500).json({ error: 'Channel not found' });

  try {
    const messages = await channel.messages.fetch({ limit: 50 });
    const filtered = messages.filter(msg => {
      const hasComputer = msg.reactions.cache.has('💻');
      const hasQuestion = msg.reactions.cache.has('❓');
      return hasQuestion && !hasComputer;
    }).map(msg => {
      const urlMatches = msg.content?.match(/https?:\/\/[^\s]+/);
      const firstUrl = urlMatches ? urlMatches[0] : null;

      // Extract from specialized components
      let componentTitle = '';
      let componentImage = '';
      let componentUrl = '';

      if (msg.components?.[0]?.components) {
        msg.components[0].components.forEach(c => {
          if (c.type === 10) componentTitle = c.content?.replace(/\*\*/g, ''); 
          if (c.type === 12 && c.items?.[0]?.media) {
            componentImage = c.items[0].media.proxy_url || c.items[0].media.url;
          }
          if (c.type === 1 && c.components?.[0]?.url) componentUrl = c.components[0].url;
        });
      }

      const attachments = msg.attachments.map(a => a.proxyURL || a.url);
      const finalImage = componentImage || msg.embeds?.[0]?.image?.proxyURL || msg.embeds?.[0]?.image?.url || attachments[0] || '';

      return {
        id: msg.id,
        content: msg.content || '',
        author: msg.author.username,
        timestamp: msg.createdAt,
        url: componentUrl || firstUrl,
        title: componentTitle,
        image: finalImage,
        embeds: msg.embeds.map(e => ({
          title: e.title,
          description: e.description,
          url: e.url,
          image: e.image?.proxyURL || e.image?.url || e.thumbnail?.proxyURL || e.thumbnail?.url
        })),
        attachments
      };
    });

    const sorted = Array.from(filtered.values()).sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    res.json(sorted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Action endpoint
app.post('/api/action', async (req, res) => {
  const { messageId, action } = req.body;
  console.log(`📩 Received Action: ${action} for Message: ${messageId}`);
  const channel = await getNewsChannel();
  if (!channel) return res.status(500).json({ error: 'Channel not found' });

  try {
    console.log(`🔍 Fetching message ${messageId}...`);
    const message = await channel.messages.fetch(messageId);
    
    if (action === 'approve') {
      console.log(`✅ Approving with 💻...`);
      await message.react('💻');
      res.json({ success: true, message: 'Approved with 💻' });
    } else if (action === 'delete') {
      console.log(`🗑️ Deleting message from Discord...`);
      await message.delete();
      res.json({ success: true, message: 'Deleted from Discord' });
    } else if (action === 'question') {
      console.log(`❓ Flagging with ❓...`);
      await message.react('❓');
      res.json({ success: true, message: 'Flagged with ❓' });
    } else {
      console.log(`⚠️ Invalid action: ${action}`);
      res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('❌ Action Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Status endpoint
app.get('/api/status', (req, res) => {
  res.json({
    online: client.isReady(),
    name: client.user?.username || 'NestNews Bot',
    tag: client.user?.tag || 'NestNews Bot#0000',
    avatar: client.user?.displayAvatarURL() || null
  });
});

// Endpoint to test Gemini API key and calculate remaining articles
app.get('/api/test-limit', async (req, res) => {
  const apiKey = req.query.key || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ success: false, error: 'Chybí GEMINI_API_KEY v konfiguraci.' });
  }

  try {
    // 1. Test Gemini API by trying multiple models in sequence
    const modelsToTest = ['gemini-2.5-flash-lite', 'gemini-flash-latest', 'gemini-2.0-flash'];
    let testResponse;
    let lastError = null;
    let serviceTier = 'free';
    let isExhausted = false;
    let isUnavailable = false;
    let isInvalidKey = false;

    for (const model of modelsToTest) {
      try {
        console.log(`🧪 Testing model ${model} with API key...`);
        const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        testResponse = await fetch(testUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Test connection' }] }]
          })
        });

        const tierHeader = testResponse.headers.get('x-gemini-service-tier');
        if (tierHeader) serviceTier = tierHeader;

        if (testResponse.ok) {
          lastError = null;
          isExhausted = false;
          isUnavailable = false;
          console.log(`✅ Model ${model} succeeded! serviceTier: ${serviceTier}`);
          break;
        } else {
          const errorText = await testResponse.text();
          console.error(`❌ Model ${model} failed! status: ${testResponse.status}, body: ${errorText}`);
          let parsedError;
          try {
            parsedError = JSON.parse(errorText);
          } catch (e) {
            parsedError = { error: { message: errorText } };
          }
          
          const errMsg = parsedError.error?.message || '';
          
          if (testResponse.status === 400 || testResponse.status === 403 || errMsg.includes('API_KEY_INVALID') || errMsg.includes('invalid')) {
            isInvalidKey = true;
            lastError = new Error('Neplatný API klíč.');
          } else if (testResponse.status === 429 || errMsg.includes('quota') || errMsg.includes('Quota')) {
            isExhausted = true;
            if (errMsg.includes('FreeTier') || errMsg.includes('free_tier') || errMsg.includes('free-tier')) {
              serviceTier = 'free';
            } else {
              serviceTier = 'standard';
            }
            lastError = new Error(errMsg || 'Vyčerpaná kvóta API.');
          } else if (testResponse.status === 503) {
            isUnavailable = true;
            lastError = new Error('Model je dočasně nedostupný.');
          } else {
            lastError = new Error(errMsg || `Chyba API (${testResponse.status})`);
          }
        }
      } catch (e) {
        console.error(`❌ Model ${model} caught exception:`, e);
        lastError = e;
      }
    }

    // 2. Fetch approved count from Discord to calculate remaining articles
    const channel = await getNewsChannel();
    let approvedCount = 0;
    if (channel) {
      try {
        const messages = await channel.messages.fetch({ limit: 100 });
        approvedCount = messages.filter(msg => msg.reactions.cache.has('💻')).size;
      } catch (discordErr) {
        console.error('Chyba při načítání zpráv pro limit:', discordErr);
      }
    }

    if (isInvalidKey) {
      return res.status(400).json({ success: false, error: 'Neplatný API klíč.' });
    }

    if (isExhausted) {
      const isStandard = serviceTier === 'standard';
      return res.json({
        success: true,
        tier: serviceTier,
        remaining: isStandard ? 'Bez omezení (Vyčerpán rozpočet/limit)' : 0,
        approvedCount,
        limit: isStandard ? 'unlimited' : 750,
        note: 'Vyčerpaná kvóta'
      });
    }

    if (isUnavailable) {
      const isStandard = serviceTier === 'standard';
      return res.json({
        success: true,
        tier: serviceTier,
        remaining: isStandard ? 'Bez omezení' : Math.max(0, 750 - approvedCount),
        approvedCount,
        limit: isStandard ? 'unlimited' : 750,
        note: 'Model je dočasně přetížený'
      });
    }

    if (lastError) {
      throw lastError;
    }

    // Determine limit dynamically based on service tier
    const isStandard = serviceTier === 'standard';
    const limit = isStandard ? 'unlimited' : 750;
    const remaining = isStandard ? 'Bez omezení' : Math.max(0, 750 - approvedCount);

    res.json({
      success: true,
      tier: serviceTier,
      remaining,
      approvedCount,
      limit
    });
  } catch (error) {
    console.error('Chyba při testování limitu API:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`📡 API Server running on http://localhost:${PORT}`);
});

client.login(process.env.DISCORD_TOKEN);
