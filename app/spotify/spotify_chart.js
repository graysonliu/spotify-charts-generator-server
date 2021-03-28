const fetch = require('node-fetch');
const cheerio = require('cheerio');
const { redis_client } = require('../redis-client');
const { logger } = require('../logger');

const fetch_charts_metadata = async () => {
    try {
        const response = await fetch('https://spotifycharts.com');
        if (!response.ok) {
            throw (`HTTP Code: ${response.status}`);
        }
        const body = await response.text();
        const $ = cheerio.load(body);

        // get chart types (currently "TOP 200" and "VIRAL 50")
        const chart_types = [];
        const chart_types_html_list = $('ul.chart-page li a');
        for (let i = 0; i < chart_types_html_list.length; i++) {
            chart_types.push(chart_types_html_list.eq(i).attr('href').replace(/\//g, ''));
            chart_types.push(chart_types_html_list.eq(i).text().toUpperCase());
        }
        await redis_client.del('chart_types');
        await redis_client.hset('chart_types', chart_types);

        // get chart recurrence (currently "DAILY" and "WEEKLY")
        const chart_recurrences = [];
        const chart_recurrence_html_list = $('div.responsive-select[data-type=recurrence] ul li');
        for (let i = 0; i < chart_recurrence_html_list.length; i++) {
            chart_recurrences.push(chart_recurrence_html_list.eq(i).data('value'));
            chart_recurrences.push(chart_recurrence_html_list.eq(i).text().toUpperCase());
        }
        await redis_client.del('chart_recurrences');
        await redis_client.hset('chart_recurrences', chart_recurrences);

        // assemble all chart options
        const chart_options = [];
        for (const [type_key, type_text] of Object.entries(await redis_client.hgetall('chart_types'))) {
            for (const [recurrence_key, recurrence_text] of Object.entries(await redis_client.hgetall('chart_recurrences'))) {
                chart_options.push(`${type_key}-${recurrence_key}`);
                chart_options.push(`${type_text} ${recurrence_text}`);
                // add new entry options
                chart_options.push(`${type_key}-${recurrence_key}-new`);
                chart_options.push(`${type_text} ${recurrence_text} NEW ENTRY`);
            }
        }
        await redis_client.del('chart_options');
        await redis_client.hset('chart_options', chart_options);

        // get region list
        const regions = [];
        const region_html_list = $('div.responsive-select[data-type=country] ul li');
        for (let i = 0; i < region_html_list.length; i++) {
            const li = region_html_list.eq(i);
            regions.push(li.data('value')); // region code
            regions.push(li.text()); // region name
        }
        await redis_client.del('regions');
        await redis_client.hset('regions', regions);

        logger.info('Charts metadata updated.');

        // in case that charts metadata changed, we should export these information again
        module.exports.regions = await redis_client.hgetall('regions');
        module.exports.charts_options = await redis_client.hgetall('charts_options');
    }
    catch (e) {
        console.error(e);
        logger.error("Cannot update charts metadata.");
    }
};

const fetch_charts_metadata_periodic = async () => {
    // update chart metadata daily
    setTimeout(fetch_charts_metadata_periodic, 24 * 60 * 60 * 1000);
    await fetch_charts_metadata();
};

const fetch_chart = async (chart_key) => {
    if (await redis_client.exists(`chart:${chart_key}`)) {
        return await redis_client.lrange(`chart:${chart_key}`, 0, -1);
    }

    const [region_code, chart_type, chart_recurrence] = chart_key.split('-', 3);
    const chart_url = `https://spotifycharts.com/${chart_type}/${region_code}/${chart_recurrence}`;
    const tracks = [];
    const chart_res = await fetch(chart_url);
    if (!chart_res.ok) {
        logger.error(`Cannot get chart for ${chart_key}`);
        return tracks;
    }

    const chart_page = await chart_res.text();
    const $ = cheerio.load(chart_page);
    const tracks_html_list = $('.chart-table-image a');
    tracks_html_list.each(function (i, element) {
        // do not use arrow function here
        // pay attention to 'this' when using arrow function
        tracks.push($(this).attr('href').split('/').pop());
    });

    await redis_client.del(`chart:${chart_key}`);
    try {
        await redis_client.rpush(`chart:${chart_key}`, tracks);
        // set expire, 1 hour for daily charts, 12 hours for weekly charts
        if (chart_recurrence === 'daily') {
            await redis_client.expire(`chart:${chart_key}`, 1 * 60 * 60);
        }
        else if (chart_recurrence === 'weekly')
            await redis_client.expire(`chart:${chart_key}`, 12 * 60 * 60);
    } catch (e) {
        logger.info(`Empty chart for ${chart_key}`);
    }
    logger.info(`Updated chart for ${chart_key}`);
    return await redis_client.lrange(`chart:${chart_key}`, 0, -1);
};

module.exports.fetch_charts_metadata_periodic = fetch_charts_metadata_periodic;
module.exports.fetch_chart = fetch_chart;
module.exports.regions = (async () => (await redis_client.hgetall('regions')))();
module.exports.charts_options = (async () => (await redis_client.hgetall('charts_options')))();
