import fetch from 'node-fetch';
import openai from '../../services/openaiServices.js';

const estadoEdicao = {}; // { [phone]: { etapa: '...', evento: {...} } }

export async function handleCommandEditar(prompt, phone, client, gptContext) {
  const hoje = new Date().toISOString().slice(0, 10);

  // ETAPA 1: usuário envia "/editar amanhã"
  if (!estadoEdicao[phone]) {
    const systemPrompt = `
      Hoje é ${hoje}.
      Você deve interpretar a frase do usuário e retornar apenas o intervalo de tempo desejado no formato:
      { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" }
      Não escreva mais nada além disso.
    `;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ]
    });

    let start, end;
    try {
      const result = JSON.parse(completion.choices[0].message.content.trim());
      start = result.start;
      end = result.end;
    } catch (err) {
      return client.sendMessage(phone, '❌ Não entendi o período desejado. Tente: /editar amanhã');
    }

    const res = await fetch(`${process.env.API_BASE_URL}/eventos?phone=${phone}&start=${start}&end=${end}`);
    const eventos = await res.json();

    if (!eventos.length) {
      return client.sendMessage(phone, '📭 Nenhum evento encontrado nesse período.');
    }

    // Salvar estado
    estadoEdicao[phone] = { etapa: 'aguardando_escolha', eventos };

    const lista = eventos
      .map((ev, i) => `*${i + 1}.* ${ev.summary || 'Sem título'} às ${ev.start?.dateTime?.slice(11, 16)}h`)
      .join('\n');

    return client.sendMessage(phone, `Qual evento deseja editar?\n\n${lista}\n\nResponda com o número correspondente.`);
  }

  // ETAPA 2: usuário escolhe o número do evento
  if (estadoEdicao[phone].etapa === 'aguardando_escolha') {
    const index = parseInt(prompt.trim()) - 1;
    const eventos = estadoEdicao[phone].eventos;

    if (isNaN(index) || index < 0 || index >= eventos.length) {
      return client.sendMessage(phone, '❌ Resposta inválida. Envie apenas o número do evento.');
    }

    estadoEdicao[phone] = {
      etapa: 'aguardando_edicao',
      evento: eventos[index]
    };

    return client.sendMessage(phone, `✏️ O que você deseja alterar no evento "${eventos[index].summary}"?`);
  }

  // ETAPA 3: usuário descreve as alterações desejadas
  if (estadoEdicao[phone].etapa === 'aguardando_edicao') {
    const evento = estadoEdicao[phone].evento;
    delete estadoEdicao[phone];

    const systemPrompt = `
      Hoje é ${hoje}. O evento atual tem:
      - Título: "${evento.summary}"
      - Início: "${evento.start.dateTime || evento.start.date}"

      A partir da descrição abaixo, gere apenas o objeto "novo" para atualização do evento, no seguinte formato:
      {
        "summary": "...",
        "start": "YYYY-MM-DDTHH:MM:00",
        "end": "YYYY-MM-DDTHH:MM:00"
      }
      Retorne apenas o JSON.
    `;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ]
    });

    let novo;
    try {
      novo = JSON.parse(completion.choices[0].message.content.trim());
    } catch (err) {
      return client.sendMessage(phone, '❌ Não consegui entender o que você deseja editar.');
    }

    // Enviar requisição final
    const body = {
      phone,
      original: {
        summary: evento.summary,
        periodo: {
          start: evento.start.dateTime || evento.start.date,
          end: evento.end.dateTime || evento.end.date
        }
      },
      novo
    };

    const response = await fetch(`${process.env.API_BASE_URL}/eventos/editar-evento`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const result = await response.json();

    if (result.success) {
      return client.sendMessage(phone, `✅ Evento "${novo.summary}" atualizado com sucesso!`);
    } else {
      return client.sendMessage(phone, `❌ Falha ao editar: ${result.message || 'erro desconhecido'}`);
    }
  }
}

export { estadoEdicao };

