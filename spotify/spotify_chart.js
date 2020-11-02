const fetch = require('node-fetch');
const cheerio = require('cheerio');
const {redis_client} = require('../redis/redis');
const {update_charts_for_all_users} = require('../controllers/charts')

const fetch_regions = async () => {
    const regions = [];
    const response = await fetch('https://spotifycharts.com/');
    if (!response.ok) {
        throw new Error("Cannot get region list.");
    }
    const body = await response.text();
    const $ = cheerio.load(body);
    const region_list = $('div.responsive-select[data-type=country] ul li');
    for (let i = 0; i < region_list.length; i++) {
        const li = region_list.eq(i);
        regions.push(li.data('value')); // region code
        regions.push(li.text()); // region name
    }
    await redis_client.hset('regions', regions);
    console.log(`${new Date().toUTCString()}: Region list updated.`);

    // in case that region list changed, it should be exported again
    module.exports.regions = await redis_client.hgetall('regions');
};

const fetch_regions_periodic = async () => {
    // update region list daily
    setTimeout(fetch_regions_periodic, 24 * 60 * 60 * 1000);
    await fetch_regions();
}

const fetch_charts = async () => {
    const regions = await redis_client.hgetall('regions');
    for (const [region_code, region_name] of Object.entries(regions)) {
        const tracks = [];
        const chart_url = `https://spotifycharts.com/regional/${region_code}/daily/latest`;
        const chart_res = await fetch(chart_url);
        if (!chart_res.ok) {
            console.log(`${new Date().toUTCString()}: Cannot get chart for ${region_code}`);
            continue;
        }

        const chart_page = await chart_res.text();
        const chart_page_query = cheerio.load(chart_page);
        const track_list = chart_page_query('.chart-table-image a');
        track_list.each(function (i, element) {
            // do not use arrow function here
            // pay attention to 'this' when using arrow function
            tracks.push(chart_page_query(this).attr('href').split('/').pop());
        });

        await redis_client.del(`chart:${region_code}`);
        try {
            await redis_client.rpush(`chart:${region_code}`, tracks);
        } catch (e) {
            console.log(`${new Date().toUTCString()}: Empty chart for ${region_name}`);
        }
        console.log(`${new Date().toUTCString()}: Updated chart for ${region_name}`);
    }
}

const fetch_charts_periodic = async () => {
    // update charts every six hours
    setTimeout(fetch_charts_periodic, 6 * 60 * 60 * 1000);
    await fetch_charts();
    await update_charts_for_all_users();
}

module.exports.fetch_regions_periodic = fetch_regions_periodic;
module.exports.fetch_charts_periodic = fetch_charts_periodic;
module.exports.regions = (async () => (await redis_client.hgetall('regions')))();
