# API Reference

Base URL: `/api/v1`

All protected endpoints require `Authorization: Bearer <jwt>` header.

---

## Authentication

### POST `/auth/login`

Login and receive a JWT.

**Request:**

```json
{
  "email": "admin@kumbi.local",
  "password": "yourpassword"
}
```

**Response (200):**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "name": "Admin",
    "email": "admin@kumbi.local",
    "role": "admin"
  }
}
```

**Errors:**

- `401` — Invalid credentials

---

### POST `/auth/logout`

Logout (client-side only, JWT remains valid until expiry).

**Response (200):**

```json
{ "message": "logged out" }
```

---

### GET `/auth/me`

Get current user info.

**Headers:** `Authorization: Bearer <jwt>`

**Response (200):**

```json
{
  "id": "uuid",
  "name": "Admin",
  "email": "admin@kumbi.local",
  "role": "admin"
}
```

**Errors:**

- `401` — Invalid or missing token
- `404` — User not found

---

## Pages

### GET `/pages`

List all pages.

**Response (200):**

```json
[
  {
    "id": "uuid",
    "slug": "home",
    "title": "Home",
    "description": "...",
    "status": "published",
    "displayMode": "full",
    "order": 1,
    "metadata": {},
    "createdAt": "2026-04-24T10:00:00Z",
    "updatedAt": "2026-04-24T10:00:00Z"
  }
]
```

---

### GET `/pages/:slug`

Get a single page by slug.

**Response (200):**

```json
{
  "id": "uuid",
  "slug": "about",
  "title": "About Us",
  "description": "...",
  "status": "published",
  "displayMode": "full",
  "order": 5,
  "metadata": {},
  "createdAt": "2026-04-24T10:00:00Z",
  "updatedAt": "2026-04-24T10:00:00Z"
}
```

**Errors:**

- `404` — Page not found

---

### POST `/pages`

Create a new page.

**Headers:** `Authorization: Bearer <jwt>` (admin or editor)

**Request:**

```json
{
  "slug": "new-page",
  "title": "New Page",
  "description": "Optional description",
  "status": "draft",
  "displayMode": "full",
  "order": 10
}
```

**Response (201):**

```json
{ "id": "uuid" }
```

**Errors:**

- `400` — Validation error
- `401` — Unauthorized
- `403` — Forbidden (insufficient role)

---

### PUT `/pages/:id`

Update an existing page.

**Headers:** `Authorization: Bearer <jwt>` (admin or editor)

**Request (all fields optional):**

```json
{
  "title": "Updated Title",
  "description": "Updated description",
  "status": "published",
  "displayMode": "modal",
  "order": 2
}
```

**Response (200):**

```json
{ "message": "updated" }
```

**Errors:**

- `400` — Validation error
- `401` — Unauthorized
- `403` — Forbidden

---

### DELETE `/pages/:id`

Delete a page.

**Headers:** `Authorization: Bearer <jwt>` (admin only)

**Response (200):**

```json
{ "message": "deleted" }
```

**Errors:**

- `401` — Unauthorized
- `403` — Forbidden

---

## Forms

### POST `/forms/contact`

Submit a contact form.

**Request:**

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "subject": "Inquiry",
  "message": "Hello, I'd like to know more about..."
}
```

**Response (201):**

```json
{ "message": "submitted" }
```

Triggers email + WhatsApp notification if configured.

---

### POST `/forms/volunteer`

Submit a volunteer registration.

**Request:**

```json
{
  "firstName": "Jane",
  "lastName": "Doe",
  "email": "jane@example.com",
  "phone": "+254702550800",
  "skills": "<p>I can help with...</p>"
}
```

**Response (201):**

```json
{ "message": "submitted" }
```

---

### GET `/forms/:type/submissions`

List all submissions for a form type (`contact` or `volunteer`).

**Headers:** `Authorization: Bearer <jwt>` (admin or editor)

**Response (200):**

```json
[
  {
    "id": "uuid",
    "formType": "contact",
    "data": { "name": "Jane Doe", "email": "...", ... },
    "createdAt": "2026-04-24T10:00:00Z"
  }
]
```

---

### GET `/forms/:type/export/csv`

