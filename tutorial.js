const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Tutorial steps with their content
const TUTORIAL_STEPS = [
  {
    title: '👋 Welcome to FreeMinecraftHost!',
    description: 'Let\'s get you started with creating your own free Minecraft server! This guide will walk you through every step.',
    fields: [
      {
        name: '📚 What You\'ll Learn',
        value: '• How to create your account\n• Setting up your first server\n• Managing your server\n• Understanding the coin system\n• Handling server suspension\n• Getting support when needed'
      }
    ]
  },
  {
    title: '🎮 Step 1: Creating Your Account',
    description: 'First, let\'s get your account set up on FreeMinecraftHost.com',
    fields: [
      {
        name: '📝 Account Creation',
        value: '1. Visit FreeMinecraftHost.com\n2. Click the "Play Now!" button\n3. Fill in your registration details\n4. Verify your email if required\n5. Log in to your new account'
      },
      {
        name: '⚠️ Important Note',
        value: 'Keep your login credentials safe and secure. Never share your password with anyone!'
      }
    ]
  },
  {
    title: '🚀 Step 2: Creating Your First Server',
    description: 'Now let\'s create your very own Minecraft server!',
    fields: [
      {
        name: '🔧 Server Setup',
        value: '1. Click "No servers yet. Why not create one?"\n2. Choose a server name\n3. Select your preferred location\n4. Choose your Minecraft version\n5. Select server resources (up to 8GB RAM available)\n6. Click "Create Server"'
      },
      {
        name: '⏳ Processing',
        value: 'Wait about 5 seconds while your server is being created. The page will refresh automatically when ready.'
      }
    ]
  },
  {
    title: '💰 Step 3: Understanding Coins',
    description: 'Learn about our coin system that keeps your server running!',
    fields: [
      {
        name: '🪙 What Are Coins?',
        value: '• Coins are the currency that keeps your server online\n• 1 coin = 5 minutes of server uptime\n• Your server uses 1 coin every 5 minutes while running'
      },
      {
        name: '💫 How to Earn Coins',
        value: '1. Watch ads on our website to earn free coins\n2. Use our mobile app to earn coins through ads\n3. Purchase coins directly for instant credit'
      },
      {
        name: '📊 Coin Management',
        value: 'Keep an eye on your coin balance in the control panel to ensure your server stays online'
      }
    ]
  },
  {
    title: '⚙️ Step 4: Managing Your Server',
    description: 'Let\'s learn how to access and control your server!',
    fields: [
      {
        name: '🎛️ Control Panel Access',
        value: '1. Open the Control Panel in a new tab\n2. Log in with your account credentials\n3. Select your server from the list\n4. Navigate to the "Terminal" tab'
      },
      {
        name: '▶️ Starting Your Server',
        value: 'Look for the Start icon in the top right corner of the Terminal tab and click it to launch your server'
      }
    ]
  },
  {
    title: '🌐 Step 5: Connecting to Your Server',
    description: 'Time to get your server\'s IP address and start playing!',
    fields: [
      {
        name: '📋 Finding Your IP',
        value: '1. Go to the Terminal tab in your Control Panel\n2. Look for "Server Address" on the right side\n3. Copy the IP address shown'
      },
      {
        name: '🎮 Joining the Server',
        value: '1. Open Minecraft\n2. Click "Multiplayer"\n3. Click "Add Server"\n4. Paste your server IP\n5. Click "Done" and join!'
      }
    ]
  },
  {
    title: '⚠️ Step 6: Handling Server Suspension',
    description: 'If your server gets suspended, don\'t worry! Here\'s how to fix it:',
    fields: [
      {
        name: '❓ Why Was My Server Suspended?',
        value: 'Servers are suspended when they run out of coins. This is a temporary state and can be easily fixed!'
      },
      {
        name: '🔄 How to Reactivate Your Server',
        value: '1. Ensure you have at least 5 coins in your account\n2. Go to your control panel\n3. Navigate to your suspended server\n4. Click the "Activate" button\n5. Your server will be back online immediately!'
      },
      {
        name: '💡 Prevention Tips',
        value: '• Keep a minimum balance of 50 coins\n• Enable email notifications for low coin balance\n• Regularly check your coin balance\n• Consider purchasing coins in bulk for better value'
      }
    ]
  },
  {
    title: '🔍 Getting Help',
    description: 'Need assistance? We\'ve got you covered!',
    fields: [
      {
        name: '📖 Help Center',
        value: 'Use `/search` to find detailed guides about any topic'
      },
      {
        name: '❓ Support',
        value: 'Create a ticket if you need direct assistance from our staff team'
      },
      {
        name: '🔒 Sharing Sensitive Info',
        value: 'Use `/sensitive` to safely share server details with staff'
      }
    ]
  },
  {
    title: '✨ Final Tips & Best Practices',
    description: 'Some important tips to help you manage your server successfully:',
    fields: [
      {
        name: '💾 Backups',
        value: 'Regular backups are important! Use the backup feature in your control panel'
      },
      {
        name: '👥 Player Management',
        value: 'Use whitelist and operator commands to manage your players effectively'
      },
      {
        name: '🔄 Updates',
        value: 'Keep your server updated to the latest version for best performance and security'
      },
      {
        name: '🎉 Ready to Play?',
        value: 'Your server is now ready! If you need any help, don\'t hesitate to ask in the appropriate channels!'
      }
    ]
  }
];

