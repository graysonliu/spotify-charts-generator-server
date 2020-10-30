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
        // console.log(region_code);
        // console.log(regions);
        // console.log(regions[region_code]);
        if (!registered_regions.has(region_code)) {
            // new region registration, create new playlist for this region
            spotify_api.web_api(
                `/users/${user_id}/playlists`,
                await redis_client.hget('refresh_tokens', user_id),
                'POST',
                {
                    name: `${regions[region_code]} Top 200 Daily`,
                    description: `Created with ${process.env.REDIRECT_URL}`
                }
            )
        }
    }
    ctx.response.body = 'null';
}

module.exports = {
    '/charts/regions': {GET: get_region_list},
    '/charts': {POST: create_user_charts}
};