import { Client, GatewayIntentBits } from 'discord.js';
import 'dotenv/config';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

client.once('ready', async () => {
  console.log(`\n🤖 Bot ${client.user.tag} vidí tyto servery (Guilds):`);
  const guilds = await client.guilds.fetch();
  
  for (const [id, guild] of guilds) {
    console.log(`\n🏰 Server: ${guild.name} (ID: ${id})`);
    try {
      const fullGuild = await guild.fetch();
      const channels = await fullGuild.channels.fetch();
      console.log(`   Kanály:`);
      channels.forEach(ch => {
        if (ch.type === 0) { // Textový kanál
          console.log(`   - # ${ch.name} (ID: ${ch.id})`);
        }
      });
    } catch (e) {
      console.log(`   (Nemohu načíst kanály pro tento server)`);
    }
  }
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN).catch(e => {
  console.error('Chyba přihlášení:', e.message);
  process.exit(1);
});
