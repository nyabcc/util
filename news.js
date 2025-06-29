const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');
const axios = require('axios');
const { convert } = require('html-to-text');

const FLARUM_URL = process.env.FLARUM_URL;
const FLARUM_API_URL = `${FLARUM_URL}/api`;
const NEWS_TAG_NAME = "news";
const CHECK_INTERVAL = 5 * 60 * 1000; 
const TIME_RADIUS = 5 * 60 * 1000;

const postedNewsIds = new Set();
let lastCheckTime = null;

function truncateString(str, maxLength) {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

function formatDate(dateString) {
  if (!dateString) return 'Unknown date';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Invalid date';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

async function checkBotPermissions(channel) {
  if (!channel) return false;
  
  const botMember = channel.guild.members.cache.get(channel.client.user.id);
  if (!botMember) return false;

  const requiredPermissions = [
    PermissionsBitField.Flags.ViewChannel,
    PermissionsBitField.Flags.SendMessages,
    PermissionsBitField.Flags.EmbedLinks
  ];

  const hasPermissions = botMember.permissionsIn(channel).has(requiredPermissions);
  if (!hasPermissions) {
    console.error(`Missing required permissions in channel ${channel.name}`);
    return false;
  }

  return true;
}

function createNewsEmbed(post) {
  const title = post.data.attributes.title || 'Untitled News Post';
  const createdAt = post.data.attributes.createdAt;
  
  const embed = new EmbedBuilder()
    .setColor(0xFF9900)
    .setTitle('📢 ' + title)
    .setURL(`${FLARUM_URL}/d/${post.data.id}`)
    .setTimestamp(new Date(createdAt));
  
  const firstPost = post.included?.find(item => item.type === 'posts' && item.attributes.number === 1);
  if (firstPost && firstPost.attributes.contentHtml) {
    const plainTextContent = convert(firstPost.attributes.contentHtml, {
      wordwrap: 80,
      limits: {
        maxInputLength: 1000
      },
      selectors: [
        { selector: 'img', format: 'skip' },
        { selector: 'a', options: { ignoreHref: true } },
        { selector: 'h1', options: { uppercase: true } },
        { selector: 'h2', options: { uppercase: true } }
      ]
    });
    
    const formattedContent = truncateString(plainTextContent, 4000);
    embed.setDescription(formattedContent);
  }
  
  if (post.data.relationships?.user?.data) {
    const userId = post.data.relationships.user.data.id;
    const userAttributes = post.included?.find(item => item.type === 'users' && item.id === userId)?.attributes;
    
    if (userAttributes) {
      embed.setAuthor({
        name: userAttributes.displayName || userAttributes.username || 'Unknown User',
        iconURL: userAttributes.avatarUrl || null,
        url: `${FLARUM_URL}/u/${userAttributes.username}`
      });
    }
  }
  
  if (post.data.relationships?.tags?.data) {
    const tagIds = post.data.relationships.tags.data.map(tag => tag.id);
    const tags = tagIds.map(tagId => {
      const tagData = post.included?.find(item => item.type === 'tags' && item.id === tagId);
      return tagData?.attributes?.name || null;
    }).filter(Boolean);
    
    if (tags.length > 0) {
      embed.addFields({
        name: 'Categories',
        value: tags.map(tag => `\`${tag}\``).join(' ')
      });
    }
  }
  
  embed.addFields(
    { name: 'Posted', value: formatDate(createdAt), inline: true },
    { name: 'Comments', value: post.data.attributes.commentCount.toString(), inline: true }
  );
  
  embed.setFooter({
    text: `News Post #${post.data.id} • ${formatDate(createdAt)}`
  });
  
  return embed;
}

async function checkForNewNews(client) {
  try {
    const currentTime = Date.now();
    const newsChannel = await client.channels.fetch(process.env.NEWS_CHANNEL_ID);
    
    if (!newsChannel) {
      console.error('Could not find news channel');
      return;
    }

    if (!await checkBotPermissions(newsChannel)) {
      console.error('Bot lacks required permissions in news channel');
      return;
    }

    const response = await axios.get(`${FLARUM_API_URL}/discussions`, {
      params: {
        'filter[tag]': NEWS_TAG_NAME,
        'page[limit]': 5,
        'include': 'user,firstPost,tags',
        'sort': '-createdAt'
      },
      timeout: 10000
    });

    const newsPosts = response.data.data;
    if (!newsPosts || newsPosts.length === 0) return;

    for (const post of newsPosts.reverse()) {
      const postCreatedAt = new Date(post.attributes.createdAt).getTime();
      
      // Skip posts that are older than the time radius
      if (currentTime - postCreatedAt > TIME_RADIUS) {
        continue;
      }

      // Skip posts we've already seen
      if (postedNewsIds.has(post.id)) {
        continue;
      }

      postedNewsIds.add(post.id);

      const fullPostResponse = await axios.get(`${FLARUM_API_URL}/discussions/${post.id}?include=user,firstPost,tags`);
      const fullPost = fullPostResponse.data;

      const embed = createNewsEmbed(fullPost);

      await newsChannel.send({
        embeds: [embed],
        components: [
          new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setLabel('View Full Post')
                .setURL(`${FLARUM_URL}/d/${post.id}`)
                .setStyle(ButtonStyle.Link)
            )
        ]
      });

      // Add a small delay between posts to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Cleanup old IDs that are outside the time radius
    for (const id of postedNewsIds) {
      const post = newsPosts.find(p => p.id === id);
      if (post) {
        const postCreatedAt = new Date(post.attributes.createdAt).getTime();
        if (currentTime - postCreatedAt > TIME_RADIUS) {
          postedNewsIds.delete(id);
        }
      }
    }

    lastCheckTime = currentTime;

  } catch (error) {
    if (error.code === 50013) {
      console.error('Bot lacks required permissions in news channel');
    } else {
      console.error('Error checking for news:', error);
    }
  }
}

async function initializeNewsCheck(client) {
  const newsChannel = await client.channels.fetch(process.env.NEWS_CHANNEL_ID);
  if (await checkBotPermissions(newsChannel)) {
    await checkForNewNews(client);
    setInterval(() => checkForNewNews(client), CHECK_INTERVAL);
  } else {
    console.error('Bot lacks required permissions. Please add the following permissions:');
    console.error('- View Channel');
    console.error('- Send Messages');
    console.error('- Embed Links');
  }
}

module.exports = {
  initializeNewsCheck
};