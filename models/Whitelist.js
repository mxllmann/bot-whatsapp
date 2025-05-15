import mongoose from '../config/db.js';

const whitelistSchema = new mongoose.Schema({
  email_hash: { type: String, required: true, unique: true }
});

const Whitelist = mongoose.model('Whitelist', whitelistSchema);
export default Whitelist;
