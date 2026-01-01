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
  "981a43dc-b803-4a3e-986f-271660833f4f":
    "823a5a21e4b4d28ab315063b8c7a4406a13bcb506838a80c8177b8bc5c82ad60",
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
