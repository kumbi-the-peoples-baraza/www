# Backend Guide

## Getting started

```bash
cd backend
go mod download
go run ./cmd/server    # http://localhost:8080
```

Secrets are loaded from `.env` — run `make dev` from the project root, which sources that file before starting the server. For running the backend in isolation, export the required vars manually or source the file:

```bash
set -a; source ../.env; set +a
go run ./cmd/server
```

## Environment variables

| Variable               | Required | Description                                                             |
| ---------------------- | -------- | ----------------------------------------------------------------------- |
| `DATABASE_URL`         | yes      | PostgreSQL DSN e.g. `postgres://user:pass@host:5432/db?sslmode=disable` |
| `JWT_SECRET`           | yes      | Random string, minimum 32 characters                                    |
| `PORT`                 | no       | HTTP port (default: `8080`)                                             |
| `ENV`                  | no       | `development` or `production` (default: `development`)                  |
| `ALLOW_ORIGIN`         | no       | CORS allowed origin (default: `http://localhost:5173`)                  |
| `STORAGE_PATH`         | no       | Path for uploaded files (default: `./storage`)                          |
| `SMTP_HOST`            | no       | SMTP server for email notifications                                     |
| `SMTP_PORT`            | no       | SMTP port (default: `587`)                                              |
| `SMTP_USER`            | no       | SMTP username / from address                                            |
| `SMTP_PASS`            | no       | SMTP password                                                           |
| `WHATSAPP_WEBHOOK_URL` | no       | Webhook URL for WhatsApp notifications                                  |

## Creating users

```bash
# Create or update the default admin
go run ./cmd/seed admin admin@kumbi.local K1llB1ll

# Create any user with a specific role
go run ./cmd/seed create-user "Jane Doe" jane@kumbi.local password123 editor
```

Re-running with the same email updates the password and role.

## Adding a new handler

1. Create `internal/api/handlers/myresource.go` with a struct and methods
2. Instantiate it in `internal/api/routes/routes.go`
3. Register routes on the appropriate group (`v1` for public, `cms` for protected)

Current handlers: `auth`, `pages`, `content`, `forms`, `media`, `notebooks`, `appearance`, `users`, `analytics`

## Database migrations

Schema is defined in `internal/db/migrations.go` as a single SQL string. It runs automatically on startup. To add a new table or column, add `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` or a new `CREATE TABLE IF NOT EXISTS` block.

## File uploads

Uploaded files are saved to `STORAGE_PATH` with a UUID filename. The URL stored in the database is `/storage/<uuid>.<ext>`. Gin serves the storage directory as static files.

Notebook files are stored in `STORAGE_PATH/notebooks/`.

## Notifications

`services.Notifier.Notify(formType, data)` is called in a goroutine after every form submission. It sends:

- An email via SMTP if `SMTP_HOST` and `SMTP_USER` are set
- A POST to `WHATSAPP_WEBHOOK_URL` if set

Both are best-effort (errors are silently dropped) so a misconfigured notifier never breaks form submission.

## Roles

| Role     | Permissions                                              |
| -------- | -------------------------------------------------------- |
| `admin`  | Full access to all CMS endpoints                         |
| `editor` | Create/update pages, upload media, view form submissions |
| `viewer` | Read-only access to protected endpoints                  |

Role is stored in the JWT claims and checked by `middleware.RequireRole(...)`.
