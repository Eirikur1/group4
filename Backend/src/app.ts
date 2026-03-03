import express, { Application, Request, Response } from "express";
import cors from "cors";
import { getWaterSources, insertWaterSource, type InsertWaterSourceBody } from "./supabase";

const app: Application = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req: Request, res: Response) => {
  res.json({
    message: "The Sustainable Island API - Water Fountains",
    version: "1.0.0",
  });
});

app.get("/api/water-sources", async (req: Request, res: Response) => {
  try {
    const data = await getWaterSources();
    res.json(data);
  } catch (e) {
    console.error("GET /api/water-sources", e);
    res.status(500).json({ error: "Failed to fetch water sources" });
  }
});

app.post("/api/water-sources", async (req: Request, res: Response) => {
  try {
    const body = req.body as InsertWaterSourceBody;
    if (
      !body?.name ||
      typeof body.latitude !== "number" ||
      typeof body.longitude !== "number" ||
      !Array.isArray(body.images)
    ) {
      res.status(400).json({
        error: "Missing or invalid name, latitude, longitude, or images",
      });
      return;
    }
    const row = await insertWaterSource(body);
    if (!row) {
      res.status(500).json({
        error:
          "Failed to create water source. Backend has no Supabase config: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel.",
      });
      return;
    }
    res.status(201).json(row);
  } catch (e: unknown) {
    console.error("POST /api/water-sources", e);
    const message =
      e && typeof e === "object" && "message" in e
        ? String((e as { message: unknown }).message)
        : "Failed to create water source";
    res.status(500).json({ error: message });
  }
});

export default app;
