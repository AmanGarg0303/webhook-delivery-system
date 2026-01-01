import redis from "../redisConnect.js";
import axios from "axios";
import crypto from "crypto";

const STREAM_NAME = "webhook:deliveries";
const GROUP = "delivery-workers";
const CONSUMER = `worker-${process.pid}`;
const DLQ_STREAM = "webhook:dlq";
const DELIVERED_PREFIX = "delivered:";

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;
const DELIVERED_TTL_SECONDS = 24 * 60 * 60; // 24 hours
const MAX_BACKOFF_MS = 1000 * 60; // 1 min

async function isAlreadyDelivered({ delivery_id }) {
  return redis.exists(`${DELIVERED_PREFIX}${delivery_id}`);
}

async function markDelivered({ delivery_id }) {
  await redis.set(
    `${DELIVERED_PREFIX}${delivery_id}`,
    "1",
    "EX",
    DELIVERED_TTL_SECONDS
  );
}

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

function signPayload(payload, secret) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function getBackoffDelay(attempt) {
  const maxDelay = Math.min(
    BASE_DELAY_MS * Math.pow(2, attempt),
    MAX_BACKOFF_MS
  );
  return Math.floor(Math.random() * maxDelay);
}

async function deliverWebhook({
  webhook_url,
  secret,
  event_id,
  delivery_id,
  subscription_id,
  payload,
}) {
  const payloadString = JSON.stringify(payload);
  const signature = signPayload(payloadString, secret);

  return axios.post(webhook_url, payload, {
    timeout: 5000,
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Webhook-Delivery-System",
      "x-webhook-signature": `sha256=${signature}`,
      "x-event-id": event_id,
      "x-delivery-id": delivery_id,
      "x-subscription-id": subscription_id,
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
        // dedupe check
        if (await isAlreadyDelivered({ delivery_id: job.delivery_id })) {
          console.log("Skipping already delivered webhook:", job.delivery_id);
          await redis.xack(STREAM_NAME, GROUP, id);
          continue;
        }

        const res = await deliverWebhook({
          webhook_url: job.webhook_url,
          secret: job.secret,
          delivery_id: job.delivery_id,
          event_id: job.event_id,
          subscription_id: job.subscription_id,
          payload,
        });

        if (res.status >= 200 && res.status < 300) {
          console.log("Delivered:", job.subscription_id);
          await markDelivered({ delivery_id: job.delivery_id });
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
        const delay = getBackoffDelay(attempt);
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
