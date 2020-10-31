const spotify_api = require('../spotify_api');
const {redis_client} = require('../redis/redis');

const get_user_info = async (ctx, next) => {
    const code = ctx.query.code;
    const auth_data = await spotify_api.auth(code, false);
    const {display_name, id} = await spotify_api.web_api('/me', auth_data.refresh_token);
    await redis_client.hset('refresh_tokens', [id, auth_data.refresh_token]);
    ctx.response.body = {
        user_name: display_name,
        user_id: id,
        registered_regions: await redis_client.hkeys(`${id}:playlists`)
    };
}

module.exports = {
    '/users': {GET: get_user_info}
};