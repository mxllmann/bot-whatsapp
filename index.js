import OpenAI from "openai";
import qrcode from 'qrcode-terminal';
import dotenv from 'dotenv';
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;

dotenv.config();

const client = new Client({
  authStrategy: new LocalAuth()
});

const openai = new OpenAI({
  apiKey: process.env.OPEN_AI_API_KEY
});


client.on('qr', (qr) => {
  console.log('📷 QR recebido, gerando...');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('✅ WhatsApp bot está pronto!');
});

client.on('auth_failure', (msg) => {
  console.error('❌ Falha de autenticação:', msg);
});

client.on('disconnected', (reason) => {
  console.log('🔌 Cliente desconectado:', reason);
});

console.log('🔄 Iniciando o cliente WhatsApp...');


client.on('message', async (message) => {

  const GRUPO_AUTORIZADO = process.env.GRUPO_AUTORIZADO;

  const isAuthorized = !message.isGroupMsg || message.from === GRUPO_AUTORIZADO;
  if (!isAuthorized || !message.body.startsWith("/patricio")) return;

  try {

    const prompt = await message.body.replace("/patricio", "").trim()

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: process.env.CONTEXTO_DO_AGENTE
        },
        {role: "user",
         content: `${prompt}`},
      ],
    });

    const answer = completion.choices[0].message.content;
    console.log(answer);
    await message.reply(answer);

  } catch (err) {
    console.error('Erro com o ChatGPT:', err.response?.data || err.message);
    await message.reply('❌ Ocorreu um erro ao processar sua mensagem.');
  }
  }
)

client.initialize();