Export submissions as CSV.

**Headers:** `Authorization: Bearer <jwt>` (admin or editor)

**Response (200):**

- Content-Type: `text/csv`
- Content-Disposition: `attachment; filename="contact-submissions.csv"`

---

## Media

### POST `/media`

Upload a file.

**Headers:** `Authorization: Bearer <jwt>`

**Request:** `multipart/form-data` with a `file` field

**Response (201):**

```json
{
  "id": "uuid",
  "url": "/storage/abc123.jpg",
  "name": "original-filename.jpg"
}
```

---

### GET `/media`

List all uploaded files.

**Headers:** `Authorization: Bearer <jwt>`

**Response (200):**

```json
[
  {
    "id": "uuid",
    "name": "photo.jpg",
    "url": "/storage/abc123.jpg",
    "mimeType": "image/jpeg",
    "size": 123456,
    "createdAt": "2026-04-24T10:00:00Z"
  }
]
```

---

### DELETE `/media/:id`

Delete a media file.

**Headers:** `Authorization: Bearer <jwt>` (admin only)

**Response (200):**

```json
{ "message": "deleted" }
```

---

## Notebooks

### POST `/notebooks`

Upload a Jupyter notebook (`.ipynb`).

**Headers:** `Authorization: Bearer <jwt>` (admin or editor)

**Request:** `multipart/form-data` with a `notebook` field

**Response (201):**

```json
{
  "id": "uuid",
  "name": "analysis.ipynb"
}
```

---

### GET `/notebooks`

List all notebooks.

**Headers:** `Authorization: Bearer <jwt>`

**Response (200):**

```json
[
  {
    "id": "uuid",
    "name": "analysis.ipynb",
    "path": "/storage/notebooks/abc123.ipynb",
    "uploadedAt": "2026-04-24T10:00:00Z"
  }
]
```

---

### GET `/notebooks/:id`

Get a single notebook by ID.

**Headers:** `Authorization: Bearer <jwt>`

**Response (200):**

```json
{
  "id": "uuid",
  "name": "analysis.ipynb",
  "path": "/storage/notebooks/abc123.ipynb",
  "uploadedAt": "2026-04-24T10:00:00Z"
}
```

---

## Appearance

### GET `/appearance`

Get the current appearance settings.

**Response (200):**

```json
{
  "id": "uuid",
  "primaryColor": "#8b5cf6",
  "secondaryColor": "#06b6d4",
  "gradientStart": "#8b5cf6",
  "gradientEnd": "#06b6d4",
  "backgroundImage": null,
  "foregroundImage": null,
  "darkMode": true,
  "fontFamily": "Inter",
  "updatedAt": "2026-04-24T10:00:00Z"
}
```

---

### PUT `/appearance`

Update appearance settings.

**Headers:** `Authorization: Bearer <jwt>` (admin only)

**Request (all fields optional):**

```json
{
  "primaryColor": "#ff0000",
  "secondaryColor": "#00ff00",
  "gradientStart": "#ff0000",
  "gradientEnd": "#00ff00",
  "backgroundImage": "/storage/bg.jpg",
  "foregroundImage": null,
  "darkMode": false,
  "fontFamily": "Roboto"
}
```

**Response (200):**

```json
{ "message": "updated" }
```

---

## Health

### GET `/health`

Health check endpoint.

**Response (200):**

```json
{ "status": "ok" }
```

---

## Users

All user endpoints require `Authorization: Bearer <jwt>` (admin only).

### GET `/users`

List all users.

**Response (200):**

```json
[
  {
    "id": "uuid",
    "name": "Admin",
    "email": "admin@kumbi.local",
    "role": "admin",
    "active": true,
    "createdAt": "2026-04-24T10:00:00Z"
  }
]
```

---

### POST `/users`

Create a new user.

**Request:**

```json
{
  "name": "Jane Doe",
  "email": "jane@kumbi.local",
  "password": "secret",
  "role": "editor"
}
```

`role` defaults to `viewer` if omitted.

**Response (201):**

```json
{ "id": "uuid" }
```

---

### PUT `/users/:id`

Update a user. All fields optional.

**Request:**

