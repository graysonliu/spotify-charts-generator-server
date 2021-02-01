const koa_logger = require('koa-logger');
const stripAnsi = require('strip-ansi');
const {createLogger, format, transports} = require('winston');
require('winston-daily-rotate-file');
const fs = require('fs');

const isProduction = process.env.NODE_ENV === 'production';

const formatDate = (date) => {
    // YYYY-MM-DD
    return `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`;
}

const winston_logger = createLogger({
    level: 'info',
    format: format.combine(
        format.timestamp(),
        format.errors({stack: true}),
        format.splat(),
        format.json()
    ),
    // defaultMeta: {service: 'spotify-charts-generator-server'},
    transports: [
        new transports.File({filename: './logs/winston_logs/winston-errors.log', level: 'error'}),
        new transports.DailyRotateFile({
            filename: 'winston-%DATE%.log',
            dirname: './logs/winston_logs',
            datePattern: 'YYYY-MM-DD',
            maxFiles: '14d',
            utc: true
        })
    ]
});

module.exports.logger = winston_logger;

fs.mkdirSync('./logs/koa_http_logs', {recursive: true});
module.exports.koa_logger = koa_logger(({
    transporter: (str, args) => {
        !isProduction && console.log(str);
        // using strip-ansi to remove chalk style from the string
        const date = new Date();
        const s = `${date.toISOString()}: ${stripAnsi(str)}\n`;
        fs.writeFile(`./logs/koa_http_logs/koa-${formatDate(date)}.log`, s, {flag: 'a'}, err => {
            if (err) {
                console.log(err);
            }
        });
    }
}));