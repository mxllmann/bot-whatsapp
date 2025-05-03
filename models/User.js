// models/User.js
import mongoose from "../config/db.js";

const userSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  refresh_token: { type: String, required: true },
  access_token: { type: String },
  expiry_date: { type: Number },
  gpt_context: {
    idioma: { type: String, default: "pt-BR" },
    estilo: { type: String, default: "respostas curtas" },
    tom: { type: String, default: "informal" },
    foco: { type: String, default: "organização da agenda" },
  },
});

const User = mongoose.model("User", userSchema);
export default User;
