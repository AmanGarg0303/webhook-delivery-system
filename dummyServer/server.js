import express from "express";

const app = express();
app.use(express.json());

const PORT = 4001;

app.post("/webhook", (req, res) => {
  console.log("webhhook received");
  console.log("Headers: ", req.headers);
  console.log("Body:", JSON.stringify(req.body, null, 2));

  res.status(200).json({ received: true });
});

app.listen(PORT, () => {
  console.log(`Server listening on PORT ${PORT}`);
});
