import { google } from 'googleapis';

import Env from './env';

export const youtubeApi = google.youtube({ version: 'v3', auth: Env.GOOGLE_API_KEY });
