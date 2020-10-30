const fetch = require('node-fetch');
const cheerio = require('cheerio');
const {redis_client} = require('./redis/redis');

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
    // module.exports.regions = await redis_client.hgetall('regions');
};

const fetch_regions_periodic = () => {
    fetch_regions();
    // update region list daily
    setTimeout(fetch_regions_periodic, 24 * 60 * 60 * 1000);
}

const fetch_charts = async () => {
    const charts = [];
    const response = await fetch('https://spotifycharts.com/');
    if (!response.ok) {
        throw new Error("Cannot get country list.");
    }
    const body = await response.text();
    const $ = cheerio.load(body);
    const country_list = $('div.responsive-select[data-type=country] ul li');
    for (let i = 0; i < country_list.length; i++) {
        const li = country_list.eq(i);
        const country_code = li.data('value');
        const country_name = li.text();
        const tracks = []
        // const chart_url = `https://spotifycharts.com/regional/${country_code}/daily/latest`
        // const chart_res = await fetch(chart_url);
        // if (!chart_res.ok) {
        //     console.log(`Cannot get chart for ${country_name}`);
        //     continue
        // }
        // const chart_page = await chart_res.text();
        // const chart_page_query = cheerio.load(chart_page);
        // const track_list = chart_page_query('.chart-table-image a');
        // track_list.each(function (i, element) {
        //     // do not use arrow function here
        //     // pay attention to 'this' when using arrow function
        //     tracks.push(chart_page_query(this).attr('href').split('/').pop());
        // })
        // console.log(`${country_name} Done`);
        charts.push([country_code, country_name, tracks]);
    }
    return charts;
}
module.exports.fetch_regions_periodic = fetch_regions_periodic;
module.exports.regions = (async () => (await redis_client.hgetall('regions')))();
