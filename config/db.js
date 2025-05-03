// db.js
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const mongoURI = process.env.MONGO_URI;

mongoose
  .connect(mongoURI)
  .then(() => console.log("✅ Conectado ao MongoDB!"))
  .catch((err) => console.error("Erro ao conectar:", err));

export default mongoose;
