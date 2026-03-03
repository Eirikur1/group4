import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { getWaterSources, insertWaterSource, type InsertWaterSourceBody } from './supabase';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic routes
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'The Sustainable Island API - Water Fountains',
    version: '1.0.0',
  });
});

// User-uploaded water sources (Supabase via backend)
app.get('/api/water-sources', async (req: Request, res: Response) => {
  try {
    const data = await getWaterSources();
    res.json(data);
  } catch (e) {
    console.error('GET /api/water-sources', e);
    res.status(500).json({ error: 'Failed to fetch water sources' });
  }
});

app.post('/api/water-sources', async (req: Request, res: Response) => {
  try {
    const body = req.body as InsertWaterSourceBody;
    if (!body?.name || typeof body.latitude !== 'number' || typeof body.longitude !== 'number' || !Array.isArray(body.images)) {
      res.status(400).json({ error: 'Missing or invalid name, latitude, longitude, or images' });
      return;
    }
    const row = await insertWaterSource(body);
    if (!row) {
      res.status(500).json({ error: 'Failed to create water source' });
      return;
    }
    res.status(201).json(row);
  } catch (e) {
    console.error('POST /api/water-sources', e);
    res.status(500).json({ error: 'Failed to create water source' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
