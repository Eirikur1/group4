import express, { Application, Request, Response } from "express";
import cors from "cors";
import { getUserIdFromRequest } from "./auth";
import {
  getWaterSources,
  getOrCreateByOsmNodeId,
  insertWaterSource,
  addImagesToWaterSource,
  deleteWaterSource,
  updateWaterSource,
  type InsertWaterSourceBody,
  type UpdateWaterSourceBody,
} from "./supabase";

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

app.post("/api/water-sources/by-osm", async (req: Request, res: Response) => {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      res.status(401).json({ error: "Sign in to use this location." });
      return;
    }
    const body = req.body as {
      osm_node_id?: number;
      name?: string;
      latitude?: number;
      longitude?: number;
    };
    if (
      body?.osm_node_id == null ||
      typeof body.osm_node_id !== "number" ||
      typeof body.latitude !== "number" ||
      typeof body.longitude !== "number"
    ) {
      res.status(400).json({
        error: "Missing or invalid osm_node_id, latitude, or longitude",
      });
      return;
    }
    const row = await getOrCreateByOsmNodeId(
      body.osm_node_id,
      typeof body.name === "string" ? body.name : "Water fountain",
      body.latitude,
      body.longitude
    );
    if (!row) {
      res.status(500).json({ error: "Failed to get or create water source." });
      return;
    }
    res.status(200).json(row);
  } catch (e: unknown) {
    console.error("POST /api/water-sources/by-osm", e);
    const message =
      e && typeof e === "object" && "message" in e
        ? String((e as { message: unknown }).message)
        : "Failed to get or create location";
    res.status(500).json({ error: message });
  }
});

app.post("/api/water-sources", async (req: Request, res: Response) => {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      res.status(401).json({ error: "Sign in to add a location." });
      return;
    }
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
    const row = await insertWaterSource(body, userId);
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

app.patch("/api/water-sources/:id/images", async (req: Request, res: Response) => {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      res.status(401).json({ error: "Sign in to add photos." });
      return;
    }
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { images } = req.body as { images?: string[] };
    if (!Array.isArray(images) || images.length === 0) {
      res.status(400).json({ error: "images array required" });
      return;
    }
    const row = await addImagesToWaterSource(id, images, userId);
    if (!row) {
      res.status(403).json({ error: "Only the creator can add photos." });
      return;
    }
    res.json(row);
  } catch (e: unknown) {
    console.error("PATCH /api/water-sources/:id/images", e);
    const message =
      e && typeof e === "object" && "message" in e
        ? String((e as { message: unknown }).message)
        : "Failed to update images";
    res.status(500).json({ error: message });
  }
});

app.patch("/api/water-sources/:id", async (req: Request, res: Response) => {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      res.status(401).json({ error: "Sign in to edit a location." });
      return;
    }
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const body = req.body as UpdateWaterSourceBody;
    const row = await updateWaterSource(id, body, userId);
    if (!row) {
      res.status(403).json({ error: "Only the creator can edit this location." });
      return;
    }
    res.json(row);
  } catch (e: unknown) {
    console.error("PATCH /api/water-sources/:id", e);
    const message =
      e && typeof e === "object" && "message" in e
        ? String((e as { message: unknown }).message)
        : "Failed to update location";
    res.status(500).json({ error: message });
  }
});

app.delete("/api/water-sources/:id", async (req: Request, res: Response) => {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      res.status(401).json({ error: "Sign in to delete a location." });
      return;
    }
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const ok = await deleteWaterSource(id, userId);
    if (!ok) {
      res.status(403).json({ error: "Only the creator can delete this location." });
      return;
    }
    res.status(204).send();
  } catch (e: unknown) {
    console.error("DELETE /api/water-sources/:id", e);
    res.status(500).json({ error: "Failed to delete location" });
  }
});

export default app;
