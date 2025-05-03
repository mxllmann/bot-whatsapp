import { oAuth2Client, getAuthUrl } from '../services/googleService.js';
import { saveOrUpdateUser } from './saveUser.js';
import fetch from 'node-fetch';

export const startAuth = (req, res) => {
  const { phone } = req.query;
  const url = getAuthUrl(phone);
  res.redirect(url);
};

export const handleCallback = async (req, res) => {
  try {
    const code = req.query.code;
    const phone = req.query.state;
    const { tokens } = await oAuth2Client.getToken(code);

    const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });

    const { email } = await userinfoRes.json();

    await saveOrUpdateUser({ phone, email, tokens });
    res.send('✅ Autenticação concluída!');
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao autenticar:', err);
  }
};

