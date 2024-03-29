const fetch = require('node-fetch');
const cheerio = require('cheerio');
const { redis_client } = require('../redis-client');
const { winston_logger } = require('../logger');

const fetch_from_spotifycharts = async (path) => {
    const url = 'https://spotifycharts.com';
    return await fetch(`${url}${path}`,
        {
            headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64)' }
        });
};

const fetch_charts_metadata = async () => {
    try {
        const response = await fetch_from_spotifycharts('/regional');
        if (!response.ok) {
            throw (`Failure when fetching metadata form spotifycharts.com, HTTP Code: ${response.status}`);
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

        winston_logger.info('Charts metadata updated.');
    }
    catch (e) {
        console.error(e);
        winston_logger.error("Cannot update charts metadata.");
    }
};

const fetch_charts_metadata_periodic = async () => {
    // update chart metadata daily
    setTimeout(fetch_charts_metadata_periodic, 24 * 60 * 60 * 1000);
    await fetch_charts_metadata();
};

const fetch_chart = async (chart_code) => {
    if (await redis_client.exists(`chart:${chart_code}`)) {
        return await redis_client.lrange(`chart:${chart_code}`, 0, -1);
    }

    const [region_code, type_code, chart_recurrence] = chart_code.split('-', 3);
    const chart_path = `/${type_code}/${region_code}/${chart_recurrence}`;
    const chart_res = await fetch_from_spotifycharts(chart_path);
    if (!chart_res.ok) {
        winston_logger.error(`Cannot get chart for ${chart_code}`);
        return [];
    }

    const tracks_full = [];
    const tracks_new = [];

    const chart_page = await chart_res.text();
    const $ = cheerio.load(chart_page);
    const tracks_html_list = $('.chart-table tbody tr');
    tracks_html_list.each((i, element) => {
        const track_id = $(element).find('.chart-table-image a').attr('href').split('/').pop();
        tracks_full.push(track_id);

        if ($(element).find('.chart-table-trend__icon circle').length !== 0) {
            tracks_new.push(track_id);
        }
    });

    const chart_code_full = `${region_code}-${type_code}-${chart_recurrence}`;
    const chart_code_new = `${region_code}-${type_code}-${chart_recurrence}-new`;

    // await redis_client.del(`chart:${chart_code_full}`);
    // await redis_client.del(`chart:${chart_code_new}`);

    try {
        await redis_client.rpush(`chart:${chart_code_full}`, tracks_full);
        // set expire, 1 hour for daily charts, 12 hours for weekly charts
        if (chart_recurrence === 'daily') {
            await redis_client.expire(`chart:${chart_code_full}`, 1 * 60 * 60);
        }
        else if (chart_recurrence === 'weekly') {
            await redis_client.expire(`chart:${chart_code_full}`, 12 * 60 * 60);
        }
    } catch (e) {
        winston_logger.info(`Empty chart for ${chart_code_full}`);
    }

    try {
        await redis_client.rpush(`chart:${chart_code_new}`, tracks_new);
        // set expire, 1 hour for daily charts, 12 hours for weekly charts
        if (chart_recurrence === 'daily') {
            await redis_client.expire(`chart:${chart_code_new}`, 1 * 60 * 60);
        }
        else if (chart_recurrence === 'weekly') {
            await redis_client.expire(`chart:${chart_code_new}`, 12 * 60 * 60);
        }
    } catch (e) {
        winston_logger.info(`Empty chart for ${chart_code_new}`);
    }

    winston_logger.info(`Updated chart for ${chart_code_full} and ${chart_code_new}`);
    return await redis_client.lrange(`chart:${chart_code}`, 0, -1);
};

module.exports.fetch_charts_metadata_periodic = fetch_charts_metadata_periodic;
module.exports.fetch_chart = fetch_chart;
