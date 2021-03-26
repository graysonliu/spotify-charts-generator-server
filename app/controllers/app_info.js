const get_app_info = async (ctx, next) => {
    ctx.body = {
        client_id: process.env.CLIENT_ID,
        scopes: process.env.SCOPES,
        redirect_uri: process.env.REDIRECT_URI
    };
}

module.exports = {
    '/app-info': { GET: get_app_info }
};