import express from 'express';
import { startAuth, handleCallback } from '../controllers/authController.js';
import eventosRoutes from './eventos.js';
import adminRoutes from './admin.js';

const router = express.Router();

router.get('/auth', startAuth);
router.get('/oauth2callback', handleCallback);
router.use('/eventos', eventosRoutes);
router.use('/admin', adminRoutes);

export default router;
