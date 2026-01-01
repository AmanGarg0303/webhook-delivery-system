import pool from "../dbConnect.js";
import redis from "../redisConnect.js";

const getRedisKey = (appId, event) => `subs:${appId}:${event}`;

export async function createSubscription({ appId, event, webhookUrl }) {
  const result = await pool.query(
    `
        INSERT INTO subscriptions (app_id, event, webhook_url) 
        VALUES ($1, $2, $3) 
        RETURNING id, app_id, event, webhook_url, secret
    `,
    [appId, event, webhookUrl]
  );

  const subscription = result.rows[0];
  const redisKey = getRedisKey(appId, event);

  await redis.rpush(
    redisKey,
    JSON.stringify({
      subscription_id: subscription.id,
      webhook_url: subscription.webhook_url,
      secret: subscription.secret,
    })
  );

  return subscription;
}
