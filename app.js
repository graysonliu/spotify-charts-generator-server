require('dotenv').config();
const Koa = require('koa');
const logger = require('koa-logger');
const bodyParser = require('koa-bodyparser');
const cors = require('@koa/cors');
const controller = require('./controller');
const spotify_chart = require('./spotify_chart');

const app = new Koa();

// add logger
app.use(logger());
// add cors
app.use(cors());
// add body parser before registering routes of controllers
app.use(bodyParser());
// register controllers
app.use(controller());

spotify_chart.fetch_regions_periodic();
// spotify_chart.fetch_charts_periodic();

app.listen(3000);
console.log('listening at port 3000...');