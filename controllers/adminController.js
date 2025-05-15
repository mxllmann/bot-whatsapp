import Whitelist from '../models/WhiteList.js';
import { hash } from '../utils/hashUtils.js'; // nova função

export async function addEmailToWhitelist(req, res) {
  const token = req.headers.authorization;
  if (!token || token !== `Bearer ${process.env.ADMIN_TOKEN}`) {
    return res.status(401).json({ message: 'Não autorizado.' });
  }

  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'E-mail ausente.' });

  const emailHash = hash(email);

  const exists = await Whitelist.findOne({ email_hash: emailHash });
  if (exists) {
    return res.status(409).json({ message: 'E-mail já cadastrado.' });
  }

  await Whitelist.create({ email_hash: emailHash });
  return res.status(201).json({ message: '✅ E-mail adicionado à whitelist.' });
}

