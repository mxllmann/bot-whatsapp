// waitForMongo.js
import net from 'net';

const host = 'mongo';
const port = 27017;
const timeout = 1000;

function checkMongoConnection() {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeout);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      resolve(false);
    });
    socket.connect(port, host);
  });
}

async function waitUntilAvailable() {
  console.log('⏳ Aguardando MongoDB ficar pronto...');
  while (!(await checkMongoConnection())) {
    await new Promise(res => setTimeout(res, timeout));
  }
  console.log('✅ MongoDB está pronto!');
}

await waitUntilAvailable();
