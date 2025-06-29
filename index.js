// run `node index.js` in the terminal

require('dotenv').config();
const express = require('express');
const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const { handleSearchCommand, handlePostSelection, handleBackToResults, handleNewSearch } = require('./search');
const { initializeNewsCheck } = require('./news');
const { handleMessageScan, handleSensitiveCommand, handleRequestSensitiveCommand, sensitiveCommand, requestSensitiveCommand } = require('./sensitive');
const { sendTutorial, handleTutorialCommand, handleTutorialNavigation, tutorialCommand } = require('./tutorial');
const { processAuthCode, getUserInfo } = require('./auth');

const requiredEnvVars = [
  'DISCORD_TOKEN',
  'GUILD_ID',
  'FLARUM_URL',
  'NEWS_CHANNEL_ID',
  'STAFF_CHANNEL_ID',
  'SILVER_ROLE_ID',
  'GOLD_ROLE_ID',
  'DIAMOND_ROLE_ID',
  'API_KEY'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing ${envVar} in environment variables`);
    process.exit(1);
  }
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const TIER_ROLES = {
  silver: process.env.SILVER_ROLE_ID,
  gold: process.env.GOLD_ROLE_ID,
  diamond: process.env.DIAMOND_ROLE_ID
};

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

client.searchResultsCache = new Map();

const commands = [
  {
    name: 'search',
    description: 'Search the FMH Help Center',
    options: [{
      name: 'query',
      description: 'The search query',
      type: 3,
      required: true
    }]
  },
  sensitiveCommand,
  requestSensitiveCommand,
  tutorialCommand
];

const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
};

app.post('/assign-role', validateApiKey, async (req, res) => {
  try {
    const { userId, tier } = req.body;

    if (!userId || !tier) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const roleId = TIER_ROLES[tier.toLowerCase()];
    if (!roleId) {
      return res.status(400).json({ error: 'Invalid tier' });
    }

    const guild = client.guilds.cache.get(process.env.GUILD_ID);
    if (!guild) {
      return res.status(500).json({ error: 'Guild not found' });
    }

    const member = await guild.members.fetch(userId);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    for (const existingRoleId of Object.values(TIER_ROLES)) {
      if (member.roles.cache.has(existingRoleId)) {
        await member.roles.remove(existingRoleId);
      }
    }

    await member.roles.add(roleId);

    res.json({ 
      success: true, 
      message: `Successfully assigned ${tier} role to user ${userId}`
    });

  } catch (error) {
    console.error('Error assigning role:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/remove-role', validateApiKey, async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId field' });
    }

    const guild = client.guilds.cache.get(process.env.GUILD_ID);
    if (!guild) {
      return res.status(500).json({ error: 'Guild not found' });
    }

    const member = await guild.members.fetch(userId);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    let removedRoles = [];
    for (const [tier, roleId] of Object.entries(TIER_ROLES)) {
      if (member.roles.cache.has(roleId)) {
        await member.roles.remove(roleId);
        removedRoles.push(tier);
      }
    }

    res.json({ 
      success: true, 
      message: removedRoles.length > 0 
        ? `Successfully removed roles: ${removedRoles.join(', ')} from user ${userId}`
        : `No tier roles found to remove from user ${userId}`
    });

  } catch (error) {
    console.error('Error removing roles:', error);
    res.status(500).json({ error: 'Internal server error, is this a valid snowflake? ' });
  }
});

app.post('/api', validateApiKey, async (req, res) => {
  try {
    const { code, redirectUri } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Missing auth code' });
    }

    const authResult = await processAuthCode(code, redirectUri);
    if (!authResult.success) {
      return res.status(400).json({ 
        error: 'Failed to process auth code',
        details: authResult.error
      });
    }

    const userResult = await getUserInfo(authResult.data.access_token);
    if (!userResult.success) {
      return res.status(400).json({
        error: 'Failed to get user info',
        details: userResult.error
      });
    }

    try {
      const guild = client.guilds.cache.get(process.env.GUILD_ID);
      if (!guild) {
        throw new Error('Guild not found');
      }

      // Add the user to the guild directly
      await guild.members.add(userResult.user.id, {
        accessToken: authResult.data.access_token,
        nick: userResult.user.username
      });

      return res.status(200).json({
        success: true,
        message: 'Successfully added user to server',
        user: userResult.user,
        accessToken: authResult.data.access_token,
        refreshToken: authResult.data.refresh_token,
        expiresIn: authResult.data.expires_in
      });

    } catch (error) {
      console.error('Error adding member to server:', error);
      return res.status(500).json({
        error: 'Failed to add member to server',
        message: error.message
      });
    }

  } catch (error) {
    console.error('Error processing auth callback:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }
});

setInterval(() => {
  const now = Date.now();
  for (const [userId, data] of client.searchResultsCache.entries()) {
    if (now - data.timestamp > 30 * 60 * 1000) {
      client.searchResultsCache.delete(userId);
    }
  }
}, 30 * 60 * 1000);

client.on('guildMemberAdd', async (member) => {
  try {
    const dmChannel = await member.user.createDM();
    await sendTutorial(member.user, dmChannel);
  } catch (error) {
    console.error('Error sending DM tutorial:', error);
  }
});

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  
  try {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    console.log('Started refreshing application (/) commands.');
    
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    
    console.log('Successfully reloaded application (/) commands.');

    await initializeNewsCheck(client);

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`API server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Error during initialization:', error);
  }
});

client.on('messageCreate', async (message) => {
  try {
    await handleMessageScan(message);
  } catch (error) {
    console.error('Error in message scanning:', error);
  }
});

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isCommand()) {
      const { commandName } = interaction;
      
      if (commandName === 'search') {
        await handleSearchCommand(interaction);
      } else if (commandName === 'sensitive') {
        await handleSensitiveCommand(interaction);
      } else if (commandName === 'requestsensitive') {
        await handleRequestSensitiveCommand(interaction);
      } else if (commandName === 'tutorial') {
        await handleTutorialCommand(interaction);
      }
    } else if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'select_post') {
        await handlePostSelection(interaction);
      }
    } else if (interaction.isButton()) {
      if (interaction.customId.startsWith('tutorial_')) {
        await handleTutorialNavigation(interaction);
      } else if (interaction.customId === 'back_to_results') {
        await handleBackToResults(interaction);
      } else if (interaction.customId === 'new_search') {
        await handleNewSearch(interaction);
      }
    }
  } catch (error) {
    console.error('Error handling interaction:', error);
    
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ 
          content: 'An error occurred while processing your request. Please try again later.',
          ephemeral: true
        });
      } else if (interaction.deferred) {
        await interaction.editReply({ 
          content: 'An error occurred while processing your request. Please try again later.'
        });
      }
    } catch (replyError) {
      console.error('Failed to send error response:', replyError);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);

console.log('Discord bot is starting...');