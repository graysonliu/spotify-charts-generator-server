const { redis_client } = require('../redis-client');
const spotify_api = require('../spotify/spotify_api');
const { fetch_chart } = require('../spotify/spotify_chart');

const get_region_list = async (ctx, next) => {
    ctx.response.body = await redis_client.hgetall('regions');
};

const get_option_list = async (ctx, next) => {
    ctx.response.body = await redis_client.hgetall('chart_options');
};

const update_playlists_for_all_users = async () => {
    const user_playlists_key_list = await redis_client.keys('playlists:*');
    for (const key of user_playlists_key_list) {
        const user_id = key.split(':')[1];
        const playlists = await redis_client.hgetall(key);
        for (const [chart_code, playlist_id] of Object.entries(playlists)) {
            // to avoid visiting spotify api too fast
            // we wait 1 second between processing playlists
            await new Promise(r => setTimeout(r, 1000));
            await update_playlist(playlist_id, user_id, chart_code);
        }
    }
};

const update_playlist = async (playlist_id, user_id, chart_code) => {
    const tracks = await fetch_chart(chart_code);
    // change playlist's details, this also checks whether the playlist still exists
    const response = await spotify_api.web_api(
        `/playlists/${playlist_id}`,
        user_id,
        'PUT',
        {
            description: `Last Update: ${new Date().toUTCString()} | Updated with ${process.env.REDIRECT_URI}`
        }
    );
    // if (!response.ok) {
    //     // this playlist might has been deleted by the user
    //     // deregister it from database
    //     await redis_client.hdel(`playlists:${user_id}`, region_code);
    //     return;
    // }
    // we can only add 100 tracks per request
    if (tracks.length > 0) {
        // clear the playlist first
        await spotify_api.web_api(
            `/playlists/${playlist_id}/tracks`,
            user_id,
            'PUT', // PUT method to replace all tracks in the playlist
            {
                uris: [] // use empty uris to clear playlist
            }
        );
        await spotify_api.web_api(
            `/playlists/${playlist_id}/tracks`,
            user_id,
            'POST', // POST method to add tracks
            {
                uris: tracks.slice(0, 100).map((uri) => `spotify:track:${uri}`)
            }
        );
    }
    if (tracks.length > 100)
        await spotify_api.web_api(
            `/playlists/${playlist_id}/tracks`,
            user_id,
            'POST',
            {
                uris: tracks.slice(100, 200).map((uri) => `spotify:track:${uri}`)
            }
        );
};

const create_playlist = async (user_id, chart_code) => {
    const regions = await redis_client.hgetall('regions');
    const options = await redis_client.hgetall('chart_options');
    const i = chart_code.indexOf('-');
    const region_code = chart_code.slice(0, i);
    const option_code = chart_code.slice(i + 1);
    const playlist_id = (await spotify_api.web_api(
        `/users/${user_id}/playlists`,
        user_id,
        'POST',
        {
            name: `${regions[region_code]} ${options[option_code]}`,
            description: `Created and updated with ${process.env.REDIRECT_URL}`
        }
    )).body.id;

    return playlist_id;
};

const delete_playlist = async (user_id, playlist_id) => {
    return await spotify_api.web_api(`/playlists/${playlist_id}/followers`, user_id, 'DELETE');
};

const register_charts = async (ctx, next) => {
    const regions = await redis_client.hgetall('regions');
    const user_id = ctx.request.body.user_id;
    const charts_to_register = ctx.request.body.charts_to_register;
    const key = `playlists:${user_id}`;
    const registered_charts = await redis_client.hkeys(key);
    // deregister regions that does not present in the request
    for (const chart_code of registered_charts.filter(x => !charts_to_register.includes(x))) {
        const playlist_id = await redis_client.hget(key, chart_code);
        const res = await delete_playlist(user_id, playlist_id);
        if (res.ok) {
            await redis_client.hdel(key, chart_code);
        }
    }
    // new region registration, create new playlist for this region
    for (const chart_code of charts_to_register.filter(x => !registered_charts.includes(x))) {
        const playlist_id = await create_playlist(user_id, chart_code);
        if (playlist_id) {
            // register in database
            await redis_client.hset(`playlists:${user_id}`, [chart_code, playlist_id]);
            //we do not need 'await' for adding tracks, since it could be time consuming
            update_playlist(playlist_id, user_id, chart_code);
        }
    }
    ctx.body = { registered_charts: await redis_client.hkeys(key) };
};

module.exports = {
    '/charts/regions': { GET: get_region_list },
    '/charts': { POST: register_charts },
    '/charts/options': { GET: get_option_list }
};

module.exports.update_playlists_for_all_users = update_playlists_for_all_users;