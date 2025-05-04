import { google } from 'googleapis';
import { oAuth2Client } from '../../services/googleService.js';
import { saveOrUpdateUser } from '../saveUser.js';
import { encrypt } from '../../utils/cryptoUtils.js';
import { hashPhone } from '../../utils/hashUtils.js';

const CLIENT_REDIRECT_URL = process.env.AUTH_LINK;

export async function handleCommandAutenticar(prompt, phone, client, mensagemExtra = '') {
  const link = `${CLIENT_REDIRECT_URL}/auth?phone=${phone}`;
  const mensagem = `${mensagemExtra ? `❗ ${mensagemExtra}\n\n` : ''}Para continuar, por favor autentique sua conta do Google através do link abaixo:\n\n🔗 ${link}`;
  return client.sendMessage(phone, mensagem);
}

export async function handleCallback(req, res) {
  try {
    const { code, phone } = req.query;
    if (!code || !phone) return res.status(400).send('Parâmetros ausentes');

    const phoneHash = hashPhone(phone);

    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: oAuth2Client });
    const { data } = await oauth2.userinfo.get();

    await saveOrUpdateUser({
      phone,
      email: data.email,
      tokens,
      gpt_context: 'Você é um assistente educado e prestativo.', // default inicial
    });

    return res.send('✅ Autenticação realizada com sucesso! Pode voltar ao WhatsApp 😉');
  } catch (error) {
    console.error('❌ Erro na autenticação:', error);
    return res.status(500).send('Erro ao autenticar');
  }
}
