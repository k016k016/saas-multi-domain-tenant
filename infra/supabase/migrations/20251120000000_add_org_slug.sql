-- Add slug column to organizations table for subdomain routing
-- slug

-- 1. slug 
ALTER TABLE organizations
ADD COLUMN slug TEXT;

-- 2. slugname
UPDATE organizations
SET slug = LOWER(REGEXP_REPLACE(TRIM(name), '[^a-zA-Z0-9]+', '-', 'g'));

-- 3. NOT NULL
ALTER TABLE organizations
ALTER COLUMN slug SET NOT NULL;

-- 4. UNIQUE
ALTER TABLE organizations
ADD CONSTRAINT organizations_slug_unique UNIQUE (slug);

-- 5. slug
CREATE INDEX idx_organizations_slug ON organizations(slug);

-- 6. slug
ALTER TABLE organizations
ADD CONSTRAINT slug_format CHECK (
  slug ~ '^[a-z0-9-]+$'
  AND slug NOT IN ('www', 'app', 'admin', 'ops', 'api', 'static', 'assets')
);

COMMENT ON COLUMN organizations.slug IS 'URL';
