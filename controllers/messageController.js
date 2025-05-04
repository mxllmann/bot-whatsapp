import User from '../models/User.js';

import { decrypt } from '../utils/cryptoUtils.js';
import { hashPhone } from '../utils/hashUtils.js';
import { handleCommandEventos } from './commands/eventos.js';
import { handleCommandAutenticar } from './commands/autenticar.js';
import { handleCommandCriar } from './commands/criar.js';
import { handleCommandCancelar, estadoCancelamento } from './commands/cancelar.js';
import { handleCommandEditar, estadoEdicao } from './commands/editar.js'; // 👈 importando o estado

export async function handleMessage(msg, client) {
  if (!msg.body || typeof msg.body !== 'string' || msg.from.endsWith('@g.us')) return;

  const phone = msg.from;
  const phoneHash = hashPhone(phone);
  const text = msg.body.trim();

  const user = await User.findOne({ phone_hash: phoneHash });

  if (!user || !user.refresh_token) {
    return await handleCommandAutenticar(text, phone, client);
  }

  let refreshToken;
  try {
    refreshToken = decrypt(user.refresh_token);
  } catch (error) {
    console.error('❌ Erro ao descriptografar token:', error);
    return await handleCommandAutenticar(text, phone, client, 'Houve um problema com sua autenticação. Por favor, reautentique.');
  }

  let gptContext = 'Você é um assistente educado, direto e prestativo.';
  try {
    gptContext = decrypt(user.gpt_context || gptContext);
  } catch (err) {
    console.warn('⚠️ GPT Context inválido ou ausente, usando contexto padrão.');
  }
  console.log('🧠 Prompt enviado ao GPT com contexto:\n', gptContext);

  // 🔄 Se está no meio de um processo interativo de edição
  if (estadoEdicao[phone]) {
    return await handleCommandEditar(text, phone, client, gptContext); // 👈 reaproveita o mesmo handler
  }

  if (estadoCancelamento[phone]) {
    return await handleCommandCancelar(text, phone, client, gptContext);
  }  

  // ✅ Comandos reconhecidos
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

  if (text.startsWith('/autenticar')) {
    const prompt = text.replace('/autenticar', '').trim();
    return await handleCommandAutenticar(prompt, phone, client, gptContext);
  }

  // Se o usuário está autenticado, mas mandou algo genérico
  return client.sendMessage(phone, '🤖 Envie um dos comandos disponíveis: /eventos, /criar, /editar, /autenticar');
}
