import puppeteer from 'puppeteer';
import pkg from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { handleMessage } from '../controllers/messageController.js';

const { Client, LocalAuth } = pkg;

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    executablePath: puppeteer.executablePath(),
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  }
});
client.on('qr', qr => qrcode.generate(qr, { small: true }));
client.on('ready', () => console.log('✅ WhatsApp pronto!'));
client.on('message', async msg => await handleMessage(msg, client));

export { client };
