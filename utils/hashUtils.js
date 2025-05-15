import crypto from 'crypto';

export function hash(dado) {
  const secret = process.env.SALT_SECRET || 'saltpadrao';
  return crypto.createHmac('sha256', secret).update(dado).digest('hex');
}
