import { google } from 'googleapis';
import { oAuth2Client } from '../../services/googleService.js';
import { saveOrUpdateUser } from '../saveUser.js';
import openai from '../../services/openaiServices.js';
import { hashPhone } from '../../utils/hashUtils.js';

const CLIENT_REDIRECT_URL = process.env.AUTH_LINK;

export async function handleCommandAutenticar(phone, client, gptContext) {
  const link = `${CLIENT_REDIRECT_URL}/auth?phone=${phone}`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `
      Você é um assistente pessoal que deve seguir o estilo e o tom definidos pelo usuário neste contexto:
      """${gptContext}"""
      Siga esse estilo de forma rigorosa em todas as interações com este usuário.
      Gere uma mensagem simpática e clara para informar que ele deve se autenticar com o Google por meio do link a seguir. O link deve ser apresentado com destaque visual no final da mensagem.
      `
      },
      {
        role: 'user',
        content: `Link de autenticação: ${link}`
      }
    ]
  });

  const mensagem = completion.choices[0].message.content.trim();
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

    return res.send('✅ Autenticação realizada com sucesso! Pode voltar ao WhatsApp 😉');
  } catch (error) {
    console.error('❌ Erro na autenticação:', error);
    return res.status(500).send('Erro ao autenticar');
  }
}
