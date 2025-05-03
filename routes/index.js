import express from 'express';
import { startAuth, handleCallback } from '../controllers/authController.js';
import eventosRoutes from './eventos.js';

const router = express.Router();

router.get('/auth', startAuth);
router.get('/oauth2callback', handleCallback);
router.use('/eventos', eventosRoutes);

export default router;
