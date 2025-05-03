import User from '../models/User.js';
import { handleCommandEventos } from './commands/eventos.js';
import { handleCommandAutenticar } from './commands/autenticar.js';
import { handleCommandCriar } from './commands/criar.js';

export async function handleMessage(msg, client) {
  if (!msg.body || typeof msg.body !== 'string' || msg.from.endsWith('@g.us')) return;

  const phone = msg.from;
  const text = msg.body.trim();
  const user = await User.findOne({ phone });

  // 🔒 Se o usuário NÃO estiver autenticado, envia link de autenticação
  if (!user || !user.refresh_token) {
    const prompt = text; // usa a mensagem original como base para o GPT gerar uma resposta simpática
    return await handleCommandAutenticar(prompt, phone, client);
  }

  // ✅ Usuário autenticado → pode usar comandos
  if (text.startsWith('/eventos')) {
    const prompt = text.replace('/eventos', '').trim();
    return await handleCommandEventos(prompt, phone, client);
  }

  if (text.startsWith('/criar')) {
    const prompt = text.replace('/criar', '').trim();
    return await handleCommandCriar(prompt, phone, client);
  }

  if (text.startsWith('/autenticar')) {
    const prompt = text.replace('/autenticar', '').trim();
    return await handleCommandAutenticar(prompt, phone, client);
  }

  // Se o usuário está autenticado, mas mandou algo genérico
  return client.sendMessage(phone, '🤖 Envie um dos comandos disponíveis: /eventos, /criar, /autenticar');
}

