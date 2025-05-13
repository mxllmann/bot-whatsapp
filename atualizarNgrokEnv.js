import fetch from 'node-fetch';
import fs from 'fs';

async function atualizarNgrokEnv() {
  try {
    const res = await fetch('http://localhost:4040/api/tunnels');
    const data = await res.json();

    // Pega o primeiro túnel HTTP válido
    const url = data.tunnels.find(t => t.proto === 'https')?.public_url;
    if (!url) {
      console.error("❌ Não foi possível obter a URL pública do ngrok.");
      return;
    }

    const linhasAtualizadas = [
      `AUTH_LINK=${url}`,
      `API_BASE_URL=${url}`,
      `GOOGLE_REDIRECT_URI=${url}/oauth2callback`
    ];

    // Carrega e atualiza o conteúdo do .env
    let envAtual = fs.readFileSync('.env', 'utf-8');

    // Substitui se já existir, ou adiciona
    linhasAtualizadas.forEach((linha) => {
      const [chave] = linha.split('=');
      const regex = new RegExp(`^${chave}=.*$`, 'm');
      if (envAtual.match(regex)) {
        envAtual = envAtual.replace(regex, linha);
      } else {
        envAtual += `\n${linha}`;
      }
    });

    fs.writeFileSync('.env', envAtual);
    console.log("✅ Variáveis atualizadas com sucesso:");
    console.log(linhasAtualizadas.join('\n'));

  } catch (err) {
    console.error("❌ Erro ao atualizar variáveis do .env:", err.message);
  }
}

atualizarNgrokEnv();
