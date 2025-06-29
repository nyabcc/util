const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');
const { convert } = require('html-to-text');
const { truncateString, formatDate } = require('./utils');

const HELP_CENTER_TAG_NAME = "help-center";
const FLARUM_URL = process.env.FLARUM_URL;
const FLARUM_API_URL = `${FLARUM_URL}/api`;

async function searchHelpCenterPosts(query = '') {
  try {
    const response = await axios.get(`${FLARUM_API_URL}/discussions`, {
      params: {
        'filter[tag]': HELP_CENTER_TAG_NAME,
        'page[limit]': 50,
        'include': 'user,tags',
        'sort': '-createdAt'
      },
      timeout: 10000
    });
    
    const allHelpCenterPosts = response.data.data || [];
    
    if (!query) {
      return allHelpCenterPosts;
    }
    
    const queryLower = query.toLowerCase();
    return allHelpCenterPosts.filter(post => {
      const title = (post.attributes.title || '').toLowerCase();
      const content = (post.attributes.content || '').toLowerCase();
      
      return title.includes(queryLower) || content.includes(queryLower);
    });
  } catch (error) {
    console.error('Flarum API error:', error.response?.data || error.message);
    throw new Error('Failed to fetch help center posts');
  }
}

function createPostEmbed(post) {
  const title = post.attributes.title || 'Untitled Help Center Post';
  const createdAt = post.attributes.createdAt;
  const commentCount = post.attributes.commentCount || 0;
  
  const embed = new EmbedBuilder()
    .setColor(0x2ECC71)
    .setTitle(title)
    .setURL(`${FLARUM_URL}/d/${post.id}`)
    .setTimestamp(new Date(createdAt));
  
  if (post.attributes.content) {
    const plainTextContent = convert(post.attributes.content, {
      wordwrap: 80,
      limits: {
        maxInputLength: 1000
      }
    });
    
    const formattedContent = truncateString(plainTextContent, 4000);
    embed.setDescription(formattedContent);
  }
  
  if (post.relationships && post.relationships.user && post.relationships.user.data) {
    const userId = post.relationships.user.data.id;
    const userAttributes = post.included?.find(item => item.type === 'users' && item.id === userId)?.attributes;
    
    if (userAttributes) {
      embed.setAuthor({
        name: userAttributes.displayName || userAttributes.username || 'Unknown User',
        iconURL: userAttributes.avatarUrl || null,
        url: `${FLARUM_URL}/u/${userAttributes.username}`
      });
    }
  }
  
  if (post.relationships && post.relationships.tags && post.relationships.tags.data) {
    const tagIds = post.relationships.tags.data.map(tag => tag.id);
    const tags = tagIds.map(tagId => {
      const tagData = post.included?.find(item => item.type === 'tags' && item.id === tagId);
      return tagData?.attributes?.name || null;
    }).filter(Boolean);
    
    if (tags.length > 0) {
      embed.addFields({
        name: 'Tags',
        value: tags.map(tag => `\`${tag}\``).join(' ')
      });
    }
  }
  
  embed.addFields(
    { name: 'Posted', value: formatDate(createdAt), inline: true },
    { name: 'Comments', value: commentCount.toString(), inline: true }
  );
  
  embed.setFooter({
    text: `Help Center Post #${post.id} • ${formatDate(createdAt)}`
  });
  
  return embed;
}

