import express from "express";
import crypto from "crypto";

const app = express();
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf.toString("utf8");
    },
  })
);

const PORT = 4001;

function verifySignature(rawBody, signature, secret) {
  if (!signature || !secret) return false;
  const received = signature.replace("sha256=", "");
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(received, "hex")
  );
}

// sub_id: secret
const WEBHOOK_SECRETS = {
  "4a8f34a6-4480-4aca-8aca-2d57315fe9b6":
    "2ded564ac1a6abdda3a4c058d98b70ec7ea316953ccc3e51217a49b05fed836f",
};

app.post("/webhook", (req, res) => {
  console.log("webhhook received");
  console.log("Headers: ", req.headers);
  console.log("Body:", JSON.stringify(req.body, null, 2));

  const signature = req.headers["x-webhook-signature"];
  const subscriptionId = req.headers["x-subscription-id"];
  const secret = WEBHOOK_SECRETS[subscriptionId];

  if (!secret) {
    console.error("Unknown subscription:", subscriptionId);
    return res.status(401).json({ error: "Unknown subscription" });
  }

  const isValid = verifySignature(req.rawBody, signature, secret);
  if (!isValid) {
    console.error("Invalid signature");
    return res.status(401).json({ error: "Invalid signature." });
  }

  console.log("✅ Webhook verified");

  if (Math.random() < 0.5) {
    console.warn("Simulating failure");
    return res.status(500).json({ error: "Temporary failure" });
  }

  console.log("✅ Webhook success");
  res.status(200).json({ received: true });
});

app.listen(PORT, () => {
  console.log(`Server listening on PORT ${PORT}`);
});
