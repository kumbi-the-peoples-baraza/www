-- Jupyter Notebook CMS Schema
CREATE TYPE notebook_status AS ENUM ('active', 'archived', 'deleted');
CREATE TYPE notebook_source AS ENUM ('github_url', 'local_upload');

CREATE TABLE notebooks (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title       TEXT NOT NULL,
    description TEXT,
    source_type notebook_source NOT NULL,
    source_url  TEXT,                      -- GitHub raw URL or original filename
    raw_json    JSONB NOT NULL,            -- full .ipynb content
    cells_json  JSONB NOT NULL DEFAULT '[]', -- parsed CellDTO array (cache)
    kernel      TEXT,                      -- e.g. "python3"
    language    TEXT,                      -- e.g. "python"
    status      notebook_status NOT NULL DEFAULT 'active',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    archived_at TIMESTAMPTZ,
    deleted_at  TIMESTAMPTZ
);

-- Pages that embed a notebook dashboard
CREATE TABLE pages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug        TEXT UNIQUE NOT NULL,
    title       TEXT NOT NULL,
    notebook_id UUID REFERENCES notebooks(id) ON DELETE SET NULL,
    published   BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notebooks_status  ON notebooks(status);
CREATE INDEX idx_notebooks_created ON notebooks(created_at DESC);
CREATE INDEX idx_pages_slug        ON pages(slug);
CREATE INDEX idx_pages_notebook    ON pages(notebook_id);

-- Auto-update updated_at
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
;

CREATE TRIGGER notebooks_updated BEFORE UPDATE ON notebooks
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER pages_updated BEFORE UPDATE ON pages
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
