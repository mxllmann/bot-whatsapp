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

      const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: `
              Você é um assistente pessoal que deve seguir o estilo e o tom definidos pelo usuário neste contexto:
              """${gptContext}"""
              Siga esse estilo de forma rigorosa em todas as interações com este usuário.
              Informe ao usuário que você não conseguiu entender o período dado por ele.
              `
              },
              {
                role: 'user',
                content: `Diga ao usuário que você não conseguiu entender o período informado por ele, instrua-o a usar o comando dessa forma:
                /editar amanhã, /editar segunda-feira, /editar hoje, /editar semana que vem, /editar 15/05 e etc.`
              }
            ]
          });
        
          const mensagem = completion.choices[0].message.content.trim();
      
          return client.sendMessage(phone, mensagem);
    }

    const res = await fetch(`${process.env.API_BASE_URL}/eventos?phone=${phone}&start=${start}&end=${end}`);
    const eventos = await res.json();

    if (!eventos.length) {
      const completionNotFounded = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `
          Você é um assistente pessoal que deve seguir o estilo e o tom definidos pelo usuário neste contexto:
          """${gptContext}"""
          Siga esse estilo de forma rigorosa em todas as interações com este usuário.
          Informe ao usuário que você não conseguiu achar nenhum evento no período solicitado.
          `
          },
          {
            role: 'user',
            content: `Diga ao usuário que você não encontrou nenhum evento do Google Agenda no período solicitado.`
          }
        ]
      });
    
      const mensagem = completionNotFounded.choices[0].message.content.trim();
  
      return client.sendMessage(phone, mensagem);
    }

    // Salvar estado
    estadoEdicao[phone] = { etapa: 'aguardando_escolha', eventos };

    const lista = eventos
      .map((ev, i) => `*${i + 1}.* ${ev.summary || 'Sem título'} das ${ev.start?.dateTime?.slice(11, 16)}h até ás ${ev.end?.dateTime?.slice(11, 16)} `)
      .join('\n');

      const completionFounded = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `
          Você é um assistente pessoal que deve seguir o estilo e o tom definidos pelo usuário neste contexto:
          """${gptContext}"""
          Siga esse estilo de forma rigorosa em todas as interações com este usuário.
          `
          },
          {
            role: 'user',
            content: `Pergunte ao usuário de que ele deve escolher numericamente um desses eventos para realizar a edição ${lista}, ele deve mandar somente o número/indíce do evento que você mostrar.
            Mostre o eventos na mesma ordem, com os mesmo números de ${lista}`
          }
        ]
      });
    
      const mensagem = completionFounded.choices[0].message.content.trim();
  
      return client.sendMessage(phone, mensagem);  
    
  }

  // ETAPA 2: usuário escolhe o número do evento
  if (estadoEdicao[phone].etapa === 'aguardando_escolha') {
    const index = parseInt(prompt.trim()) - 1;
    const eventos = estadoEdicao[phone].eventos;

    if (isNaN(index) || index < 0 || index >= eventos.length) {

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `
          Você é um assistente pessoal que deve seguir o estilo e o tom definidos pelo usuário neste contexto:
          """${gptContext}"""
          Siga esse estilo de forma rigorosa em todas as interações com este usuário.
          Informe ao usuário que você não conseguiu entender o período dado por ele.
          Você encontrou alguns eventos do Google Agenda do usuário e informou para ele de forma ordenada esperando que ele respondesse o
          número equivalente ao evento, porém o usuário mandou uma resposta que não é um dos números dos eventos encontrados para realizar a edição de um deles.
          `
          },
          {
            role: 'user',
            content: `Informe ao usuário de que ele mandou um valor inválido e que ele deve mandar o número correspondente ao evento no qual ele quer editar.`
          }
        ]
      });
    
      const mensagem = completion.choices[0].message.content.trim();
  
      return client.sendMessage(phone, mensagem);
      
    }

    estadoEdicao[phone] = {
      etapa: 'aguardando_edicao',
      evento: eventos[index]
    };

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `
        Você é um assistente pessoal que deve seguir o estilo e o tom definidos pelo usuário neste contexto:
        """${gptContext}"""
        Siga esse estilo de forma rigorosa em todas as interações com este usuário.
        O usuário escolheu editar esse evento "${eventos[index].summary}, você já estava conversando com ele antes, então não diga "oi" ou similares.
        `
        },
        {
          role: 'user',
          content: `Pergunte ao usuário o que ele quer editar no evento "${eventos[index].summary}"`
        }
      ]
    });
  
    const mensagem = completion.choices[0].message.content.trim();

    return client.sendMessage(phone, mensagem);
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

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `
          Você é um assistente pessoal que deve seguir o estilo e o tom definidos pelo usuário neste contexto:
          """${gptContext}"""
          Siga esse estilo de forma rigorosa em todas as interações com este usuário.
          Você não conseguiu entender quais as mudanças que o usuário quer realizar no evento do Google Agenda escolhido.
          `
          },
          {
            role: 'user',
            content: `Diga ao usuário que você não conseguiu entender as mudanças que o usuário quer realizar no evento escolhido.`
          }
        ]
      });
    
      const mensagem = completion.choices[0].message.content.trim();
  
      return client.sendMessage(phone, mensagem);  
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
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `
          Você é um assistente pessoal que deve seguir o estilo e o tom definidos pelo usuário neste contexto:
          """${gptContext}"""
          Siga esse estilo de forma rigorosa em todas as interações com este usuário.
          Informe ao usuário de que as alterações feitas no evento "${novo.summary}" foram atualizadas com sucesso.
          `
          },
          {
            role: 'user',
            content: `Informe ao usuário de que as alterações no evento "${novo.summary}" escolhidas por ele foram realizadas com sucesso!`
          }
        ]
      });
    
      const mensagem = completion.choices[0].message.content.trim();
  
      return client.sendMessage(phone, mensagem);

    } else {

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `
          Você é um assistente pessoal que deve seguir o estilo e o tom definidos pelo usuário neste contexto:
          """${gptContext}"""
          Siga esse estilo de forma rigorosa em todas as interações com este usuário.
          Caso não exista a mensagem ${result.message} diga que foi um erro desconhecido.
          `
          },
          {
            role: 'user',
            content: `Informe ao usuário de que não foi possível realizar as alterações no evento "${novo.summary}" pela erro ${result.message}.`
          }
        ]
      });
    
      const mensagem = completion.choices[0].message.content.trim();
  
      return client.sendMessage(phone, mensagem);
    }
  }
}

export { estadoEdicao };

