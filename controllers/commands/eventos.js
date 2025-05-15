import openai from '../../services/openaiServices.js';
import fetch from 'node-fetch';
import { hash } from '../../utils/hashUtils.js';
import InteractionLog from '../../models/InteractionLog.js';

export async function handleCommandEventos(prompt, phone, client, gptContext) {
  console.log('📥 Comando /eventos recebido:', prompt);

  const hoje = new Date().toISOString().slice(0, 10);
  const phoneHash = hash(phone);

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `Hoje é ${hoje}.
        Quando o usuário pedir eventos para um intervalo de tempo (ex: 'de hoje até sexta-feira', 'entre 10 e 15 de maio'), 
        extraia a data inicial e final e responda apenas no formato JSON: 
        {"start": "YYYY-MM-DD", "end": "YYYY-MM-DD"}.

        Se for apenas um dia, defina start = end.
        Se ele falar de um mês específico, defina o start = primeiro dia do mês e end = último dia do mês.
        Não escreva mais nada além do JSON.`,
      },
      { role: 'user', content: prompt }
    ]
  });

  const gptResponse = completion.choices[0].message.content.trim();
  console.log('📅 Intervalo interpretado pelo GPT:', gptResponse);

  let start, end;

  try {
    const parsed = JSON.parse(gptResponse);
    start = parsed.start;
    end = parsed.end;
    if (!start || !end) throw new Error();
  } catch (err) {
    const resposta = '❌ Não consegui entender o período solicitado.';
    await client.sendMessage(phone, resposta);
    await InteractionLog.create({
      phone_hash: phoneHash,
      user_message: prompt,
      bot_response: resposta,
      command: '/eventos',
      error: err,
      success: false
    });
    return;
  }

  const url = `${process.env.API_BASE_URL}/eventos?phone=${phone}&start=${start}&end=${end}`;
  console.log('🌐 Buscando eventos entre:', start, end);

  try {
    const response = await fetch(url);
    const eventos = await response.json();

    console.log('📦 Eventos recebidos da API:', eventos.length);

    if (!eventos.length) {
      const resposta = `📭 Nenhum evento encontrado entre ${start} e ${end}.`;
      await client.sendMessage(phone, resposta);
      await InteractionLog.create({
        phone_hash: phoneHash,
        user_message: prompt,
        bot_response: resposta,
        command: '/eventos',
        events_founded: [],
        success: true
      });
      return;
    }

    const listagem = eventos.map(ev => {
      const titulo = ev.summary || 'Sem título';
      const inicio = ev.start?.dateTime || ev.start?.date;
      const fim = ev.end?.dateTime || ev.end?.date;
      return `📌 ${titulo}\n🕒 ${inicio} até ${fim}`;
    }).join('\n\n');

    const msgFinal = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `
              Você é um assistente pessoal que deve seguir o estilo e o tom definidos pelo usuário neste contexto:
              """${gptContext}"""
              Siga esse estilo de forma rigorosa em todas as interações com este usuário.
              Responda de forma simpática listando e informando os compromissos do usuário para o intervalo de tempo solicitado.`,
        },
        { role: 'user', content: listagem }
      ]
    });

    const respostaFinal = msgFinal.choices[0].message.content.trim();
    await client.sendMessage(phone, respostaFinal);
    await InteractionLog.create({
      phone_hash: phoneHash,
      command: '/eventos',
      user_message: prompt,
      events_founded: eventos,
      bot_response: respostaFinal,
      success: true
    });
  } catch (err) {
    console.error('❌ Erro na busca de eventos:', err);
    const resposta = '❌ Ocorreu um erro ao buscar seus eventos.';
    await client.sendMessage(phone, resposta);
    await InteractionLog.create({
      phone_hash: phoneHash,
      user_message: prompt,
      bot_response: resposta,
      command: '/eventos',
      error: err,
      success: false
    });
  }
}