async function handleSearchCommand(interaction) {
  const query = interaction.options.getString('query') || '';
  
  try {
    await interaction.deferReply();
    
    const helpCenterPosts = await searchHelpCenterPosts(query);
    
    if (helpCenterPosts.length === 0) {
      const noResultsEmbed = new EmbedBuilder()
        .setColor(0xE74C3C)
        .setTitle('No Help Center Posts Found')
        .setDescription(query ? `No help center posts found for query: **${query}**` : 'No help center posts found.')
        .setFooter({ text: query ? 'Try a different search term' : 'Check back later for new help center posts' })
        .setTimestamp();
      
      await interaction.editReply({ embeds: [noResultsEmbed] });
      return;
    }
    
    const selectMenu = new ActionRowBuilder()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('select_post')
          .setPlaceholder('Select a help center post to view')
          .addOptions(
            helpCenterPosts.slice(0, 25).map((post, index) => ({
              label: truncateString(post.attributes.title || `Help Center Post #${post.id}`, 100),
              description: `Posted: ${formatDate(post.attributes.createdAt)}`,
              value: post.id.toString(),
              emoji: index < 9 ? `${index + 1}️⃣` : '📝'
            }))
          )
      );
    
    interaction.client.searchResultsCache.set(interaction.user.id, {
      results: helpCenterPosts,
      query: query,
      timestamp: Date.now()
    });
    
    const resultsEmbed = new EmbedBuilder()
      .setColor(0x3498DB)
      .setTitle(query ? `Help Center Search Results: "${query}"` : 'FreeMinecraftHost Help Center Posts')
      .setDescription(`Found **${helpCenterPosts.length}** help center posts${query ? ' matching your query' : ''}.`)
      .addFields(
        helpCenterPosts.slice(0, 5).map((post, index) => ({
          name: `${index + 1}. ${truncateString(post.attributes.title || 'Untitled', 100)}`,
          value: `Posted: ${formatDate(post.attributes.createdAt)} | Comments: ${post.attributes.commentCount || 0}`
        }))
      )
      .setFooter({ text: 'Select a help center post from the dropdown menu below' })
      .setTimestamp();
    
    await interaction.editReply({
      embeds: [resultsEmbed],
      components: [selectMenu]
    });
  } catch (error) {
    console.error('Error searching help center posts:', error);
    
    try {
      if (interaction.deferred) {
        const errorEmbed = new EmbedBuilder()
          .setColor(0xE74C3C)
          .setTitle('Search Error')
          .setDescription('An error occurred while searching the help center.')
          .setFooter({ text: 'Please try again later' })
          .setTimestamp();
        
        await interaction.editReply({ embeds: [errorEmbed] });
      }
    } catch (replyError) {
      console.error('Failed to send error response:', replyError);
    }
  }
}

async function handlePostSelection(interaction) {
  try {
    const selectedId = interaction.values[0];
    
    await interaction.deferUpdate();
    
    const userSearchData = interaction.client.searchResultsCache.get(interaction.user.id);
    
    const cacheExpired = !userSearchData || 
                         !userSearchData.results || 
                         (Date.now() - userSearchData.timestamp > 15 * 60 * 1000);
    
    if (cacheExpired) {
      const expiredEmbed = new EmbedBuilder()
        .setColor(0xE74C3C)
        .setTitle('Session Expired')
        .setDescription('Your help center post results have expired.')
        .setFooter({ text: 'Please try searching again' })
        .setTimestamp();
      
      await interaction.editReply({
        embeds: [expiredEmbed],
        components: []
      });
      return;
    }
    
    const selectedPost = userSearchData.results.find(post => post.id.toString() === selectedId);
    
    if (!selectedPost) {
      const notFoundEmbed = new EmbedBuilder()
        .setColor(0xE74C3C)
        .setTitle('Help Center Post Not Found')
        .setDescription('Could not find the selected help center post.')
        .setFooter({ text: 'Please try searching again' })
        .setTimestamp();
      
      await interaction.editReply({
        embeds: [notFoundEmbed],
        components: []
      });
      return;
    }
    
    const embed = createPostEmbed(selectedPost);
    
    const postUrl = `${FLARUM_URL}/d/${selectedPost.id}`;
    const linkButton = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel('View on Website')
          .setURL(postUrl)
          .setStyle(ButtonStyle.Link)
          .setEmoji('🔗'),
        new ButtonBuilder()
          .setCustomId('back_to_results')
          .setLabel('Back to Results')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('↩️'),
        new ButtonBuilder()
          .setCustomId('new_search')
          .setLabel('New Search')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🔍')
      );
    
    await interaction.editReply({
      embeds: [embed],
      components: [linkButton]
    });
  } catch (error) {
    console.error('Error handling post selection:', error);
    
    try {
      if (interaction.deferred) {
        const errorEmbed = new EmbedBuilder()
          .setColor(0xE74C3C)
          .setTitle('Error')
          .setDescription('An error occurred while fetching the help center post details.')
          .setFooter({ text: 'Please try again later' })
          .setTimestamp();
        
        await interaction.editReply({
          embeds: [errorEmbed],
          components: []
        });
      }
    } catch (replyError) {
      console.error('Failed to send error response:', replyError);
    }
  }
}

