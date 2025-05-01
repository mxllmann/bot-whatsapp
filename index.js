import express from "express";
import { google } from "googleapis";
import dotenv from "dotenv";
import "./db.js";
import mongoose from "mongoose";
import OpenAI from "openai";
import qrcode from "qrcode-terminal";
import pkg from "whatsapp-web.js";
import fetch from "node-fetch";
import { saveOrUpdateUser } from "./controllers/saveUser.js";
import User from "./models/User.js";

// Configurações iniciais
dotenv.config();
const app = express();

//Inicializar o CHATGPT
const openai = new OpenAI({
  apiKey: process.env.OPEN_AI_API_KEY,
});

// Inicializa o cliente WhatsApp
const { Client, LocalAuth } = pkg;
const client = new Client({ authStrategy: new LocalAuth() });

// OAuth2 Google, serve para criar a autenticação
const oAuth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Escopos necessários
const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
];

// Eventos do WhatsApp
client.on("qr", (qr) => qrcode.generate(qr, { small: true }));
client.on("ready", () => console.log("✅ WhatsApp bot está pronto!"));
client.on("auth_failure", (msg) =>
  console.error("❌ Falha de autenticação WhatsApp:", msg)
);
client.on("disconnected", (reason) =>
  console.log("🔌 Cliente WhatsApp desconectado:", reason)
);

client.on("message", async (msg) => {
  try {
    if (!msg.body || typeof msg.body !== "string") return;
    if (msg.from.endsWith("@g.us")) return;

    const phone = msg.from;
    const text = msg.body.trim();
    const user = await User.findOne({ phone });

    //Comando de Autenticação dos Usuários /autenticar
    //Se a mensagem começar com /autenticar ele manda o link para o usuario se autenticar
    if (text.startsWith("/autenticar")) {
      const prompt = text.replace("/autenticar", "");

      //Link de autenticação
      const AUTH_LINK = process.env.AUTH_LINK;

      //Se o usuário não estiver autenticado, ele manda o link de autenticação
      if (!user) {
        const link = `${AUTH_LINK}/auth?phone=${phone}`;

        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `O usuário ainda não foi autenticado, mande esse ${link} para que ele realize a autenticação e possa interagir com o Google Agenda dele através de interações com você.`,
            },
            {
              role: "user",
              content: `${prompt} Informe o ${link} ao usuário para que ele realize a autenticação e interaja com o Google Agenda, diga que após a autenticação, basta ele utilizar os comandos específicos para interagir com o Google Agenda dele.`,
            },
          ],
        });

        const answer = completion.choices[0].message.content;

        return client.sendMessage(phone, answer);
      }

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `O usuário já está autenticado, informe a ele que ele só precisa interagir com você através dos comandos específicos para interagir com o Google Agenda`,
          },
          { role: "user", content: `${prompt}` },
        ],
      });

      const answer = completion.choices[0].message.content;

      //Senão, ele apenas retorna que já está autenticado
      return client.sendMessage(phone, answer);
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ erro: error });
    return client.sendMessage(phone, "Erro na interação");
  }
});

// Rota de autenticação Google
app.get("/auth", (req, res) => {
  const phone = req.query.phone;
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state: phone,
  });
  res.redirect(authUrl);
});

// Callback após consentimento Google
app.get("/oauth2callback", async (req, res) => {
  try {
    const code = req.query.code;
    const phone = req.query.state;
    const { tokens } = await oAuth2Client.getToken(code);

    // Busca email diretamente com access_token
    const userinfoRes = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      }
    );

    if (!userinfoRes.ok) {
      const err = await userinfoRes.json();
      console.error("❌ Erro userinfo:", err);
      return res.status(401).send("Erro ao obter informações do usuário.");
    }

    const { email } = await userinfoRes.json();

    // Salva ou atualiza usuário no banco
    await saveOrUpdateUser({
      phone,
      email,
      tokens: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expiry_date,
      },
    });

    res.send("✅ Autenticação concluída! Agora você pode usar o assistente.");
  } catch (err) {
    console.error("❌ Erro durante autenticação:", err);
    res.status(500).send("Erro ao salvar usuário no banco de dados.");
  }
});

app.get("/events", async (req, res) => {
  try {
    const phone = req.query.phone;
    if (!phone) return res.status(400).send("Número não informado");

    const user = await User.findOne({ phone });
    if (!user || !user.refresh_token)
      return res.status(404).send("Usuário não autenticado");

    // Autentica com o refresh_token
    oAuth2Client.setCredentials({
      refresh_token: user.refresh_token,
    });

    const calendar = google.calendar({ version: "v3", auth: oAuth2Client });

    const response = await calendar.events.list({
      calendarId: "primary",
      timeMin: new Date().toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: "startTime",
    });

    const eventos = response.data.items.map((evento) => ({
      titulo: evento.summary,
      inicio: evento.start?.dateTime || evento.start?.date,
      fim: evento.end?.dateTime || evento.end?.date,
    }));

    res.json(eventos);
  } catch (err) {
    console.error("❌ Erro ao buscar eventos:", err);
    res.status(500).send("Erro ao acessar o Google Calendar.");
  }
});

// Inicia servidor
const PORT = process.env.PORT;
app.listen(PORT, () =>
  console.log(`Servidor rodando em http://localhost:${PORT}`)
);
client.initialize();
