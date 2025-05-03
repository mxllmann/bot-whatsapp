import openai from '../../services/openaiServices.js';
import User from '../../models/User.js';

export async function handleCommandAutenticar(prompt, phone, client) {
  const user = await User.findOne({ phone });

  const AUTH_LINK = process.env.AUTH_LINK;
  const link = `${AUTH_LINK}/auth?phone=${phone}`;

  if (!user) {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Você é um assistente que ajuda o usuário a se conectar com o Google Agenda. Use o link de autenticação abaixo e oriente-o de forma amigável.`,
        },
        {
          role: 'user',
          content: `Este é o link de autenticação do usuário: ${link}. Escreva uma mensagem explicando que ele precisa clicar no link para conectar sua conta do Google.`,
        },
      ],
    });

    return client.sendMessage(phone, completion.choices[0].message.content.trim());
  }

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `O usuário já está autenticado. Diga isso de forma simpática e convide-o a experimentar os comandos do bot para interagir com o Google Agenda.`,
      },
      {
        role: 'user',
        content: `${prompt}`,
      },
    ],
  });

  return client.sendMessage(phone, completion.choices[0].message.content.trim());
}
