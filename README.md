# Kumbi

Community projects & social work platform.

## Stack

- **Frontend**: React 18, TypeScript, Vite, Bun, Tailwind CSS, Shadcn/Radix, Framer Motion, TanStack Query, Zustand, Zod
- **Backend**: Go, Gin, PostgreSQL, pgx
- **Infra**: Docker Compose, Nginx, GitHub Actions

## Quick Start

```bash
# 1. Clone and setup
git clone <repo>
cd kumbi
./scripts/kumbi.sh setup

# 2. Configure secrets
cp backend/.env.example backend/.env
# Edit backend/.env with your values

# 3. Start development
./scripts/kumbi.sh dev

# 4. Create admin user
./scripts/kumbi.sh seed admin@kumbi.org yourpassword
```

Frontend: "http://localhost:5173"  
Backend: "http://localhost:8080"  
CMS: "http://localhost:5173/cms"

## Commands

| Command                                  | Description              |
| ---------------------------------------- | ------------------------ |
| `./scripts/kumbi.sh setup`               | Install all dependencies |
| `./scripts/kumbi.sh dev`                 | Start dev servers        |
| `./scripts/kumbi.sh build`               | Production build         |
| `./scripts/kumbi.sh test`                | Run all tests            |
| `./scripts/kumbi.sh lint`                | Lint all code            |
| `./scripts/kumbi.sh deploy`              | Docker Compose deploy    |
| `./scripts/kumbi.sh seed <email> <pass>` | Create admin user        |

## Project Structure

```
kumbi/
├── frontend/          # React SPA
│   └── src/
│       ├── api/       # Axios client + API functions
│       ├── components/
│       │   ├── cms/   # CMS pages
│       │   ├── forms/ # Volunteer sheet, contact form
│       │   ├── layout/# Navbar, Footer, Layouts
│       │   ├── pages/ # Public pages
│       │   └── ui/    # Shared UI components
│       ├── store/     # Zustand stores
│       └── types/     # TypeScript types
├── backend/           # Go API
│   ├── cmd/
│   │   ├── server/    # Main entrypoint
│   │   └── seed/      # Admin seeder
│   └── internal/
│       ├── api/       # Handlers, middleware, routes
│       ├── auth/      # JWT, bcrypt
│       ├── config/    # Config loader
│       ├── db/        # Connection, migrations
│       ├── models/    # Data models
│       └── services/  # Email/WhatsApp notifier
├── scripts/           # Build/deploy scripts
├── docker-compose.yml
└── .github/workflows/ # CI/CD
```

## Secrets Management

Production secrets are managed via environment variables. Never commit `.env` files.

Required secrets:

- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Long random string (min 32 chars)

Optional:

- `SMTP_HOST/PORT/USER/PASS` - Email notifications
- `WHATSAPP_WEBHOOK_URL` - WhatsApp notifications

For production, use a secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.) and inject via environment.

## CMS Features

- **Pages**: Full CRUD with display modes (full, modal, overlay, carousel, hero, link)
- **Content**: Rich text editor with markdown, media attachments
- **Media**: Upload/manage images, videos, audio, PDFs
- **Notebooks**: Import Jupyter notebooks for data display
- **Forms**: View and export contact/volunteer submissions (CSV/PDF)
- **Users**: Role-based access (admin, editor, viewer)
- **Appearance**: Colors, gradients, fonts, dark/light mode
- **Analytics**: Configurable data collection

## Public Pages

| Route             | Page                                |
| ----------------- | ----------------------------------- |
| `/`               | Home (parallax, project highlights) |
| `/projects`       | All projects                        |
| `/projects/trace` | Trace data/notebooks                |
| `/blog`           | Social work blog                    |
| `/about`          | About us                            |
| `/contact`        | Contact form                        |
| `/volunteer`      | Volunteer info                      |
| `/login`          | CMS login                           |
| `/cms`            | CMS dashboard (protected)           |
