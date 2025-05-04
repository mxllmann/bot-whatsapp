import { oAuth2Client } from '../services/googleService.js';
import { google } from 'googleapis';
import User from '../models/User.js';
import { decrypt } from '../utils/cryptoUtils.js';
import { hashPhone } from '../utils/hashUtils.js';

export const buscarEventosPorData = async (req, res) => {
  try {
    const { phone, start, end } = req.query;
    if (!phone || !start || !end) return res.status(400).send('Parâmetros ausentes');

    const phoneHash = hashPhone(phone);
    const user = await User.findOne({ phone_hash: phoneHash });

    if (!user || !user.refresh_token) return res.status(403).send('Usuário não autenticado');

    const refreshToken = decrypt(user.refresh_token);
    oAuth2Client.setCredentials({ refresh_token: refreshToken });

    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
    const startDate = new Date(`${start}T00:00:00.000Z`);
    const endDate = new Date(`${end}T23:59:59.999Z`);

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    res.json(response.data.items || []);
  } catch (err) {
    console.error('❌ Erro ao buscar eventos:', err);
    res.status(500).send('Erro ao buscar eventos');
  }
};

export const criarEvento = async (req, res) => {
  try {
    const { phone, evento } = req.body;
    if (!phone || !evento) return res.status(400).send('Parâmetros ausentes');

    const phoneHash = hashPhone(phone);
    const user = await User.findOne({ phone_hash: phoneHash });

    if (!user || !user.refresh_token) return res.status(403).send('Usuário não autenticado');

    const refreshToken = decrypt(user.refresh_token);
    oAuth2Client.setCredentials({ refresh_token: refreshToken });

    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
    const timeZone = 'America/Sao_Paulo';

    const eventoGoogle = {
      summary: evento.summary,
      location: evento.location,
      description: evento.description,
      start: {
        dateTime: evento.start,
        timeZone,
      },
      end: {
        dateTime: evento.end,
        timeZone,
      },
      attendees: evento.attendees?.map(email => ({ email })),
      recurrence: evento.recurrence,
      reminders: evento.reminders,
    };

    if (evento.conference) {
      eventoGoogle.conferenceData = {
        createRequest: {
          requestId: `req-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      };
    }

    const created = await calendar.events.insert({
      calendarId: 'primary',
      resource: eventoGoogle,
      conferenceDataVersion: 1,
      sendUpdates: 'all',
    });

    res.json({
      success: true,
      id: created.data.id,
      meetLink: created.data.hangoutLink,
    });
  } catch (err) {
    console.error('❌ Erro ao criar evento:', err.response?.data || err.message || err);
    res.status(500).send('Erro ao criar evento');
  }
};

export async function editarEvento(req, res) {
  try {
    const { phone, original, novo } = req.body;
    if (!original?.summary || !original?.periodo?.start || !original?.periodo?.end)
      return res.status(400).json({ success: false, message: 'Campos obrigatórios ausentes' });

    const phoneHash = hashPhone(phone);
    const user = await User.findOne({ phone_hash: phoneHash });

    if (!user || !user.refresh_token)
      return res.status(403).json({ success: false, message: 'Usuário não autenticado' });

    const refreshToken = decrypt(user.refresh_token);
    oAuth2Client.setCredentials({ refresh_token: refreshToken });

    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });

    const list = await calendar.events.list({
      calendarId: 'primary',
      timeMin: original.periodo.start,
      timeMax: original.periodo.end,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const eventos = list.data.items || [];
    const eventoOriginal = eventos.find(ev =>
      ev.summary?.toLowerCase().includes(original.summary.toLowerCase())
    );

    if (!eventoOriginal)
      return res.status(404).json({ success: false, message: 'Evento original não encontrado' });

    const eventoAtualizado = {
      summary: novo.summary || eventoOriginal.summary,
      start: {
        dateTime: novo.start,
        timeZone: 'America/Sao_Paulo',
      },
      end: {
        dateTime: novo.end,
        timeZone: 'America/Sao_Paulo',
      },
      description: novo.description || eventoOriginal.description,
      attendees: novo.attendees || eventoOriginal.attendees,
      reminders: novo.reminders || eventoOriginal.reminders,
    };

    const response = await calendar.events.update({
      calendarId: 'primary',
      eventId: eventoOriginal.id,
      requestBody: eventoAtualizado,
    });

    return res.json({ success: true, id: response.data.id });
  } catch (err) {
    console.error("❌ Erro ao editar evento:", err.response?.data || err.message || err);
    return res.status(500).json({ success: false, message: 'Erro ao editar evento' });
  }
}

export async function deletarEvento(req, res) {
  try {
    const { phone, eventId } = req.body;
    const phoneHash = hashPhone(phone);
    const user = await User.findOne({ phone_hash: phoneHash });

    if (!user || !user.refresh_token)
      return res.status(403).json({ success: false, message: 'Usuário não autenticado' });

    const refreshToken = decrypt(user.refresh_token);
    oAuth2Client.setCredentials({ refresh_token: refreshToken });

    await google.calendar({ version: 'v3', auth: oAuth2Client }).events.delete({
      calendarId: 'primary',
      eventId,
    });

    return res.json({ success: true });
  } catch (err) {
    console.error("❌ Erro ao cancelar evento:", err);
    return res.status(500).json({ success: false, message: 'Erro ao cancelar evento' });
  }
}
