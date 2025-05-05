// controllers/saveUser.js
import User from '../models/User.js';
import { encrypt, decrypt } from '../utils/cryptoUtils.js';
import { hashPhone } from '../utils/hashUtils.js';

export async function saveOrUpdateUser({ phone, email, tokens, gpt_context }) {
  const phoneHash = hashPhone(phone);
  const encryptedPhone = encrypt(phone);
  const encryptedEmail = encrypt(email);
  const encryptedAccessToken = encrypt(tokens.access_token || '');
  const encryptedRefreshToken = encrypt(tokens.refresh_token);
  const expiryDate = tokens.expiry_date || null;

  const existing = await User.findOne({ phone_hash: phoneHash });

  const encryptedContext = encrypt(
    gpt_context || (existing?.gpt_context ? decrypt(existing.gpt_context) : 'Você é um assistente educado e prestativo.')
  );

  if (existing) {
    existing.email = encryptedEmail;
    existing.access_token = encryptedAccessToken;
    existing.refresh_token = encryptedRefreshToken;
    existing.expiry_date = expiryDate;
    existing.gpt_context = encryptedContext;
    return await existing.save();
  }

  const user = new User({
    phone: encryptedPhone,
    phone_hash: phoneHash,
    email: encryptedEmail,
    access_token: encryptedAccessToken,
    refresh_token: encryptedRefreshToken,
    expiry_date: expiryDate,
    gpt_context: encryptedContext,
  });

  return await user.save();
}
