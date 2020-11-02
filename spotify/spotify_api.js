const fetch = require('node-fetch');
const {redis_client} = require("../redis/redis");

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
                ...(refresh ? {} : {redirect_uri: process.env.REDIRECT_URI})
            })
        });
    console.log(`Spotify Auth: /api/token, refresh: ${refresh}, HTTP status: ${response.status}`);

    return {
        ok: response.ok,
        status: response.status,
        body: await response.json()
    };
}

// this is to get user_id using access_token
// only using this function when user is in the authorization process
const web_api_me = async (auth_info) => {
    const {access_token, refresh_token, expires_in} = auth_info;
    const response = await fetch(
        'https://api.spotify.com/v1/me',
        {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${access_token}`
            }
        }
    );
    console.log(`Spotify Web API Me: /me, HTTP status: ${response.status}`);

    const body = await response.json();

    if (response.ok) {
        await redis_client.set(`${body.id}:access_token`, access_token, 'EX', expires_in - 30);
        await redis_client.hset('refresh_tokens', [body.id, refresh_token]);
    }
    return {ok: response.ok, status: response.status, body: body};
}

// the user must have a refresh_token in the database
const web_api = async (endpoint, user_id, method = 'GET', body) => {
    // check if this user has a valid access_token in our database
    let access_token = await redis_client.get(`${user_id}:access_token`);
    // we need to refresh the access_token
    if (!access_token) {
        const auth_res = await auth(await redis_client.hget('refresh_tokens', user_id), true);
        if (auth_res.ok) {
            access_token = auth_res.body.access_token;
            const {refresh_token, expires_in} = auth_res.body;
            await redis_client.set(`${user_id}:access_token`, access_token, 'EX', expires_in - 30);
            // update the refresh_token in the database if a new one is in the response
            if (refresh_token)
                await redis_client.hset('refresh_tokens', [user_id, refresh_token]);
        } else
            return {ok: auth_res.ok, status: auth_res.status, body: auth_res.body};
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
    return {ok: response.ok, status: response.status, body: await response.json()};
}

module.exports.auth = auth;
module.exports.web_api = web_api;
module.exports.web_api_me = web_api_me;