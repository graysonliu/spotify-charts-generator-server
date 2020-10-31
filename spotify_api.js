const fetch = require('node-fetch');
const {redis_client} = require("./redis/redis");

const auth = async (code, refresh = true) => {
    // code can be the authorization code from web authorization, or a refresh token
    // if refresh is false, code is the authorization code rather than a refresh token
    const response = await fetch(
        'https://accounts.spotify.com/api/token',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                grant_type: refresh ? "refresh_token" : "authorization_code",
                ...(refresh ? {refresh_token: code} : {code: code}),
                client_id: process.env.CLIENT_ID,
                client_secret: process.env.CLIENT_SECRET,
                ...(refresh ? {} : {redirect_uri: process.env.REDIRECT_URL})
            })
        });
    console.log(`Spotify Auth: /api/token, refresh: ${refresh}, HTTP status: ${response.status}`);
    return {status: response.status, ...(await response.json())};
}

const web_api = async (endpoint, refresh_token, method = 'GET', body) => {
    // always refresh token before make a spotify web api request
    // in case that access token is expired
    const auth_data = await auth(refresh_token);
    if (!auth_data)
        return null;
    const access_token = auth_data['access_token'];
    const new_refresh_token = auth_data['refresh_token'];
    if (new_refresh_token) {
        // get corresponding user_id
        const user_id = (await web_api('/me', new_refresh_token)).id;
        await redis_client.hset('refresh_tokens', [user_id, new_refresh_token]);
    }

    const spotify_api_uri = 'https://api.spotify.com/v1';

    const response =
        method.toUpperCase() === 'GET' ?
            await fetch(
                spotify_api_uri + endpoint,
                {
                    method: method,
                    headers: {
                        Authorization: `Bearer ${access_token}`
                    }
                }
            ) :
            await fetch(
                spotify_api_uri + endpoint,
                {
                    method: method,
                    headers: {
                        Authorization: `Bearer ${access_token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(body || '')
                }
            );
    console.log(`Spotify Web API: ${endpoint}, method:${method}, HTTP status: ${response.status}`)
    return {status: response.status, ...(await response.json())};
}

module.exports.auth = auth;
module.exports.web_api = web_api;