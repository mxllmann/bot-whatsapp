import express from 'express';
import dotenv from 'dotenv';
import './config/db.js';
import { client } from './services/whatsappService.js';
import routes from './routes/index.js';

dotenv.config();

const app = express();
app.use(express.json());
app.use('/', routes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));

client.initialize();
