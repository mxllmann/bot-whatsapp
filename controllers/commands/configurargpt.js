// src/controllers/commands/configurargpt.js
import User from '../../models/User.js';
import openai from '../../services/openaiServices.js';
import { encrypt } from '../../utils/cryptoUtils.js';
import { hashPhone } from '../../utils/hashUtils.js';
import InteractionLog from '../../models/InteractionLog.js';

export const estadoConfiguracao = {}; // { [phone]: true }

export async function handleCommandConfigurarGPT(text, phone, client, gptContext) {
  const phoneHash = hashPhone(phone);
  const user = await User.findOne({ phone_hash: phoneHash });

  if (!user) {
    delete estadoConfiguracao[phone];

    const completion = await openai.chat.completions.create({
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
          content: `Diga ao usuário que ele não foi encontrado ou não está autenticado e que ele deve usar o comando /autenticar e se autenticar primeiro`
        }
      ]
    });
  
    const mensagem = completion.choices[0].message.content.trim();

    await InteractionLog.create({
              phone_hash: phoneHash,
              user_message: encrypt(text),
              bot_response: mensagem,
              command: '/configurargpt',
              success: false
            });

    return client.sendMessage(phone, mensagem);
  }

  try {
    user.gpt_context = encrypt(text);
    await user.save();
    delete estadoConfiguracao[phone];

    const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `
            Você é um assistente pessoal que deve seguir o estilo e o tom definidos pelo usuário neste contexto:
            """${text}"""
            Siga esse estilo de forma rigorosa em todas as interações com este usuário.
            `
            },
            {
              role: 'user',
              content: `Diga ao usuário que as preferências de tratamento que ele determinou foram atualizadas.`
            }
          ]
        });
      
    const mensagem = completion.choices[0].message.content.trim();

    await InteractionLog.create({
      phone_hash: phoneHash,
      bot_response: mensagem,
      new_gpt_context: user.gpt_context,
      command: '/configurargpt',
      success: true
    });
    
    return client.sendMessage(phone, mensagem);
    
  } catch (err) {
    console.error('❌ Erro ao atualizar o contexto do usuário:', err);
    delete estadoConfiguracao[phone];

    const completion = await openai.chat.completions.create({
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
              content: `Diga ao usuário que houve algum erro ao atualizar as preferências de tratamento que ele determinou.`
            }
          ]
        });
      
        const mensagem = completion.choices[0].message.content.trim();

        await InteractionLog.create({
          phone_hash: phoneHash,
          user_message: encrypt(text),
          bot_response: mensagem,
          command: '/configurargpt',
          success: false
        });
    
        return client.sendMessage(phone, mensagem);
  }
}
