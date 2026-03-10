/**
 * Seed verified (blue-pin) water fountains from OpenStreetMap into Supabase.
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/seed-osm.ts [south,west,north,east]
 *
 * Examples:
 *   npx ts-node --project tsconfig.scripts.json scripts/seed-osm.ts "63.3,-25.1,66.6,-13.3"  # Iceland
 *   npx ts-node --project tsconfig.scripts.json scripts/seed-osm.ts "35.9,-9.5,42.1,3.3"      # Spain
 *   npx ts-node --project tsconfig.scripts.json scripts/seed-osm.ts "51.4,-0.5,51.6,0.3"      # London
 *
 * If no bbox is given, defaults to the whole world (slow — use a region bbox instead).
 *
 * Requires Backend/.env with:
 *   SUPABASE_URL=https://xxxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ...
 */

import * as dotenv from "dotenv";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.join(__dirname, "../.env") });

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "\nMissing env vars. Create Backend/.env with:\n" +
      "  SUPABASE_URL=https://xxxx.supabase.co\n" +
      "  SUPABASE_SERVICE_ROLE_KEY=eyJ...\n"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Bounding box from first CLI arg, or default to world
const bboxArg = process.argv[2] ?? "-90,-180,90,180";
const [south, west, north, east] = bboxArg.split(",").map(Number);

if ([south, west, north, east].some(isNaN)) {
  console.error(`Invalid bbox "${bboxArg}". Expected "south,west,north,east" e.g. "63.3,-25.1,66.6,-13.3"`);
  process.exit(1);
}

function osmName(tags?: Record<string, string>): string {
  if (!tags) return "Drinking water";
  // Prefer explicit names in any language
  const name =
    tags.name ||
    tags["name:en"] ||
    tags["name:es"] ||
    tags["name:is"] ||
    tags["name:de"] ||
    tags["name:fr"];
  if (name) return name;
  // Fall back to description or note
  if (tags.description) return tags.description.slice(0, 60);
  if (tags.note) return tags.note.slice(0, 60);
  // Construct from address if available
  if (tags["addr:street"]) {
    const num = tags["addr:housenumber"] ? ` ${tags["addr:housenumber"]}` : "";
    return `Drinking water – ${tags["addr:street"]}${num}`;
  }
  // Use operator (e.g. "Ayuntamiento de Las Palmas")
  if (tags.operator) return `Drinking water (${tags.operator})`;
  return "Drinking water";
}

interface OsmElement {
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
}

async function fetchFromOverpass(bbox: string): Promise<OsmElement[]> {
  const query = [
    `[out:json][timeout:60];`,
    `node["amenity"="drinking_water"](${bbox});`,
    `out body 10000;`,
  ].join("\n");

  const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
  console.log(`\nQuerying Overpass API for bbox ${bbox}...`);

  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Overpass returned ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as { elements?: OsmElement[] };
  return data.elements ?? [];
}

async function run() {
  const elements = await fetchFromOverpass(`${south},${west},${north},${east}`);
  console.log(`Fetched ${elements.length} drinking water nodes.`);

  if (elements.length === 0) {
    console.log("Nothing to insert. Check your bbox or try a larger area.");
    return;
  }

  const BATCH = 200;
  let totalInserted = 0;
  let totalErrors = 0;

  for (let i = 0; i < elements.length; i += BATCH) {
    const chunk = elements.slice(i, i + BATCH);
    const rows = chunk.map((el) => ({
      name: osmName(el.tags),
      latitude: el.lat,
      longitude: el.lon,
      images: [] as string[],
      is_operational: true,
      is_verified: true,
      created_by: null,
      osm_node_id: el.id,
    }));

    // Upsert on osm_node_id so re-running the script is safe
    const { error } = await supabase
      .from("water_sources")
      .upsert(rows, { onConflict: "osm_node_id" });

    const batchNum = Math.floor(i / BATCH) + 1;
    const totalBatches = Math.ceil(elements.length / BATCH);

    if (error) {
      console.error(`  Batch ${batchNum}/${totalBatches} FAILED: ${error.message}`);
      totalErrors += chunk.length;
    } else {
      totalInserted += chunk.length;
      console.log(`  Batch ${batchNum}/${totalBatches}: ✓ ${chunk.length} rows`);
    }
  }

  console.log(`\nDone! Inserted/updated: ${totalInserted}, errors: ${totalErrors}`);
  if (totalErrors > 0) {
    console.log("Tip: make sure osm_node_id has a UNIQUE constraint — see SUPABASE.md");
  }
}

run().catch((e) => {
  console.error("Fatal error:", e instanceof Error ? e.message : e);
  process.exit(1);
});
