import express from "express";
import { createSubscription } from "../services/subscription.service.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { app_id, event, webhook_url } = req.body;
    if (!app_id || !event || !webhook_url) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const subscription = await createSubscription({
      appId: app_id,
      event: event,
      webhookUrl: webhook_url,
    });

    res.status(201).json({ message: "Subscription created", subscription });
  } catch (error) {
    console.log("Subscribe error:", error);
    res.status(500).json({ error: "Internal server erorr." });
  }
});

export default router;
