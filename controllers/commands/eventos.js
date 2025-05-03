import openai from '../../services/openaiServices.js';
import fetch from 'node-fetch';

export async function handleCommandEventos(prompt, phone, client) {
  console.log('📥 Comando /eventos recebido:', prompt);

  // Define a data de hoje no contexto do ChatGPT
  const hoje = new Date().toISOString().slice(0, 10);

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
    return client.sendMessage(phone, '❌ Não consegui entender o período solicitado.');
  }

  const url = `${process.env.API_BASE_URL}/eventos?phone=${phone}&start=${start}&end=${end}`;
  console.log('🌐 Buscando eventos entre:', start, end);

  try {
    const response = await fetch(url);
    const eventos = await response.json();

    console.log('📦 Eventos recebidos da API:', eventos.length);

    if (!eventos.length) {
      return client.sendMessage(phone, `📭 Nenhum evento encontrado entre ${start} e ${end}.`);
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
          content: 'Responda de forma simpática listando os compromissos do usuário para o intervalo de tempo solicitado.',
        },
        { role: 'user', content: listagem }
      ]
    });

    return client.sendMessage(phone, msgFinal.choices[0].message.content.trim());

  } catch (err) {
    console.error('❌ Erro na busca de eventos:', err);
    return client.sendMessage(phone, '❌ Ocorreu um erro ao buscar seus eventos.');
  }
}