async function handleBackToResults(interaction) {
  try {
    await interaction.deferUpdate();
    
    const userSearchData = interaction.client.searchResultsCache.get(interaction.user.id);
    
    const cacheExpired = !userSearchData || 
                         !userSearchData.results || 
                         (Date.now() - userSearchData.timestamp > 15 * 60 * 1000);
    
    if (cacheExpired) {
      const expiredEmbed = new EmbedBuilder()
        .setColor(0xE74C3C)
        .setTitle('Session Expired')
        .setDescription('Your help center post results have expired.')
        .setFooter({ text: 'Please try searching again' })
        .setTimestamp();
      
      await interaction.editReply({
        embeds: [expiredEmbed],
        components: []
      });
      return;
    }
    
    const helpCenterPosts = userSearchData.results;
    const query = userSearchData.query || '';
    
    const selectMenu = new ActionRowBuilder()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('select_post')
          .setPlaceholder('Select a help center post to view')
          .addOptions(
            helpCenterPosts.slice(0, 25).map((post, index) => ({
              label: truncateString(post.attributes.title || `Help Center Post #${post.id}`, 100),
              description: `Posted: ${formatDate(post.attributes.createdAt)}`,
              value: post.id.toString(),
              emoji: index < 9 ? `${index + 1}️⃣` : '📝'
            }))
          )
      );
    
    const resultsEmbed = new EmbedBuilder()
      .setColor(0x3498DB)
      .setTitle(query ? `Help Center Search Results: "${query}"` : 'FreeMinecraftHost Help Center Posts')
      .setDescription(`Found **${helpCenterPosts.length}** help center posts${query ? ' matching your query' : ''}.`)
      .addFields(
        helpCenterPosts.slice(0, 5).map((post, index) => ({
          name: `${index + 1}. ${truncateString(post.attributes.title || 'Untitled', 100)}`,
          value: `Posted: ${formatDate(post.attributes.createdAt)} | Comments: ${post.attributes.commentCount || 0}`
        }))
      )
      .setFooter({ text: 'Select a help center post from the dropdown menu below' })
      .setTimestamp();
    
    await interaction.editReply({
      embeds: [resultsEmbed],
      components: [selectMenu]
    });
  } catch (error) {
    console.error('Error returning to help center results:', error);
    
    try {
      if (interaction.deferred) {
        const errorEmbed = new EmbedBuilder()
          .setColor(0xE74C3C)
          .setTitle('Error')
          .setDescription('An error occurred while returning to help center results.')
          .setFooter({ text: 'Please try searching again' })
          .setTimestamp();
        
        await interaction.editReply({
          embeds: [errorEmbed],
          components: []
        });
      }
    } catch (replyError) {
      console.error('Failed to send error response:', replyError);
    }
  }
}

async function handleNewSearch(interaction) {
  try {
    const newSearchEmbed = new EmbedBuilder()
      .setColor(0x3498DB)
      .setTitle('Search FreeMinecraftHost Help Center')
      .setDescription('To search the help center, use the `/search` command followed by your query.')
      .setFooter({ text: 'Type /search in the message box to begin' })
      .setTimestamp();
    
    await interaction.update({
      embeds: [newSearchEmbed],
      components: []
    });
  } catch (error) {
    console.error('Error handling new search request:', error);
    
    try {
      if (!interaction.replied) {
        const errorEmbed = new EmbedBuilder()
          .setColor(0xE74C3C)
          .setTitle('Error')
          .setDescription('An error occurred while processing your request.')
          .setFooter({ text: 'Please try again later' })
          .setTimestamp();
        
        await interaction.update({
          embeds: [errorEmbed],
          components: []
        });
      }
    } catch (replyError) {
      console.error('Failed to send error response:', replyError);
    }
  }
}

module.exports = {
  handleSearchCommand,
  handlePostSelection,
  handleBackToResults,
  handleNewSearch
};