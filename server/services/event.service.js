import pool from "../dbConnect.js";
import redis from "../redisConnect.js";
import { randomUUID } from "crypto";

const STREAM_NAME = "webhook:deliveries";

const getRedisKey = (appId, event) => `subs:${appId}:${event}`;

export async function triggerEvent({ appId, event, payload }) {
  const eventId = `evt_${randomUUID()}`;
  let subscribers = await redis.lrange(getRedisKey(appId, event), 0, -1);

  if (subscribers.length == 0) {
    const result = await pool.query(
      `
            SELECT id, webhook_url 
            FROM subscriptions 
            WHERE app_id = $1 AND event = $2
            `,
      [appId, event]
    );

    subscribers = result.rows.map((row) => {
      const data = {
        subscription_id: row.id,
        webhook_url: row.webhook_url,
      };
      redis.rpush(getRedisKey(appId, event), JSON.stringify(data));
      return JSON.stringify(data);
    });
  }

  for (const sub of subscribers) {
    const parsed = JSON.parse(sub);

    await redis.xadd(
      STREAM_NAME,
      "*",
      "delivery_id",
      randomUUID(),
      "event_id",
      eventId,
      "app_id",
      appId,
      "event",
      event,
      "subscription_id",
      parsed.subscription_id,
      "webhook_url",
      parsed.webhook_url,
      "payload",
      JSON.stringify(payload),
      "attempt",
      "0"
    );
  }

  return { event_id: eventId, deliveries: subscribers.length };
}
