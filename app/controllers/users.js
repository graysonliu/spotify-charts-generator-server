const spotify_api = require('../spotify/spotify_api');
const {redis_client} = require('../redis-client');

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
        registered_charts: await redis_client.hkeys(`playlists:${id}`)
    };
};

module.exports = {
    '/users': {GET: get_user_info}
};