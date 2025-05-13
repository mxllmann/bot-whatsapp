// db.js
import '../waitForMongo.js'
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const mongoURI = process.env.MONGO_URI;
//  const mongoURI = 'mongodb://localhost:27017/gpt_assistente'

mongoose
  .connect(mongoURI)
  .then(() => console.log("✅ Conectado ao MongoDB!"))
  .catch((err) => console.error("Erro ao conectar:", err));

export default mongoose;
