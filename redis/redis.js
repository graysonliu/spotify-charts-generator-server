const Redis = require("ioredis");
const redis_client = new Redis(process.env.REDIS_PORT);

redis_client.on("error", function (error) {
    console.error(error);
});

module.exports.redis_client = redis_client;