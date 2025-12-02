-- Add slug column to organizations table for subdomain routing
-- slug

-- 1. slug column (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'slug'
  ) THEN
    ALTER TABLE organizations ADD COLUMN slug TEXT;
  END IF;
END $$;

-- 2. slug value from name (only if slug is NULL)
UPDATE organizations
SET slug = LOWER(REGEXP_REPLACE(TRIM(name), '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL;

-- 3. NOT NULL constraint (idempotent)
DO $$
BEGIN
  ALTER TABLE organizations ALTER COLUMN slug SET NOT NULL;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'slug column already NOT NULL or does not exist';
END $$;

-- 4. UNIQUE constraint (idempotent)
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_slug_unique;
ALTER TABLE organizations ADD CONSTRAINT organizations_slug_unique UNIQUE (slug);

-- 5. slug index (idempotent)
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);

-- 6. slug format CHECK constraint (idempotent)
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS slug_format;
ALTER TABLE organizations
ADD CONSTRAINT slug_format CHECK (
  slug ~ '^[a-z0-9-]+$'
  AND slug NOT IN ('www', 'app', 'admin', 'ops', 'api', 'static', 'assets')
);

COMMENT ON COLUMN organizations.slug IS 'URL';
