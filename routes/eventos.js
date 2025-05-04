import express from 'express';
import { buscarEventosPorData, criarEvento, editarEvento, deletarEvento } from '../controllers/calendarController.js';

const router = express.Router();
router.get('/', buscarEventosPorData);
router.post('/criar-evento', criarEvento);
router.put('/editar-evento', editarEvento);
router.delete('/deletar-evento', deletarEvento);

export default router;
