import fetch from 'node-fetch';
import openai from '../../services/openaiServices.js';

export const estadoCancelamento = {}; // { [phone]: { etapa, eventos, eventoSelecionado } }

export async function handleCommandCancelar(prompt, phone, client, gptContext) {
  const hoje = new Date().toISOString().slice(0, 10);

  // ETAPA 1 – interpretar o período
  if (!estadoCancelamento[phone]) {
    const systemPrompt = `
        Hoje é ${hoje}. 
        Seu objetivo é interpretar o intervalo de tempo mencionado e retornar no formato:
        { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" }
        Apenas isso, sem comentários.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ]
    });

    let start, end;
    try {
      const parsed = JSON.parse(completion.choices[0].message.content.trim());
      start = parsed.start;
      end = parsed.end;
    } catch (err) {
      return client.sendMessage(phone, '❌ Não entendi o período. Tente: /cancelar amanhã');
    }

    const res = await fetch(`${process.env.API_BASE_URL}/eventos?phone=${phone}&start=${start}&end=${end}`);
    const eventos = await res.json();

    if (!eventos.length) {
      return client.sendMessage(phone, '📭 Nenhum evento encontrado nesse período.');
    }

    estadoCancelamento[phone] = { etapa: 'aguardando_escolha', eventos };

    const lista = eventos.map((ev, i) =>
      `*${i + 1}.* ${ev.summary || 'Sem título'} – ${ev.start?.dateTime?.slice(11, 16)}h`
    ).join('\n');

    return client.sendMessage(phone, `Qual evento deseja cancelar?\n\n${lista}\n\nResponda com o número correspondente.`);
  }

  // ETAPA 2 – escolha do evento
  if (estadoCancelamento[phone].etapa === 'aguardando_escolha') {
    const index = parseInt(prompt.trim()) - 1;
    const eventos = estadoCancelamento[phone].eventos;

    if (isNaN(index) || index < 0 || index >= eventos.length) {
      return client.sendMessage(phone, '❌ Envie apenas o número do evento que deseja cancelar.');
    }

    const evento = eventos[index];
    estadoCancelamento[phone] = {
      etapa: 'aguardando_confirmacao',
      evento
    };

    return client.sendMessage(phone, `⚠️ Tem certeza que deseja cancelar o evento "*${evento.summary}*" às ${evento.start?.dateTime?.slice(11, 16)}h?\n\nResponda com *sim* para confirmar ou *não* para cancelar.`);
  }

  // ETAPA 3 – confirmação do cancelamento
  if (estadoCancelamento[phone].etapa === 'aguardando_confirmacao') {
    const confirmacao = prompt.trim().toLowerCase();
    const { evento } = estadoCancelamento[phone];
    delete estadoCancelamento[phone];

    if (confirmacao !== 'sim') {
      return client.sendMessage(phone, '✅ Cancelamento abortado. O evento não foi removido.');
    }

    const body = {
      phone,
      eventId: evento.id
    };

    const res = await fetch(`${process.env.API_BASE_URL}/eventos/deletar-evento`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const result = await res.json();

    if (result.success) {
      return client.sendMessage(phone, `🗑️ O evento "*${evento.summary}*" foi cancelado com sucesso.`);
    } else {
      return client.sendMessage(phone, `❌ Não foi possível cancelar o evento: ${result.message || 'erro desconhecido'}`);
    }
  }
}
