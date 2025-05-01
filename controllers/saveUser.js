// controllers/saveUser.js
import User from '../models/User.js';

export async function saveOrUpdateUser({ phone, email, tokens, gpt_context = {} }) {
  const { refresh_token, access_token, expiry_date } = tokens;

  const existingUser = await User.findOne({ phone });

  if (existingUser) {
    existingUser.email = email;
    existingUser.refresh_token = refresh_token;
    existingUser.access_token = access_token;
    existingUser.expiry_date = expiry_date;
    existingUser.gpt_context = { ...existingUser.gpt_context.toObject(), ...gpt_context };
    await existingUser.save();
    return existingUser;
  } else {
    const newUser = new User({
      phone,
      email,
      refresh_token,
      access_token,
      expiry_date,
      gpt_context
    });
    await newUser.save();
    return newUser;
  }
}
