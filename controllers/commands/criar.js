import openai from '../../services/openaiServices.js';
import fetch from 'node-fetch';

export async function handleCommandCriar(prompt, phone, client, gptContext) {
  console.log('📥 Comando /criar recebido:', prompt);

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
        {
            role: 'system',
            content: `Hoje é ${new Date().toISOString().slice(0, 10)}.
          Você é um assistente que interpreta pedidos para criar eventos no Google Calendar.
          
          Converta o pedido do usuário em um JSON com o seguinte formato:
          
          {
            "summary": "...",          // título (obrigatório)
            "description": "...",      // opcional
            "location": "...",         // opcional
            "start": "YYYY-MM-DDTHH:MM:00",  // obrigatório
            "end": "YYYY-MM-DDTHH:MM:00",    // obrigatório
            "attendees": ["email1", "email2"],     // opcional
            "recurrence": ["RRULE:..."],           // opcional
            "reminders": {                         // opcional
              "useDefault": false,
              "overrides": [
                {"method": "email", "minutes": 1440},
                {"method": "popup", "minutes": 10}
              ]
            }
          }
          
          A duração padrão é de 1h se o usuário não especificar. Responda apenas com o JSON.`
        },
      { role: 'user', content: prompt }
    ]
  });

  const gptJson = completion.choices[0].message.content.trim();

  console.log('📦 JSON do evento pelo GPT:', gptJson);

  let evento;
  try {
    evento = JSON.parse(gptJson);
  } catch (err) {
    return client.sendMessage(phone, '❌ Não consegui entender como criar esse evento.');
  }

  if (prompt.toLowerCase().includes('google meet')) {
    evento.conference = true;
  }
  

  const response = await fetch(`${process.env.API_BASE_URL}/eventos/criar-evento`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, evento }),
  });

  if (!response.ok) {
    return client.sendMessage(phone, '❌ Houve um erro ao tentar criar o evento.');
  }

  const resultado = await response.json();

  const { meetLink } = resultado;

  console.log(resultado)

  const confirmacao = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: ` 
        Você é um assistente pessoal que deve seguir o estilo e o tom definidos pelo usuário neste contexto:
         """${gptContext}"""
        Siga esse estilo de forma rigorosa em todas as interações com este usuário.
        Você é um assistente simpático que confirma a criação de eventos. 
        Se houver um link do Google Meet, mencione-o. Caso contrário, não fale nada sobre isso.`
      },
      {
        role: 'user',
        content: `O evento foi criado com sucesso. Aqui estão os dados:
        ${JSON.stringify(evento, null, 2)}
        ${meetLink ? `Inclua esta linha no final: Link do Google Meet: ${meetLink}` : 'Não mencione Google Meet na resposta.'}`

      }
    ]
  });
  

  return client.sendMessage(phone, confirmacao.choices[0].message.content.trim());
}
