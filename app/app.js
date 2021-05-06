const Koa = require('koa');
const bodyParser = require('koa-bodyparser');
const cors = require('@koa/cors');
const controller = require('./controller');
const static = require('koa-static');
const https = require('https');
const fs = require('fs');
const { koa_logger } = require('./logger');
const { update_playlists_for_all_users } = require('./controllers/charts');
const { fetch_charts_metadata_periodic } = require('./spotify/spotify_chart');

const app = new Koa();
const isProduction = process.env.NODE_ENV === 'production';

// add koa logger
app.use(koa_logger);
// add cors
app.use(cors());
// add body parser before registering routes of controllers
app.use(bodyParser());
// register controllers
app.use(controller());

// for certbot
// app.use(static('./letsencrypt', {hidden: true})); // serve static files, including hidden files (name starts with a '.')
// app.listen(80);

const update_playlists_for_all_users_periodic = async () => {
    setTimeout(update_playlists_for_all_users_periodic, 6 * 60 * 60 * 1000);
    await update_playlists_for_all_users();
};

const init_tasks = async () => {
    // get charts metadata first
    await fetch_charts_metadata_periodic();
    update_playlists_for_all_users_periodic();
};

init_tasks();

let options = {};

// SSL for HTTPS
try {
    // when running in the container, SSL certificates is in local directory
    options = {
        key: fs.readFileSync('./certificates/live/spotify.zijian.xyz/privkey.pem'),
        cert: fs.readFileSync('./certificates/live/spotify.zijian.xyz/cert.pem')
    };
}
catch {
    // outside of the container
    options = {
        key: fs.readFileSync('/etc/letsencrypt/live/spotify.zijian.xyz/privkey.pem'),
        cert: fs.readFileSync('/etc/letsencrypt/live/spotify.zijian.xyz/cert.pem')
    };
}

https.createServer(options, app.callback()).listen(3000);


console.log('listening at port 3000...');