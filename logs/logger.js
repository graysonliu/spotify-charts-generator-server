const koa_logger = require('koa-logger');
const stripAnsi = require('strip-ansi');
const {createLogger, format, transports} = require('winston');
const fs = require('fs');

const isProduction = process.env.NODE_ENV === 'production';

const winston_logger = createLogger({
    level: 'info',
    format: format.combine(
        format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        format.errors({stack: true}),
        format.splat(),
        format.json()
    ),
    // defaultMeta: {service: 'spotify-charts-generator-server'},
    transports: [
        new transports.File({filename: './logs/winston-error.log', level: 'error'}),
        new transports.File({filename: './logs/winston-combined.log'})
    ]
});

module.exports.logger = winston_logger;

module.exports.koa_logger = koa_logger(({
    transporter: (str, args) => {
        !isProduction && console.log(str);
        // using strip-ansi to remove chalk style from the string
        const s = `${new Date().toUTCString()}: ${stripAnsi(str)}\n`;
        fs.writeFile('./logs/http_req_res.log', s, {flag: 'a'}, err => {
            if (err) {
                console.log(err);
            }
        });
    }
}));