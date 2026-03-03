export interface Fountain {
  /** number for mock/Overpass, string (uuid) for user-uploaded from Supabase */
  id: number | string;
  name: string;
  latitude: number;
  longitude: number;
  description?: string;
  isOperational: boolean;
  distance?: string;
  rating?: number;
  isFree?: boolean;
  imageUrl?: string;
  images?: string[];
  category?: string;
  /** When true, show the blue AdminPin (e.g. for API-sourced fountains) */
  useAdminPin?: boolean;
}
