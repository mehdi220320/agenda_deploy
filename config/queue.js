const { Queue } = require("bullmq");
const IORedis = require("ioredis");

const connection = new IORedis(process.env.UPSTASH_REDIS_URL);

const alarmQueue = new Queue("alarm-queue", { connection });

module.exports = { alarmQueue, connection };