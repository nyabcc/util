const { Client, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
require('dotenv').config();

const SENSITIVE_PATTERNS = {

};

const SENSITIVE_KEYWORDS = {
  
};

const getInfoEmbed = (type) => {
  const embeds = {
    ip: new EmbedBuilder()
      .setColor(0x3498DB)
      .setTitle('📍 How to Find Your IP Address')
      .setDescription('Follow these steps to safely locate your server IP address:')
      .addFields(
        { name: '1️⃣ Access Control Panel', value: 'Log into your control panel at control.freeminecrafthost.com' },
        { name: '2️⃣ Navigate to Overview', value: 'Look for the "Server Information" or "Overview" section' },
        { name: '3️⃣ Locate IP', value: 'Find the "IP Address" field (Format: xxx.xxx.xxx.xxx:port)' },
        { name: '⚠️ Security Note', value: 'Never share your IP address in public channels' }
      )
      .setFooter({ text: 'Use /sensitive command to share this information securely' }),

    email: new EmbedBuilder()
      .setColor(0x2ECC71)
      .setTitle('📧 How to Find Your Email')
      .setDescription('Follow these steps to locate your account email:')
      .addFields(
        { name: '1️⃣ Open Profile', value: 'Enter the email you made the account with!' },
      
      )
      .setFooter({ text: 'Use /sensitive command to share this information securely' }),

    link: new EmbedBuilder()
      .setColor(0xE74C3C)
      .setTitle('🔗 How to Find Your Server Link')
      .setDescription('Follow these steps to get your server control panel link:')
      .addFields(
        { name: '1️⃣ Login', value: 'Log into your control panel' },
        { name: '2️⃣ Check URL', value: 'Look at your browser\'s address bar' },
        { name: '3️⃣ Copy Link', value: 'The format will be: control.freeminecrafthost.com/server/[ID]' },
        { name: '⚠️ Security Note', value: 'Only share this link with trusted staff members' }
      )
      .setFooter({ text: 'Use /sensitive command to share this information securely' }),

    username: new EmbedBuilder()
      .setColor(0x9B59B6)
      .setTitle('👤 How to Find Your Username')
      .setDescription('Follow these steps to locate your account username:')
      .addFields(
        { name: '1️⃣ Open Profile', value: 'Click your profile in the top-right corner' },
        { name: '2️⃣ View Username', value: 'It will show your username!' }
      )
      .setFooter({ text: 'Use /sensitive command to share this information securely' }),

    other: new EmbedBuilder()
      .setColor(0xF1C40F)
      .setTitle('🔒 Sharing Other Sensitive Information')
      .setDescription('Guidelines for sharing sensitive information:')
      .addFields(
        { name: '❌ Never Share', value: 'Passwords, authentication tokens, or private keys' },
        { name: '✅ Use Secure Methods', value: 'Always use the /sensitive command' },
        { name: '⏳ Wait for Staff', value: 'Only share information when requested by staff' },
        { name: '❓ When Unsure', value: 'Ask staff about the security of specific information' }
      )
      .setFooter({ text: 'Use /sensitive command to share this information securely' })
  };

  return embeds[type] || embeds.other;
};

async function handleMessageScan(message) {
  if (message.author.bot) return;

  const isStaff = message.member && (
    message.member.roles.cache.some(role => 
      role.name.toLowerCase().includes('staff') || 
      role.name.toLowerCase().includes('admin') || 
      role.name.toLowerCase().includes('mod')
    )
  );

  if (isStaff) return;

  let containsSensitiveInfo = false;
  let sensitiveType = new Set();

  for (const [type, pattern] of Object.entries(SENSITIVE_PATTERNS)) {
    if (pattern.test(message.content)) {
      console.log(`Found sensitive info of type: ${type}`);
      containsSensitiveInfo = true;
      sensitiveType.add(type);
    }
  }

  const lowerContent = message.content.toLowerCase();
  for (const [category, keywords] of Object.entries(SENSITIVE_KEYWORDS)) {
    if (keywords.some(keyword => lowerContent.includes(keyword.toLowerCase()))) {
      console.log(`Found sensitive keyword of category: ${category}`);
      containsSensitiveInfo = true;
      sensitiveType.add(category);
    }
  }

  if (containsSensitiveInfo) {
    console.log('Attempting to delete sensitive message');
    try {
      await message.delete();

      const warningEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('⚠️ Sensitive Information Detected')
        .setDescription(`${message.author}, your message contained sensitive information (${Array.from(sensitiveType).join(', ')}) and was removed for your security.`)
        .addFields({
          name: 'How to Share Sensitive Information',
          value: 'Please use the `/sensitive` command to securely share sensitive information with staff.'
        })
        .setFooter({ text: 'This is for your security' })
        .setTimestamp();

      const infoEmbed = getInfoEmbed(Array.from(sensitiveType)[0]);

      await message.channel.send({
        content: `<@${message.author.id}>`,
        embeds: [warningEmbed, infoEmbed]
      });
      
      console.log('Successfully handled sensitive message');
    } catch (error) {
      console.error('Error handling sensitive information:', error);
    }
  }
}

async function handleSensitiveCommand(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const type = interaction.options.getString('type');
    const info = interaction.options.getString('info');

    const staffChannelId = process.env.STAFF_CHANNEL_ID;
    const staffChannel = await interaction.client.channels.fetch(staffChannelId);

    if (!staffChannel) {
      console.error('Staff channel not found:', staffChannelId);
      await interaction.editReply({
        content: 'Error: Staff channel not configured. Please contact an administrator.',
        ephemeral: true
      });
      return;
    }

    const botPermissions = staffChannel.permissionsFor(interaction.client.user);
    if (!botPermissions?.has(['ViewChannel', 'SendMessages', 'EmbedLinks'])) {
      console.error('Missing permissions in staff channel');
      await interaction.editReply({
        content: 'Error: Bot lacks required permissions in staff channel. Please contact an administrator.',
        ephemeral: true
      });
      return;
    }

    const referenceId = Math.random().toString(36).substring(2, 15);

    const staffEmbed = new EmbedBuilder()
      .setColor(0xFF9900)
      .setTitle('🔒 Sensitive Information Submitted')
      .addFields(
        { name: 'Reference ID', value: referenceId, inline: true },
        { name: 'User', value: `<@${interaction.user.id}>`, inline: true },
        { name: 'Type', value: type, inline: true },
        { name: 'Information', value: `||${info}||` },
        { name: 'Channel', value: `<#${interaction.channel.id}>`, inline: true },
        { name: 'Timestamp', value: new Date().toISOString(), inline: true }
      )
      .setTimestamp();

    await staffChannel.send({ 
      content: 'New sensitive information submitted:' + ` ||${info}|| \n Reference ID: ${referenceId}`,
      embeds: [staffEmbed] 
    });

    const confirmEmbed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('✅ Information Securely Submitted')
      .setDescription('Your sensitive information has been securely submitted to staff.')
      .addFields(
        { 
          name: 'Reference ID',
          value: `Keep this ID for reference: \`${referenceId}\``
        },
        {
          name: 'Next Steps',
          value: 'Staff have been notified and will review your submission. They will contact you if needed.'
        },
        {
          name: 'Security Note',
          value: 'Your submission is only visible to staff members and yourself.'
        }
      )
      .setTimestamp();

    await interaction.editReply({
      embeds: [confirmEmbed],
      ephemeral: true
    });

  } catch (error) {
    console.error('Error handling sensitive command:', error);
    await interaction.editReply({
      content: 'An error occurred while processing your sensitive information. Please try again or contact staff directly.',
      ephemeral: true
    });
  }
}

