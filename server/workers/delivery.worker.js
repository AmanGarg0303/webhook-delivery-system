import redis from "../redisConnect.js";
import axios from "axios";

const STREAM_NAME = "webhook:deliveries";
const GROUP = "delivery-workers";
const CONSUMER = `worker-${process.pid}`;
const DLQ_STREAM = "webhook:dlq";

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function deliverWebhook({ webhook_url, payload }) {
  return axios.post(webhook_url, payload, {
    timeout: 5000,
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Webhook-Delivery-System",
    },
    validateStatus: () => true,
  });
}

async function init() {
  try {
    await redis.xgroup("CREATE", STREAM_NAME, GROUP, "0", "MKSTREAM");
  } catch (error) {
    if (!error.message.includes("BUSYGROUP")) {
      throw error;
    }
  }

  console.log("Worker started: ", CONSUMER);
  while (true) {
    const response = await redis.xreadgroup(
      "GROUP",
      GROUP,
      CONSUMER,
      "BLOCK",
      5000,
      "COUNT",
      1,
      "STREAMS",
      STREAM_NAME,
      ">"
    );

    if (!response) continue;

    const [, messages] = response[0];

    for (const [id, fields] of messages) {
      console.log("Received job:", fields);

      const job = Object.fromEntries(
        fields.reduce((acc, cur, i) => {
          if (i % 2 == 0) acc.push([cur, fields[i + 1]]);
          return acc;
        }, [])
      );

      console.log("JOB:", job);

      const attempt = Number(job.attempt);
      const payload = JSON.parse(job.payload);

      try {
        const res = await deliverWebhook({
          webhook_url: job.webhook_url,
          payload,
        });

        if (res.status >= 200 && res.status < 300) {
          console.log("Delivered:", job.subscription_id);
          await redis.xack(STREAM_NAME, GROUP, id);
          continue;
        }

        throw new Error(`Non 2xx status ${res.status}`);
      } catch (error) {
        if (attempt + 1 >= MAX_RETRIES) {
          console.log(
            "Delivery failed permanently:",
            job.subscription_id,
            error.message
          );

          await redis.xadd(
            DLQ_STREAM,
            "*",
            ...Object.entries({
              ...job,
            }),
            "last_error",
            error.message,
            "failed_at",
            new Date().toISOString()
          );

          await redis.xack(STREAM_NAME, GROUP, id);
          continue;
        }

        // Exponential backoff
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        console.log(
          `Retrying ${job.subscription_id} in ${delay}ms (attempt ${
            attempt + 1
          })`
        );

        await sleep(delay);
        await redis.xadd(
          STREAM_NAME,
          "*",
          ...Object.entries({
            ...job,
            attempt: String(attempt + 1),
          }).flat()
        );

        await redis.xack(STREAM_NAME, GROUP, id);
      }
    }
  }
}

init();
