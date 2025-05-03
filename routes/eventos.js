import express from 'express';
import { buscarEventosPorData, criarEvento } from '../controllers/calendarController.js';

const router = express.Router();
router.get('/', buscarEventosPorData);
router.post('/criar-evento', criarEvento);

export default router;
