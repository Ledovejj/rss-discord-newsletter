import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';
dotenv.config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  console.log('🤖 Permission Check Bot Online');
  try {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    const channel = await guild.channels.fetch(process.env.CHANNEL_ID);
    const me = await guild.members.fetch(client.user.id);
    
    const permissions = channel.permissionsFor(me);
    const canDelete = permissions.has('ManageMessages');
    const canReact = permissions.has('AddReactions');
    
    console.log(`\n--- PERMISSIONS FOR ${client.user.tag} IN #${channel.name} ---`);
    console.log(`✅ Can Add Reactions: ${canReact}`);
    console.log(`❌ Can Manage Messages (Delete): ${canDelete}`);
    
    if (!canDelete) {
      console.log('\n⚠️ ACTION REQUIRED: You MUST enable "Manage Messages" for this bot in Discord channel settings!');
    } else {
      console.log('\n✅ Permissions look good! Deletion should work.');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
  process.exit();
});

client.login(process.env.DISCORD_TOKEN);