async function handleRequestSensitiveCommand(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const isStaff = interaction.member?.roles.cache.some(role => 
      role.name.toLowerCase().includes('staff') || 
      role.name.toLowerCase().includes('admin') || 
      role.name.toLowerCase().includes('mod')
    );

    if (!isStaff) {
      await interaction.editReply({
        content: '❌ This command is only available to staff members.',
        ephemeral: true
      });
      return;
    }

    let targetUser;
    if (interaction.channel.isThread()) {
      try {
        const starterMessage = await interaction.channel.fetchStarterMessage();
        targetUser = starterMessage?.author;
      } catch (error) {
        console.error('Error fetching thread starter message:', error);
      }
    }
    
    if (!targetUser) {
      targetUser = interaction.options.getUser('user');
    }

    if (!targetUser) {
      await interaction.editReply({
        content: '❌ Could not determine the target user. Please specify a user or use this command in a thread.',
        ephemeral: true
      });
      return;
    }

    const type = interaction.options.getString('type');
    const reason = interaction.options.getString('reason');

    const instructionEmbed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setTitle('📬 Sensitive Information Request')
      .setDescription(`Hello ${targetUser}, a staff member has requested some sensitive information from you.`)
      .addFields(
        { name: '📋 Requested Information', value: `Type: \`${type}\`\nReason: ${reason}` },
        { name: '🔒 How to Submit', value: 'Please use the `/sensitive` command to securely submit the requested information.\nThis ensures your information is handled securely and only visible to staff members.' },
        { name: '⚠️ Important', value: 'Do not post sensitive information directly in the chat.\nOnly use the `/sensitive` command to submit this information.' }
      )
      .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();

    const helpEmbed = getInfoEmbed(type);

    await interaction.channel.send({
      content: `<@${targetUser.id}>`,
      embeds: [instructionEmbed, helpEmbed]
    });

    await interaction.editReply({
      content: `✅ Request sent to ${targetUser.tag}`,
      ephemeral: true
    });

  } catch (error) {
    console.error('Error handling request sensitive command:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ An error occurred while processing the request. Please try again.',
        ephemeral: true
      });
    } else {
      await interaction.editReply({
        content: '❌ An error occurred while processing the request. Please try again.',
        ephemeral: true
      });
    }
  }
}

