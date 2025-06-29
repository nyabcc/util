const axios = require('axios');

/**
 * Process the auth code received from Discord OAuth callback
 * @param {string} code - The authorization code received from Discord
 * @param {string} redirectUri - The redirect URI used in the original OAuth request
 * @returns {Promise<Object>} The processed authentication response
 */
async function processAuthCode(code, redirectUri) {
  try {
    const tokenUrl = 'https://discord.com/api/oauth2/token';
    
    // Exchange the auth code for access tokens
    const response = await axios.post(tokenUrl, 
      new URLSearchParams({
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('Error processing Discord auth code:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data || { message: error.message }
    };
  }
}

/**
 * Get Discord user information using the access token
 * @param {string} accessToken - The access token received from Discord
 * @returns {Promise<Object>} Discord user information
 */
async function getUserInfo(accessToken) {
  try {
    const userInfoUrl = 'https://discord.com/api/users/@me';
    
    const response = await axios.get(userInfoUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    return {
      success: true,
      user: response.data
    };
  } catch (error) {
    console.error('Error fetching Discord user info:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data || { message: error.message }
    };
  }
}

module.exports = {
  processAuthCode,
  getUserInfo
};