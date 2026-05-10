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
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name              TEXT NOT NULL,
    url               TEXT NOT NULL,
    mime_type         TEXT NOT NULL,
    size              BIGINT NOT NULL DEFAULT 0,
    gallery_published BOOLEAN NOT NULL DEFAULT false,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

CREATE TABLE IF NOT EXISTS page_views (
    id         BIGSERIAL PRIMARY KEY,
    path       TEXT NOT NULL,
    referrer   TEXT,
    ua         TEXT,
    country    TEXT,
    ts         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS page_views_ts_idx ON page_views (ts DESC);
CREATE INDEX IF NOT EXISTS page_views_path_idx ON page_views (path);

-- site_config: all editable text, images, and links for the public site
CREATE TABLE IF NOT EXISTS site_config (
    id      TEXT PRIMARY KEY DEFAULT 'default',
    data    JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO site_config (id, data) VALUES ('default', $site_config_seed${
  "nav": { "brand": "Kumbi", "tagline": "The People's Baraza" },
  "hero": {
    "heading": "Building a Better Community Together",
    "subheading": "Kumbi drives meaningful change across Kenya through data, democracy, and dedicated social work.",
    "image": "https://images.unsplash.com/photo-1489392191049-fc10c97e64b6?w=1920&q=90&auto=format&fit=crop",
    "ctaPrimary": "Explore Projects",
    "ctaSecondary": "Learn More"
  },
  "projects": {
    "heading": "Our Projects",
    "subheading": "Three pillars of community transformation driving real, measurable impact across Kenya.",
    "tagline": "Empowering communities — one project at a time",
    "backgroundImage": "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=1600&q=80&auto=format&fit=crop",
    "items": [
      { "id": "trace", "title": "KumbiTrace", "tag": "Missing Persons · Data", "link": "/projects/trace",
        "description": "Born from the 2024 Nairobi protests, KumbiTrace is a crowd-sourced platform for tracking enforced disappearances.",
        "image": "https://images.unsplash.com/photo-1591189863430-ab87e120f312?w=900&q=80&auto=format&fit=crop" },
      { "id": "vote", "title": "KumbiVote", "tag": "Blockchain · Elections", "link": "/projects",
        "description": "A bulletproof blockchain-based distributed elections management platform built for Africa.",
        "image": "https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?w=900&q=80&auto=format&fit=crop" },
      { "id": "social", "title": "Social Work", "tag": "Community · Volunteers", "link": "/blog",
        "description": "Connecting volunteers with communities in need through coordinated social programmes across Kenya.",
        "image": "https://images.unsplash.com/photo-1509099836639-18ba1795216d?w=900&q=80&auto=format&fit=crop" }
    ]
  },
  "volunteer": {
    "heading": "Ready to Make a Difference?",
    "subheading": "Join hundreds of volunteers already working with Kumbi to transform communities across Nairobi and Kenya.",
    "cta": "Volunteer with Kumbi",
    "backgroundImage": "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=1600&q=80&auto=format&fit=crop"
  },
  "footer": {
    "about": "Driving meaningful change across Kenya through data, democracy, and dedicated social work.",
    "address": "Ngong Road, Kilimani",
    "city": "Nairobi, Kenya",
    "email": "hello@kumbi.org",
    "phone": "+254 700 000 000",
    "copyright": "© 2026 The People's Baraza. All Rights Reserved."
  },
  "pages": {
    "about":    { "heroImage": "https://images.unsplash.com/photo-1611348586804-61bf6c080437?w=1400&q=80&auto=format&fit=crop", "story": "" },
    "projects": { "heroImage": "https://images.unsplash.com/photo-1611348586804-61bf6c080437?w=1400&q=80&auto=format&fit=crop" },
    "blog":     { "heroImage": "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=1400&q=80&auto=format&fit=crop" },
    "volunteer":{ "heroImage": "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=1400&q=80&auto=format&fit=crop" },
    "trace":    { "heroImage": "https://images.unsplash.com/photo-1591189863430-ab87e120f312?w=1400&q=80&auto=format&fit=crop" }
  }
}$site_config_seed$) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS blog_posts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug            TEXT UNIQUE NOT NULL,
    title           TEXT NOT NULL,
    excerpt         TEXT NOT NULL DEFAULT '',
    body            TEXT NOT NULL DEFAULT '',
    cover_image     TEXT,
    cover_caption   TEXT,
    status          TEXT NOT NULL DEFAULT 'draft',
    author_id       UUID REFERENCES users(id) ON DELETE SET NULL,
    published_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- People / team members
CREATE TABLE IF NOT EXISTS people (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL,
    position    TEXT NOT NULL DEFAULT '',
    bio         TEXT NOT NULL DEFAULT '',
    portrait    TEXT,
    published   BOOLEAN NOT NULL DEFAULT false,
    "order"     INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ALTER TABLE additions (safe to re-run via IF NOT EXISTS / DO NOTHING)
ALTER TABLE media_files ADD COLUMN IF NOT EXISTS gallery_published BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE blog_posts   ADD COLUMN IF NOT EXISTS cover_caption TEXT;

-- Seed default appearance
INSERT INTO appearance (id) VALUES (uuid_generate_v4()) ON CONFLICT DO NOTHING;

-- Seed default analytics config
INSERT INTO analytics_config (id) VALUES (uuid_generate_v4()) ON CONFLICT DO NOTHING;

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
