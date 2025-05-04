import crypto from 'crypto';

export function hashPhone(phone) {
  const secret = process.env.SALT_SECRET || 'saltpadrao';
  return crypto.createHmac('sha256', secret).update(phone).digest('hex');
}
