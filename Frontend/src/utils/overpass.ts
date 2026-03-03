import type { Fountain } from "../types/fountain";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

/** Build an image URL from OSM tags (image=, wikimedia_commons=). */
function imageUrlFromTags(tags: Record<string, string> | undefined): string | undefined {
  if (!tags) return undefined;
  const img = tags.image ?? tags.photo ?? tags.image_url ?? tags.photo_url;
  if (img?.startsWith("http")) return img;
  if (img?.startsWith("File:") || img?.startsWith("file:")) {
    const file = img.replace(/^file:/i, "").trim();
    return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}`;
  }
  const wiki = tags.wikimedia_commons ?? tags["image:wikimedia_commons"];
  if (wiki) {
    const file = wiki.startsWith("File:") ? wiki : `File:${wiki}`;
    return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}`;
  }
  return undefined;
}

/** Build description from OSM tags (description, note, operator, bottle, etc.). */
function descriptionFromTags(tags: Record<string, string> | undefined): string | undefined {
  if (!tags) return undefined;
  const parts: string[] = [];
  if (tags.description) parts.push(tags.description);
  if (tags.note) parts.push(tags.note);
  if (tags.operator) parts.push(`Operator: ${tags.operator}`);
  if (tags.bottle === "yes") parts.push("Bottle refill available.");
  if (tags.indoor === "yes") parts.push("Indoor.");
  if (tags.seasonal === "yes") parts.push("May be seasonal.");
  return parts.length ? parts.join(" ") : undefined;
}

/** Fetch drinking water nodes from OpenStreetMap near a point. All returned fountains use the blue AdminPin. */
export async function fetchWaterFountains(
  latitude: number,
  longitude: number,
  radiusMeters: number = 5000,
): Promise<Fountain[]> {
  const query = `[out:json][timeout:15];
node(around:${Math.round(radiusMeters)},${latitude},${longitude})["amenity"="drinking_water"];
out body;`;

  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: query,
  });

  if (!res.ok) throw new Error(`Overpass error: ${res.status}`);
  const json = (await res.json()) as {
    elements?: Array<{
      type: string;
      id: number;
      lat: number;
      lon: number;
      tags?: Record<string, string>;
    }>;
  };

  const elements = json.elements ?? [];
  return elements
    .filter((el) => el.lat != null && el.lon != null)
    .map((el) => {
      const tags = el.tags ?? {};
      const imageUrl = imageUrlFromTags(tags);
      const description = descriptionFromTags(tags);
      const category = tags.operator || (tags.bottle === "yes" ? "Refill" : undefined);
      return {
        id: el.id,
        name: tags.name ?? "Water fountain",
        latitude: el.lat,
        longitude: el.lon,
        description: description || undefined,
        imageUrl: imageUrl || undefined,
        images: imageUrl ? [imageUrl] : undefined,
        category: category || undefined,
        isOperational: true,
        isFree: true,
        useAdminPin: true,
      };
    }) as Fountain[];
}
