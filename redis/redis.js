const Redis = require("ioredis");
const redis_client = new Redis({
    port: process.env.REDIS_PORT,
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD
});

redis_client.on("error", function (error) {
    console.error(error);
});

module.exports.redis_client = redis_client;