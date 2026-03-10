-- Speed up geographic queries on the water_sources table.
-- Run this in the Supabase SQL editor or via a migration tool.

CREATE INDEX IF NOT EXISTS idx_water_sources_latitude
  ON water_sources (latitude);

CREATE INDEX IF NOT EXISTS idx_water_sources_longitude
  ON water_sources (longitude);

-- Composite index for bounded queries (WHERE lat BETWEEN ... AND lon BETWEEN ...)
CREATE INDEX IF NOT EXISTS idx_water_sources_lat_lng
  ON water_sources (latitude, longitude);
