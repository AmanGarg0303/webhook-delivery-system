import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { initDb } from "./initDb.js";
import subscribeRoutes from "./routes/subscribe.routes.js";
import triggerRoutes from "./routes/trigger.routes.js";
import "./redisConnect.js";
import "./dbConnect.js";

dotenv.config();
const PORT = process.env.PORT || 8000;

const app = express();
app.use(express.json());
app.use(cors());

app.get("/dummy", (req, res) => {
  res.json({ message: "Dummy route test" });
});

app.use("/subscribe", subscribeRoutes);
app.use("/trigger-event", triggerRoutes);

(async () => {
  await initDb();
  app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
  });
})();
