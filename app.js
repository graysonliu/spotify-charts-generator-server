require('dotenv').config();
const Koa = require('koa');
const logger = require('koa-logger');
const bodyParser = require('koa-bodyparser');
const cors = require('@koa/cors');
const controller = require('./controller');
const spotify_chart = require('./spotify_chart');
const {update_charts_for_all_users} = require('./controllers/charts')

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
    // make sure that we fetch charts data after we have latest region list
    process.env.NODE_ENV === 'production' && await spotify_chart.fetch_charts_periodic();
    setTimeout(update_charts_for_all_users, 6 * 60 * 60 * 1000);
    update_charts_for_all_users();
}

update_spotify_charts();

app.listen(3000);
console.log('listening at port 3000...');