const fetch = require('node-fetch');
const { redis_client } = require("../redis-client");
const { winston_logger } = require('../logger');

const auth = async (code, refresh = true, user_id = null) => {
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
                ...(refresh ? { refresh_token: code } : { code: code }),
                client_id: process.env.CLIENT_ID,
                client_secret: process.env.CLIENT_SECRET,
                ...(refresh ? {} : { redirect_uri: process.env.REDIRECT_URI })
            })
        });
    winston_logger.info(`Spotify Auth: /api/token, refresh: ${refresh}, HTTP status: ${response.status}`);

    const body = await response.json();
    if (!response.ok) {
        if (!refresh)
            winston_logger.error(`Failed to get refresh_token using authorization code -> response: ${JSON.stringify(body)}`);
        else
            winston_logger.error(`Failed to refresh refresh_token for user ${user_id} -> response: ${JSON.stringify(body)}`);
    }

    return {
        ok: response.ok,
        status: response.status,
        body: body
    };
};

// this is to get user_id using access_token
// only using this function when user is in the authorization process
const web_api_me = async (auth_info) => {
    const { access_token, refresh_token, expires_in } = auth_info;
    const response = await fetch(
        'https://api.spotify.com/v1/me',
        {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${access_token}`
            }
        }
    );
    winston_logger.info(`Spotify Web API Me: /me, HTTP status: ${response.status}`);

    const body = await response.json();

    if (response.ok) {
        await redis_client.set(`access_token:${body.id}`, access_token, 'EX', expires_in - 30);
        await redis_client.hset('refresh_tokens', [body.id, refresh_token]);
    } else
        winston_logger.error(`Failed to get user information -> response: ${JSON.stringify(body)}`);

    return { ok: response.ok, status: response.status, body: body };
};

// the user must have a refresh_token in the database
const web_api = async (endpoint, user_id, method = 'GET', request_body) => {
    // check if this user has a valid access_token in our database
    let access_token = await redis_client.get(`access_token:${user_id}`);
    // we need to refresh the access_token
    if (!access_token) {
        const auth_res = await auth(await redis_client.hget('refresh_tokens', user_id), true, user_id);
        if (auth_res.ok) {
            access_token = auth_res.body.access_token;
            const { refresh_token, expires_in } = auth_res.body;
            await redis_client.set(`access_token:${user_id}`, access_token, 'EX', expires_in - 30);
            // update the refresh_token in the database if a new one is in the response
            if (refresh_token)
                await redis_client.hset('refresh_tokens', [user_id, refresh_token]);
        } else
            return { ok: auth_res.ok, status: auth_res.status, body: auth_res.body };
    }

    const spotify_api_uri = 'https://api.spotify.com/v1';

    const response =
        await fetch(
            spotify_api_uri + endpoint,
            {
                method: method,
                headers: {
                    Authorization: `Bearer ${access_token}`,
                    ...(request_body && { 'Content-Type': 'application/json' })
                },
                ...(request_body && { body: JSON.stringify(request_body || '') })
            }
        );

    winston_logger.info(`Spotify Web API: ${endpoint}, user: ${user_id}, method: ${method}, HTTP status: ${response.status}`);

    let body = null;
    try {
        body = await response.json();
    } catch (e) {
        winston_logger.info(`No response body.`);
    }
    if (!response.ok)
        winston_logger.error(`Spotify Web API: ${endpoint}, user: ${user_id}, method: ${method}, HTTP status: ${response.status}, response: ${JSON.stringify(body)}`);
    return {
        ok: response.ok, status: response.status,
        ...(body ? { body: body } : {})
    };
};

module.exports.auth = auth;
module.exports.web_api = web_api;
module.exports.web_api_me = web_api_me;