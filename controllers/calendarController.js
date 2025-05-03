
import { oAuth2Client } from '../services/googleService.js';
import { google } from 'googleapis';
import User from '../models/User.js';

export const buscarEventosPorData = async (req, res) => {
  try {
    const { phone, start, end } = req.query;
    if (!phone || !start || !end) {
      return res.status(400).send('Parâmetros ausentes');
    }

    const user = await User.findOne({ phone });
    if (!user || !user.refresh_token) {
      return res.status(403).send('Usuário não autenticado');
    }

    oAuth2Client.setCredentials({ refresh_token: user.refresh_token });

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

    const user = await User.findOne({ phone });
    if (!user || !user.refresh_token)
      return res.status(403).send('Usuário não autenticado');

    oAuth2Client.setCredentials({ refresh_token: user.refresh_token });
    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });

    const timeZone = 'America/Sao_Paulo';

    const eventoGoogle = {
      summary: evento.summary,
      location: evento.location,
      description: evento.description,
      start: {
        dateTime: evento.start,
        timeZone
      },
      end: {
        dateTime: evento.end,
        timeZone
      },
      attendees: evento.attendees?.map(email => ({ email })),
      recurrence: evento.recurrence,
      reminders: evento.reminders,
    };

    if (evento.conference) {
      eventoGoogle.conferenceData = {
        createRequest: {
          requestId: `req-${Date.now()}`,
          conferenceSolutionKey: {
            type: 'hangoutsMeet'
          }
        }
      };
    }

    const created = await calendar.events.insert({
      calendarId: 'primary',
      resource: eventoGoogle,
      conferenceDataVersion: 1,
      sendUpdates: 'all'
    });

    res.json({
      success: true,
      id: created.data.id,
      meetLink: created.data.hangoutLink
    });
  } catch (err) {
    console.error('❌ Erro ao criar evento:', err.response?.data || err.message || err);
    res.status(500).send('Erro ao criar evento');
  }
};
