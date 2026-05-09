# CMS User Guide

Access the CMS at `/cms` after signing in at `/login`.

## Pages

Manage all site pages from **CMS → Pages**.

| Field | Description |
|---|---|
| Title | Display name of the page |
| Slug | URL path segment (e.g. `about` → `/about`) |
| Status | `draft` (hidden), `published` (live), `archived` |
| Display mode | How the page content is rendered (see below) |
| Description | Short summary, used in meta tags |

### Display modes

| Mode | Behaviour |
|---|---|
| `full` | Renders as a full page |
| `modal` | Opens in a centred dialog overlay |
| `overlay` | Full-screen overlay with close/minimise buttons |
| `carousel` | Content displayed as a swipeable carousel |
| `hero` | Large hero banner layout |
| `link` | Renders as a navigable link/card |

## Media

Upload images, videos, audio files, and PDFs from **CMS → Media**. Accepted formats are unrestricted — the file is stored as-is and the URL is available to attach to content blocks.

## Content

Manage content blocks for any page from **CMS → Content**. Select a page from the dropdown, then add, edit, or delete blocks.

| Block type | Description |
|---|---|
| `text` | Rich text with bold, italic, bullet list, and emoji toolbar |
| `image` | Image via media URL |
| `video` | Video via media URL |
| `audio` | Audio via media URL |
| `pdf` | PDF via media URL |
| `notebook` | Jupyter notebook reference |
| `form` | Embedded form reference |

Use **CMS → Media** to upload files and copy their URLs into media blocks.

## Forms

View submissions from the Contact Us and Volunteer forms under **CMS → Forms**. Switch between form types using the tabs. Export all submissions as CSV using the **CSV** button.

## Notebooks

Upload `.ipynb` Jupyter notebook files from **CMS → Notebooks**. Uploaded notebooks are stored on the server and their paths are available to embed in the Trace Data page.

## Appearance

Adjust the site's visual theme from **CMS → Appearance**:
- Primary and secondary brand colours
- Gradient start and end colours
- Background and foreground images
- Font family
- Dark / light mode default

Changes are saved immediately and reflected site-wide.

## Users

Manage CMS users from **CMS → Users** (admin only). You can create, edit, deactivate, and delete users.

Three roles are available:

| Role | Access |
|---|---|
| `admin` | Full access including user management, delete operations, appearance |
| `editor` | Create/edit pages, upload media, view form submissions |
| `viewer` | Read-only access to CMS data |

You can also manage users via the CLI:

```bash
make seed
make create-user NAME="Jane Doe" EMAIL=jane@example.com PASS=secret ROLE=editor
```

## Analytics

Configure analytics integrations from **CMS → Analytics** (admin only). The configuration is stored as a JSON document and is available via `GET /api/v1/analytics`. Add any key/value pairs your analytics integration requires (e.g. Google Analytics measurement ID, Plausible domain, Mixpanel token).
