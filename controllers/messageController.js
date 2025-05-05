import User from '../models/User.js';
import InteractionLog from '../models/InteractionLog.js';
import openai from '../services/openaiServices.js';
import { decrypt } from '../utils/cryptoUtils.js';
import { hashPhone } from '../utils/hashUtils.js';
import { handleCommandEventos } from './commands/eventos.js';
import { handleCommandAutenticar } from './commands/autenticar.js';
import { handleCommandCriar } from './commands/criar.js';
import { handleCommandCancelar, estadoCancelamento } from './commands/cancelar.js';
import { handleCommandEditar, estadoEdicao } from './commands/editar.js';
import { handleCommandConfigurarGPT, estadoConfiguracao } from './commands/configurargpt.js';

export async function handleMessage(msg, client) {
  if (!msg.body || typeof msg.body !== 'string' || msg.from.endsWith('@g.us')) return;

  const phone = msg.from;
  const phoneHash = hashPhone(phone);
  const text = msg.body.trim();

  console.log('📨 Comando identificado:', text);

  // Buscar usuário no banco
  const user = await User.findOne({ phone_hash: phoneHash });

  // Preparar contexto do GPT
  let gptContext = 'Você é um assistente educado, direto e prestativo.';
  try {
    gptContext = decrypt(user.gpt_context || gptContext);
  } catch {
    console.warn('⚠️ GPT Context inválido ou ausente, usando padrão.');
  }
  console.log('🧠 Contexto do GPT:', gptContext);

  // Fluxo de autenticação manual
  if (text.startsWith('/autenticar')) {
    if (user && user.refresh_token) {
      // Verificar validade do token
      try {
        decrypt(user.refresh_token);

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `
            Você é um assistente pessoal que deve seguir o estilo e o tom definidos pelo usuário neste contexto:
            """${gptContext}"""
            Siga esse estilo de forma rigorosa em todas as interações com este usuário.
            Gere uma mensagem informando de que o usuário já está autenticado e já pode usar os comandos disponíveis, liste todos os comandos
            na mensagem que você enviar. Os comandos são:
            /eventos
            /criar
            /editar
            /cancelar
            /configurargpt
            `
            },
            {
              role: 'user',
              content: `Informe ao usuário de que ele já está autenticado`
            }
          ]
        });
      
        const mensagem = completion.choices[0].message.content.trim();

        return client.sendMessage(phone, mensagem);
      } catch {
        // Token inválido ou expirado, solicitar nova autenticação
        return await handleCommandAutenticar(phone, client, gptContext);
      }
    } else {
      // Usuário ainda não autenticado
      return await handleCommandAutenticar(phone, client);
    }
  }

  // Se não autenticado, solicitar autenticação
  if (!user || !user.refresh_token) {
    return await handleCommandAutenticar(phone, client, gptContext);
  }

  // Tentar descriptografar o token
  let refreshToken;
  try {
    refreshToken = decrypt(user.refresh_token);
    console.log('🔐 Token descriptografado com sucesso.');
  } catch (error) {
    console.error('❌ Falha ao descriptografar token:', error.message);
    return await handleCommandAutenticar(phone, client, gptContext);
  }

  // Fluxos interativos
  if (estadoEdicao[phone]) {
    return await handleCommandEditar(text, phone, client, gptContext);
  }
  if (estadoCancelamento[phone]) {
    return await handleCommandCancelar(text, phone, client, gptContext);
  }
  if (estadoConfiguracao[phone]) {
    return await handleCommandConfigurarGPT(text, phone, client, gptContext);
  }

  // Comandos principais
  if (text.startsWith('/eventos')) {
    const prompt = text.replace('/eventos', '').trim();
    return await handleCommandEventos(prompt, phone, client, gptContext);
  }
  if (text.startsWith('/criar')) {
    const prompt = text.replace('/criar', '').trim();
    return await handleCommandCriar(prompt, phone, client, gptContext);
  }
  if (text.startsWith('/editar')) {
    const prompt = text.replace('/editar', '').trim();
    return await handleCommandEditar(prompt, phone, client, gptContext);
  }
  if (text.startsWith('/cancelar')) {
    const prompt = text.replace('/cancelar', '').trim();
    return await handleCommandCancelar(prompt, phone, client, gptContext);
  }
  if (text.startsWith('/configurargpt')) {
    estadoConfiguracao[phone] = true;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `
        Você é um assistente pessoal que deve seguir o estilo e o tom definidos pelo usuário neste contexto:
        """${gptContext}"""
        Siga esse estilo de forma rigorosa em todas as interações com este usuário.
        Informe ao usuário que ele deve descrever como o chatgpt tem que falar com ele.
        `
        },
        {
          role: 'user',
          content: `Diga ao usuário que ele deve descrever como o ChatGPT / Bot / Agente deve falar com ele. Instrua-o de que quanto mais detalhes ele der, melhor ficará o resultado.`
        }
      ]
    });
  
    const mensagem = completion.choices[0].message.content.trim();

    return client.sendMessage(phone, mensagem);
  }

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `
      Você é um assistente pessoal que deve seguir o estilo e o tom definidos pelo usuário neste contexto:
      """${gptContext}"""
      Siga esse estilo de forma rigorosa em todas as interações com este usuário.
      Diga ao usuário que não entendeu o comando e instrua-o a usar um dos comandos disponiveis:
      /eventos
      /criar
      /editar
      /cancelar
      /configurargpt
      `
      },
      {
        role: 'user',
        content: `O usuário mandou um comando desconhecido, instrua-o a mandar um dos comandos conhecidos, como: /eventos
      /criar
      /editar
      /cancelar
      /configurargpt`
      }
    ]
  });

  const mensagem = completion.choices[0].message.content.trim();

  // Fallback
  return client.sendMessage(
    phone, mensagem
  );
}
