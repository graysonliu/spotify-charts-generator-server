require('dotenv').config();
const Koa = require('koa');
const logger = require('koa-logger');
const bodyParser = require('koa-bodyparser');
const cors = require('@koa/cors');
const controller = require('./controller');
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

const update_spotify_charts = async () => {
    await spotify_chart.fetch_regions_periodic();
    process.env.NODE_ENV === 'production' && await spotify_chart.fetch_charts_periodic();
}

update_spotify_charts();

app.listen(3000);

// for HTTPS
// const https = require('https');
// const fs = require('fs');
// const options = {
//     key: fs.readFileSync('key.pem'),
//     cert: fs.readFileSync('cert.pem')
// };
//
// https.createServer(options, app.callback()).listen(3000);
console.log('listening at port 3000...');