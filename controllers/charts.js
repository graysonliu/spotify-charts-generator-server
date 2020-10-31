const {redis_client} = require('../redis/redis');
const spotify_api = require('../spotify_api');

const get_region_list = async (ctx, next) => {
    ctx.response.body = await require('../spotify_chart').regions;
}

const create_user_charts = async (ctx, next) => {
    const regions = await require('../spotify_chart').regions;
    const user_id = ctx.request.body.user_id;
    const regions_to_register = new Set(ctx.request.body.regions);
    const key = `${user_id}:playlists`;
    const registered_regions = new Set(await redis_client.hkeys(key));
    for (const region_code of regions_to_register) {
        if (!registered_regions.has(region_code)) {
            // new region registration, create new playlist for this region
            const playlist_id = (await spotify_api.web_api(
                `/users/${user_id}/playlists`,
                await redis_client.hget('refresh_tokens', user_id),
                'POST',
                {
                    name: `${regions[region_code]} Top 200 Daily`,
                    description: `Created and updated with ${process.env.REDIRECT_URL}`
                }
            )).id;
            if (playlist_id) {
                await redis_client.hset(`${user_id}:playlists`, [region_code, playlist_id]);
                // add tracks to the newly created playlist
                const tracks = await redis_client.lrange(`${region_code}:chart`, 0, -1);
                // we can only add 100 tracks per request
                if (tracks.length > 0)
                    await spotify_api.web_api(
                        `/playlists/${playlist_id}/tracks`,
                        await redis_client.hget('refresh_tokens', user_id),
                        'POST',
                        {
                            uris: tracks.slice(0, 100).map((uri) => `spotify:track:${uri}`)
                        }
                    );
                if (tracks.length > 100)
                    await spotify_api.web_api(
                        `/playlists/${playlist_id}/tracks`,
                        await redis_client.hget('refresh_tokens', user_id),
                        'POST',
                        {
                            uris: tracks.slice(100, 200).map((uri) => `spotify:track:${uri}`)
                        }
                    );
            }
        }
    }
    ctx.body = await redis_client.hgetall(key);
}

module.exports = {
    '/charts/regions': {GET: get_region_list},
    '/charts': {POST: create_user_charts}
};