// Create navigation buttons
function createNavigationButtons(currentStep, totalSteps) {
  const row = new ActionRowBuilder();
  
  // Previous button
  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`tutorial_prev_${currentStep}`)
      .setLabel('Previous')
      .setEmoji('⬅️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentStep === 0)
  );

  // Next button
  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`tutorial_next_${currentStep}`)
      .setLabel('Next')
      .setEmoji('➡️')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(currentStep === totalSteps - 1)
  );
   
    row.addComponents(
    new ButtonBuilder()
      .setLabel('📺 Watch Tutorial')
      .setURL('https://youtu.be/g5PHQ07Lki4?si=w28qj8xHpMmEahKx') 
      .setStyle(ButtonStyle.Link)
  );

  // Restart button (only show on last step)
  if (currentStep === totalSteps - 1) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('tutorial_restart')
        .setLabel('Start Over')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Success)
    );

  }

  return row;
}

// Create tutorial embeds
function createTutorialEmbeds() {
  return TUTORIAL_STEPS.map((step, index) => {
    const embed = new EmbedBuilder()
      .setColor(0x3498DB)
      .setTitle(step.title)
      .setDescription(step.description)
      .setFooter({ text: `Tutorial Step ${index + 1}/${TUTORIAL_STEPS.length}` })
      .setTimestamp();

    step.fields.forEach(field => {
      embed.addFields(field);
    });

    return embed;
  });
}

// Handle sending tutorial to a user
async function sendTutorial(user, channel, client) {
  try {
    const welcomeMessage = `Welcome ${user}! 🎉 Here's your step-by-step guide to creating your own Minecraft server! Also, you can watch our video version via the button below!`;
    const embeds = createTutorialEmbeds();

    // Send the tutorial via DM
    try {
      const dmChannel = await user.createDM();
      await dmChannel.send({
        content: welcomeMessage,
        embeds: [embeds[0]],
        components: [createNavigationButtons(0, TUTORIAL_STEPS.length)]
      });
    } catch (dmError) {
      console.error('Failed to send DM:', dmError);

      // Fetch the specific channel and send the failure message
      const logChannel = await client.channels.fetch('1247949216261603400');
      if (logChannel) {
        await logChannel.send({
          content: `${user}, I couldn't send you a DM. Please make sure your DMs are open for this server!`,
        });
      }

      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending tutorial:', error);
    return false;
  }
}



// Handle tutorial navigation
async function handleTutorialNavigation(interaction) {
  const [_, action, currentStep] = interaction.customId.split('_');
  const stepIndex = parseInt(currentStep);
  
  let newIndex = stepIndex;
  if (action === 'next') {
    newIndex = stepIndex + 1;
  } else if (action === 'prev') {
    newIndex = stepIndex - 1;
  } else if (action === 'restart') {
    newIndex = 0;
  }

  if (newIndex >= 0 && newIndex < TUTORIAL_STEPS.length) {
    const embed = createTutorialEmbeds()[newIndex];
    await interaction.update({
      embeds: [embed],
      components: [createNavigationButtons(newIndex, TUTORIAL_STEPS.length)]
    });
  }
}

// Handle the tutorial command
async function handleTutorialCommand(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    // Check if user has staff role
    const hasStaffRole = interaction.member.roles.cache.has('1247890782648668281');
    
    if (!hasStaffRole) {
      await interaction.editReply({
        content: '❌ This command is only available to staff members.',
        ephemeral: true
      });
      return;
    }

    const targetUser = interaction.options.getUser('user');
    if (!targetUser) {
      await interaction.editReply({
        content: '❌ Please specify a user to send the tutorial to.',
        ephemeral: true
      });
      return;
    }

    const success = await sendTutorial(targetUser, interaction.channel);

    if (success) {
      await interaction.editReply({
        content: `✅ Tutorial sent to ${targetUser.tag}'s DMs`,
        ephemeral: true
      });
    } else {
      await interaction.editReply({
        content: `❌ Failed to send tutorial to ${targetUser.tag}. Please ensure they have DMs enabled.`,
        ephemeral: true
      });
    }

  } catch (error) {
    console.error('Error handling tutorial command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while processing the command.',
      ephemeral: true
    });
  }
}

// Command definition
const tutorialCommand = {
  name: 'tutorial',
  description: 'Send the tutorial to a user (Staff Only)',
  defaultMemberPermissions: "8",
  options: [
    {
      name: 'user',
      description: 'The user to send the tutorial to',
      type: 6, // USER type
      required: true
    }
  ]
};

module.exports = {
  sendTutorial,
  handleTutorialCommand,
  handleTutorialNavigation,
  tutorialCommand
};