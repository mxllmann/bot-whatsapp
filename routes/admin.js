import express from 'express';
import { addEmailToWhitelist } from '../controllers/adminController.js';

const router = express.Router();
router.post('/whitelist', addEmailToWhitelist);

export default router;
