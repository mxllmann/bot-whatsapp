import openai from "../../services/openaiServices.js";
import fetch from "node-fetch";
import InteractionLog from "../../models/InteractionLog.js";
import { hash } from "../../utils/hashUtils.js";

export async function handleCommandCriar(prompt, phone, client, gptContext) {
  console.log("📥 Comando /criar recebido:", prompt);

  const phoneHash = hash(phone);

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `Hoje é ${new Date().toISOString().slice(0, 10)}.
        Você é um assistente que interpreta pedidos para criar eventos no Google Calendar.
        
        Se o usuário mencionar uma cor, associe essa cor ao campo "colorId", usando os seguintes mapeamentos:

        {
          "azul": "1",
          "verde": "2",
          "roxo": "3",
          "vermelho": "4",
          "amarelo": "5",
          "laranja": "6",
          "turquesa": "7",
          "cinza": "8",
          "azul escuro": "9",
          "verde escuro": "10",
          "vermelho escuro": "11",
          "vinho": "11",
          "bordô": "11",
          "lilás": "3",
          "rosa": "4",
          "dourado": "5",
          "prata": "8"
        }
        Se o usuário comunicar uma cor que não esteja no mapeamento, utilize o colorId mais próximo da cor mencionada comparado
        a uma cor que já esteja no mapeamento. (Exemplo: Se ele falar uma cor que não esteja no mapeamento mas ela é parecida com azul, use o colorId: 1)
        Se o usuário **não mencionar cor**, **não envie o campo "colorId"**. O backend definirá uma cor aleatória nesse caso.

        Converta o pedido do usuário em um JSON com o seguinte formato:

        {
          "summary": "...",
          "description": "...",
          "location": "...",
          "start": "YYYY-MM-DDTHH:MM:00",
          "end": "YYYY-MM-DDTHH:MM:00",
          "attendees": ["email1", "email2"],
          "recurrence": ["RRULE:..."],
          "reminders": {
            "useDefault": false,
            "overrides": [
              {"method": "email", "minutes": 1440},
              {"method": "popup", "minutes": 10}
            ]
          },
          "colorId": "1" // opcional
        }

        A duração padrão é de 1h se o usuário não especificar. Responda apenas com o JSON.`,
      },
      { role: "user", content: prompt },
    ],
  });

  const gptJson = completion.choices[0].message.content.trim();

  console.log("📦 JSON do evento pelo GPT:", gptJson);

  let evento;
  try {
    evento = JSON.parse(gptJson);
  } catch (err) {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Você é um assistente pessoal que deve seguir o estilo e o tom definidos pelo usuário neste contexto:
                  """${gptContext}"""
                  Siga esse estilo de forma rigorosa em todas as interações com este usuário.
                  O usuário mandou um comando para você criar um evento para ele no Google Agenda, porém, você não entendeu e não conseguiu criar.`,
        },
        {
          role: "user",
          content:
            "Informe o usuário que você não conseguiu entender a criação desse evento e não conseguiu criá-lo.",
        },
      ],
    });

    const message = completion.choices[0].message.content.trim();

    await InteractionLog.create({
      phone_hash: phoneHash,
      user_message: prompt,
      bot_response: message,
      command: "/criar",
      error: err,
      success: false,
    });
    return client.sendMessage(phone, message);
  }

  if (prompt.toLowerCase().includes("google meet")) {
    evento.conference = true;
  }


  const response = await fetch(
    `${process.env.API_BASE_URL}/eventos/criar-evento`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, evento }),
    }
  );

  console.log("Resposta da criação do evento: ", response);

  if (!response.ok) {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Você é um assistente pessoal que deve seguir o estilo e o tom definidos pelo usuário neste contexto:
                  """${gptContext}"""
                  Siga esse estilo de forma rigorosa em todas as interações com este usuário.
                  O usuário mandou um comando para você criar um evento para ele no Google Agenda, porém, aconteceu algum erro técnico na hora de criar o evento.`,
        },
        {
          role: "user",
          content:
            "Informe o usuário que você não criar esse evento devido a uma falha técnica.",
        },
      ],
    });

    const message = completion.choices[0].message.content.trim();

    await InteractionLog.create({
      phone_hash: phoneHash,
      user_message: prompt,
      bot_response: message,
      command: "/criar",
      error: response,
      success: false,
    });
    return client.sendMessage(phone, message);
  }

  const resultado = await response.json();
  const { meetLink } = resultado;

  const confirmacao = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: ` 
        Você é um assistente pessoal que deve seguir o estilo e o tom definidos pelo usuário neste contexto:
        """${gptContext}"""
        Siga esse estilo de forma rigorosa em todas as interações com este usuário.
        Você é um assistente simpático que confirma a criação de eventos. 
        Se houver um link do Google Meet, mencione-o. Caso contrário, não fale nada sobre isso.`,
      },
      {
        role: "user",
        content: `O evento foi criado com sucesso. Aqui estão os dados:
        ${JSON.stringify(evento, null, 2)}
        ${
          meetLink
            ? `Inclua esta linha no final: Link do Google Meet: ${meetLink}`
            : "Não mencione Google Meet na resposta."
        }`,
      },
    ],
  });

  const message = confirmacao.choices[0].message.content.trim();

  await InteractionLog.create({
    phone_hash: phoneHash,
    user_message: prompt,
    bot_response: message,
    command: "/criar",
    new_event: resultado,
    success: true,
  });

  return client.sendMessage(phone, message);
}
