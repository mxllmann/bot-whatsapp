// models/InteractionLog.js
import mongoose from '../config/db.js';

const logSchema = new mongoose.Schema({
  phone_hash: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  user_message: { type: String, required: true },
  bot_response: { type: String },
  command: { type: String },
  user_prompt: { type: String },
  events_founded: { type: mongoose.Schema.Types.Mixed },
  gpt_completion: { type: String },
  user_choice: { type: String },
  user_changes: { type: mongoose.Schema.Types.Mixed },
  new_event: { type: mongoose.Schema.Types.Mixed },
  contexto: { type: mongoose.Schema.Types.Mixed },
});

const InteractionLog = mongoose.model('InteractionLog', logSchema, 'interactionLog');
export default InteractionLog;
