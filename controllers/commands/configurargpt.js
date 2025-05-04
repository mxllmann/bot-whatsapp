// src/controllers/commands/configurargpt.js
import User from '../../models/User.js';
import { encrypt } from '../../utils/cryptoUtils.js';
import { hashPhone } from '../../utils/hashUtils.js';

export const estadoConfiguracao = {}; // { [phone]: true }

export async function handleCommandConfigurarGPT(text, phone, client) {
  const phoneHash = hashPhone(phone);
  const user = await User.findOne({ phone_hash: phoneHash });

  if (!user) {
    delete estadoConfiguracao[phone];
    return client.sendMessage(phone, '❌ Usuário não encontrado. Por favor, autentique-se primeiro com /autenticar.');
  }

  try {
    user.gpt_context = encrypt(text);
    await user.save();
    delete estadoConfiguracao[phone];

    return client.sendMessage(phone, '✅ Seu estilo de interação foi atualizado com sucesso! O assistente agora seguirá suas preferências.');
  } catch (err) {
    console.error('❌ Erro ao atualizar o contexto do usuário:', err);
    delete estadoConfiguracao[phone];
    return client.sendMessage(phone, '❌ Ocorreu um erro ao salvar sua configuração. Tente novamente mais tarde.');
  }
}
