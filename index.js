import dotenv from "dotenv";
dotenv.config();

import express from "express";
import "./config/db.js"; // ← mongoose.connect()
import { client } from "./services/whatsappService.js";
import routes from "./routes/index.js";

console.log(process.env.MONGO_URI);

const app = express();
app.use(express.json());
app.use("/", routes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));

client.initialize();
