import express from "express";
import { triggerEvent } from "../services/event.service.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { app_id, event, payload } = req.body;

    if (!app_id || !event || !payload) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const result = await triggerEvent({
      appId: app_id,
      event: event,
      payload: payload,
    });

    res.status(202).json({
      message: "Event queued",
      ...result,
    });
  } catch (error) {
    console.log("Trigger error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
