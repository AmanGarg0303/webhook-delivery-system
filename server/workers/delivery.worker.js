import redis from "../redisConnect.js";

const STREAM_NAME = "webhook:deliveries";
const GROUP = "delivery-workers";
const CONSUMER = `worker-${process.pid}`;

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

      // Ack for now
      await redis.xack(STREAM_NAME, GROUP, id);
    }
  }
}

init();
