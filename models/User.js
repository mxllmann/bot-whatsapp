// models/User.js
import mongoose from "../config/db.js";

const userSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  phone_hash: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  refresh_token: { type: String, required: true },
  access_token: { type: String },
  expiry_date: { type: Number },
  gpt_context: { type: String, default: 'Você é um assistente gentil, direto, educado e eficiente.' },
});

const User = mongoose.model("User", userSchema);
export default User;