```json
{
  "name": "Jane Doe",
  "role": "admin",
  "active": false,
  "password": "newpassword"
}
```

**Response (200):**

```json
{ "message": "updated" }
```

---

### DELETE `/users/:id`

Delete a user.

**Response (200):**

```json
{ "message": "deleted" }
```

---

## Analytics

### GET `/analytics`

Get the current analytics configuration. Public endpoint.

**Response (200):**

```json
{
  "id": "uuid",
  "config": { "ga4MeasurementId": "G-XXXXXXXX" },
  "updatedAt": "2026-04-24T10:00:00Z"
}
```

---

### PUT `/analytics`

Update the analytics configuration.

**Headers:** `Authorization: Bearer <jwt>` (admin only)

**Request:**

```json
{
  "config": {
    "ga4MeasurementId": "G-XXXXXXXX",
    "plausibleDomain": "kumbi.local"
  }
}
```

**Response (200):**

```json
{ "message": "updated" }
```

---

## Content Blocks

### GET `/content/:pageId`

List all content blocks for a page, ordered by `order`.

**Headers:** `Authorization: Bearer <jwt>`

**Response (200):**

```json
[
  {
    "id": "uuid",
    "pageId": "uuid",
    "type": "text",
    "content": "<p>Hello world</p>",
    "mediaUrl": null,
    "order": 0,
    "settings": {},
    "createdAt": "2026-04-24T10:00:00Z",
    "updatedAt": "2026-04-24T10:00:00Z"
  }
]
```

---

### POST `/content/:pageId`

Create a content block.

**Headers:** `Authorization: Bearer <jwt>` (admin or editor)

**Request:**

```json
{
  "type": "text",
  "content": "<p>Hello world</p>",
  "mediaUrl": "",
  "order": 0
}
```

Block types: `text`, `image`, `video`, `audio`, `pdf`, `notebook`, `form`

**Response (201):**

```json
{ "id": "uuid" }
```

---

### PUT `/content/:id`

Update a content block. All fields optional.

**Headers:** `Authorization: Bearer <jwt>` (admin or editor)

**Request:**

```json
{
  "content": "<p>Updated</p>",
  "mediaUrl": "/storage/photo.jpg",
  "order": 1
}
```

**Response (200):**

```json
{ "message": "updated" }
```

---

### DELETE `/content/:id`

Delete a content block.

**Headers:** `Authorization: Bearer <jwt>` (admin or editor)

**Response (200):**

```json
{ "message": "deleted" }
```

---

## Site Config

Single-document store for all editable public-site content (nav, hero, projects, volunteer section, footer, page hero images). Edited via the CMS **Site Content** page.

### GET `/config`

Returns the full site config JSON. Public — no auth required.

**Response (200):** Full `SiteConfig` object (see `frontend/src/hooks/useConfig.ts` for the shape).

---

### PUT `/config`

Replace the site config. **Headers:** `Authorization: Bearer <jwt>` (admin or editor)

**Request:** Full or partial `SiteConfig` JSON object.

**Response (200):**
```json
{ "message": "updated" }
```

---

## Blog

### GET `/blog`

List published blog posts (public).

**Response (200):** Array of post objects with `id`, `slug`, `title`, `excerpt`, `body`, `coverImage`, `status`, `publishedAt`, `createdAt`.

---

### GET `/blog/:slug`

Get a single published post by slug (public).

---

### GET `/blog/all`

List all posts including drafts. **Headers:** `Authorization: Bearer <jwt>`

---

### POST `/blog`

Create a blog post. **Headers:** `Authorization: Bearer <jwt>` (admin or editor)

**Request:**
```json
{
  "slug": "my-post",
  "title": "My Post",
  "excerpt": "Short summary",
  "body": "<p>HTML body from rich text editor</p>",
  "coverImage": "https://...",
  "status": "draft"
}
```

Setting `status: "published"` automatically sets `published_at` to now.

---

### PUT `/blog/:id`

Update a blog post. **Headers:** `Authorization: Bearer <jwt>` (admin or editor)

All fields optional (PATCH semantics).

---

### DELETE `/blog/:id`

Delete a blog post. **Headers:** `Authorization: Bearer <jwt>` (admin)