const sensitiveCommand = {
  name: 'sensitive',
  description: 'Submit sensitive information securely to staff',
  options: [
    {
      name: 'type',
      description: 'Type of sensitive information',
      type: 3,
      required: true,
      choices: [
        { name: 'IP Address', value: 'ip' },
        { name: 'Email', value: 'email' },
        { name: 'Server Link', value: 'link' },
        { name: 'Username', value: 'username' },
        { name: 'Other', value: 'other' }
      ]
    },
    {
      name: 'info',
      description: 'The sensitive information',
      type: 3,
      required: true
    }
  ]
};

const requestSensitiveCommand = {
  name: 'requestsensitive',
  description: 'Request sensitive information from a user (Staff Only)',
  defaultMemberPermissions: "8",
  options: [
    {
      name: 'type',
      description: 'Type of sensitive information to request',
      type: 3,
      required: true,
      choices: [
        { name: 'IP Address', value: 'ip' },
        { name: 'Email', value: 'email' },
        { name: 'Server Link', value: 'link' },
        { name: 'Username', value: 'username' },
        { name: 'Other', value: 'other' }
      ]
    },
    {
      name: 'reason',
      description: 'Reason for requesting this information',
      type: 3,
      required: true
    },
    {
      name: 'user',
      description: 'The user to request information from (ignored in threads)',
      type: 6,
      required: false
    }
  ]
};

module.exports = {
  handleMessageScan,
  handleSensitiveCommand,
  handleRequestSensitiveCommand,
  sensitiveCommand,
  requestSensitiveCommand,
  SENSITIVE_PATTERNS,
  SENSITIVE_KEYWORDS,
  getInfoEmbed
};