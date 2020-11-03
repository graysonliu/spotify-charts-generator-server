require('dotenv').config();
const Koa = require('koa');
const logger = require('koa-logger');
const bodyParser = require('koa-bodyparser');
const cors = require('@koa/cors');
const controller = require('./controller');
const static = require('koa-static');
const https = require('https');
const fs = require('fs');
const spotify_chart = require('./spotify/spotify_chart');


const app = new Koa();

// add logger
app.use(logger());
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
    process.env.NODE_ENV === 'production' && await spotify_chart.fetch_charts_periodic();
    // const {update_charts_for_all_users} = require('./controllers/charts')
    // await update_charts_for_all_users();
}

update_spotify_charts();

// SSL for HTTPS
fs.copyFileSync('/etc/letsencrypt/live/spotify.zijian.xyz/privkey.pem', './letsencrypt/privkey.pem');
fs.copyFileSync('/etc/letsencrypt/live/spotify.zijian.xyz/cert.pem', './letsencrypt/cert.pem');
fs.copyFileSync('/etc/letsencrypt/live/spotify.zijian.xyz/chain.pem', './letsencrypt/chain.pem');

const options = {
    key: fs.readFileSync('./letsencrypt/privkey.pem'),
    cert: fs.readFileSync('./letsencrypt/cert.pem'),
    ca: fs.readFileSync('./letsencrypt/chain.pem')
};

https.createServer(options, app.callback()).listen(3000);
console.log('listening at port 3000...');