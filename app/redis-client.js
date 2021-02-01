const Redis = require("ioredis");
const redis_client = new Redis({
    ...(process.env.DOCKER ? { host: process.env.REDIS_HOST } : {}),
    port: process.env.REDIS_PORT,
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD
});

console.error(process.env.REDIS_USERNAME)

redis_client.on("error", function (error) {
    console.error(error);
});

module.exports.redis_client = redis_client;