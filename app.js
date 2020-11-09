require('dotenv').config();
const Koa = require('koa');
const bodyParser = require('koa-bodyparser');
const cors = require('@koa/cors');
const controller = require('./controller');
const static = require('koa-static');
const https = require('https');
const fs = require('fs');
const spotify_chart = require('./spotify/spotify_chart');
const {koa_logger} = require('./logs/logger')

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
// app.use(static('./letsencrypt', {hidden: true})); // server static files
// app.listen(80);

const update_spotify_charts = async () => {
    await spotify_chart.fetch_regions_periodic();
    isProduction && await spotify_chart.fetch_charts_periodic();
}

update_spotify_charts();

if (isProduction) {
    // SSL for HTTPS
    const options = {
        key: fs.readFileSync('/etc/letsencrypt/live/spotify.zijian.xyz/privkey.pem'),
        cert: fs.readFileSync('/etc/letsencrypt/live/spotify.zijian.xyz/cert.pem'),
        ca: fs.readFileSync('/etc/letsencrypt/live/spotify.zijian.xyz/chain.pem')
    };

    https.createServer(options, app.callback()).listen(3000);
} else {
    app.listen(3000);
}

console.log('listening at port 3000...');