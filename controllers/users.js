const spotify_api = require('../spotify_api');
const {redis_client} = require('../redis/redis');

const get_user_info = async (ctx, next) => {
    const code = ctx.query.code;
    const auth_res = await spotify_api.auth(code, false);
    if (!auth_res.ok) {
        ctx.status = auth_res.status;
        ctx.body = auth_res.body;
        return;
    }
    const response = await spotify_api.web_api_me(auth_res.body);
    if (!response.ok) {
        ctx.status = auth_res.status;
        ctx.body = auth_res.body;
        return;
    }
    const {display_name, id} = response.body;
    ctx.body = {
        user_name: display_name,
        user_id: id,
        registered_regions: await redis_client.hkeys(`${id}:playlists`)
    };
}

module.exports = {
    '/users': {GET: get_user_info}
};