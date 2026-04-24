package db

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

const schema = `
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL,
    email       TEXT UNIQUE NOT NULL,
    password    TEXT NOT NULL,
    role        TEXT NOT NULL DEFAULT 'viewer',
    active      BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pages (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug         TEXT UNIQUE NOT NULL,
    title        TEXT NOT NULL,
    description  TEXT,
    status       TEXT NOT NULL DEFAULT 'draft',
    display_mode TEXT NOT NULL DEFAULT 'full',
    "order"      INT NOT NULL DEFAULT 0,
    metadata     JSONB NOT NULL DEFAULT '{}',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS content_blocks (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    page_id     UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    type        TEXT NOT NULL,
    content     TEXT NOT NULL DEFAULT '',
    media_url   TEXT,
    "order"     INT NOT NULL DEFAULT 0,
    settings    JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS media_files (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL,
    url         TEXT NOT NULL,
    mime_type   TEXT NOT NULL,
    size        BIGINT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS form_submissions (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_type   TEXT NOT NULL,
    data        JSONB NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notebooks (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL,
    path        TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS appearance (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    primary_color    TEXT NOT NULL DEFAULT '#8b5cf6',
    secondary_color  TEXT NOT NULL DEFAULT '#06b6d4',
    gradient_start   TEXT NOT NULL DEFAULT '#8b5cf6',
    gradient_end     TEXT NOT NULL DEFAULT '#06b6d4',
    background_image TEXT,
    foreground_image TEXT,
    dark_mode        BOOLEAN NOT NULL DEFAULT true,
    font_family      TEXT NOT NULL DEFAULT 'Inter',
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analytics_config (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config      JSONB NOT NULL DEFAULT '{}',
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default appearance
INSERT INTO appearance (id) VALUES (uuid_generate_v4()) ON CONFLICT DO NOTHING;

-- Seed default pages
INSERT INTO pages (slug, title, status, display_mode, "order") VALUES
    ('home',     'Home',       'published', 'full', 1),
    ('projects', 'Projects',   'published', 'full', 2),
    ('trace',    'Trace Data', 'published', 'full', 3),
    ('blog',     'Blog',       'published', 'full', 4),
    ('about',    'About Us',   'published', 'full', 5),
    ('contact',  'Contact Us', 'published', 'full', 6),
    ('volunteer','Volunteer',  'published', 'full', 7)
ON CONFLICT (slug) DO NOTHING;
`

func Migrate(pool *pgxpool.Pool) error {
	_, err := pool.Exec(context.Background(), schema)
	if err != nil {
		return fmt.Errorf("migrate: %w", err)
	}
	return nil
}
