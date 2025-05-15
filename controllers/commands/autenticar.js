import { google } from "googleapis";
import { oAuth2Client } from "../../services/googleService.js";
import { saveOrUpdateUser } from "../saveUser.js";
import openai from "../../services/openaiServices.js";
import { hash } from "../../utils/hashUtils.js";

const CLIENT_REDIRECT_URL = process.env.AUTH_LINK;

export async function handleCommandAutenticar(phone, client) {
  const link = `${CLIENT_REDIRECT_URL}/auth?phone=${phone}`;

  const mensagem = `📅 Bem-vindo à InteliAgenda!
          Para usar nosso assistente pessoal inteligente, é necessário estar previamente autorizado.
          Se você já foi autorizado, basta seguir o link abaixo para realizar a autenticação com sua conta Google: 
          👉${link} 
                      
          🔐 Importante: Se você ainda não foi autorizado, este acesso não será liberado. 
          Em caso de dúvidas ou para solicitar autorização, entre em contato pelo email: arthur@sirrus.com.br 

          Estamos à disposição! 😊`;
  return client.sendMessage(phone, mensagem);
}

export async function handleCallback(req, res) {
  try {
    const { code, phone } = req.query;
    if (!code || !phone) return res.status(400).send("Parâmetros ausentes");

    const phoneHash = hash(phone);

    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: "v2", auth: oAuth2Client });
    const { data } = await oauth2.userinfo.get();

    return res.send(
      "✅ Autenticação realizada com sucesso! Pode voltar ao WhatsApp 😉"
    );
  } catch (error) {
    console.error("❌ Erro na autenticação:", error);
    return res.status(500).send("Erro ao autenticar");
  }
}
