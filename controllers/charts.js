const {redis_client} = require('../redis/redis');
const spotify_api = require('../spotify/spotify_api');

const get_region_list = async (ctx, next) => {
    ctx.response.body = await require('../spotify/spotify_chart').regions;
}

const add_tracks_in_chart_to_playlist = async (playlist_id, user_id, region_code) => {
    const tracks = await redis_client.lrange(`chart:${region_code}`, 0, -1);
    // change playlist's details, this also checks whether the playlist still exists
    const response = await spotify_api.web_api(
        `/playlists/${playlist_id}`,
        user_id,
        'PUT',
        {
            description: `Last Update: ${new Date().toUTCString()} | Updated with ${process.env.REDIRECT_URI}`
        }
    );
    if (!response.ok) {
        // this playlist might has been deleted by the user
        // deregister it from database
        await redis_client.hdel(`playlists:${user_id}`, region_code);
        return;
    }
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
}

const update_charts_for_all_users = async () => {
    const user_playlists_key_list = await redis_client.keys('playlists:*');
    for (const key of user_playlists_key_list) {
        const user_id = key.split(':')[0];
        const playlists = await redis_client.hgetall(key);
        for (const [region_code, playlist_id] of Object.entries(playlists)) {
            // to avoid visiting spotify api too fast
            // we wait 1 second between processing playlists
            await new Promise(r => setTimeout(r, 1000));
            await add_tracks_in_chart_to_playlist(playlist_id, user_id, region_code);
        }
    }
}

const register_charts = async (ctx, next) => {
    const regions = await require('../spotify/spotify_chart').regions;
    const user_id = ctx.request.body.user_id;
    const regions_to_register = ctx.request.body.regions_to_register;
    const key = `playlists:${user_id}`;
    const registered_regions = await redis_client.hkeys(key);
    // deregister regions that does not present in the request
    for (const region_code of registered_regions.filter(x => !regions_to_register.includes(x)))
        await redis_client.hdel(key, region_code);
    // new region registration, create new playlist for this region
    for (const region_code of regions_to_register.filter(x => !registered_regions.includes(x))) {
        const playlist_id = (await spotify_api.web_api(
            `/users/${user_id}/playlists`,
            user_id,
            'POST',
            {
                name: `${regions[region_code]} Top 200 Daily`,
                description: `Created and updated with ${process.env.REDIRECT_URL}`
            }
        )).body.id;
        if (playlist_id) {
            // register in database
            await redis_client.hset(`playlists:${user_id}`, [region_code, playlist_id]);
            //we do not need 'await' for adding tracks, since it could be time consuming
            add_tracks_in_chart_to_playlist(playlist_id, user_id, region_code);
        }
    }
    ctx.body = {registered_regions: await redis_client.hkeys(key)};
}

module.exports = {
    '/charts/regions': {GET: get_region_list},
    '/charts': {POST: register_charts}
};

module.exports.update_charts_for_all_users = update_charts_for_all_users;