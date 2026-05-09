# Frontend Guide

## Getting started

```bash
cd frontend
bun install
bun run dev        # http://localhost:5173
bun run build      # production build → dist/
bun run test       # vitest
bun run lint       # eslint
```

## Design system

The UI uses a glass morphism aesthetic (Android-style) built on top of Tailwind CSS utility classes defined in `src/index.css` and `src/components/ui/components.css`.

### Key utility classes

| Class | Purpose |
|---|---|
| `.glass` | Frosted glass background + border |
| `.glass-card` | Glass + rounded corners + shadow |
| `.gradient-text` | Primary → cyan gradient text |
| `.gradient-bg` | Full gradient background |
| `.input-field` | Consistent form input styling |
| `.btn-primary` | Gradient CTA button |
| `.btn-ghost` | Transparent hover button |
| `.section` | Centred max-width page section |
| `.shimmer-bg` | Loading skeleton animation |

### CSS variables (in `:root` / `.dark`)

All colours are HSL CSS variables so the entire palette can be swapped at runtime (used by the Appearance CMS page):

```
--background, --foreground
--primary, --primary-foreground
--secondary, --muted, --accent
--border, --input, --ring
--radius
--gradient-start, --gradient-end
```

### Dark / light mode

Controlled by `useThemeStore`. The `theme` value (`'dark'` | `'light'`) is applied as a class on the root `<div>` in `App.tsx`. Tailwind's `darkMode: ['class']` config picks it up.

### Text zoom

`useThemeStore.textZoom` (0.75–1.5rem) is injected as `--text-zoom` CSS variable on the root div. `body { font-size: var(--text-zoom, 1rem) }` scales all text proportionally.

## Adding a new public page

1. Create `src/components/pages/MyPage.tsx`
2. Add a lazy import in `App.tsx`
3. Add a `<Route>` inside the `<Layout>` route group
4. Add a nav link in `Navbar.tsx` if needed

## Adding a new CMS section

1. Create `src/components/cms/MySection.tsx`
2. Add a lazy import in `App.tsx`
3. Add a `<Route>` inside the `/cms` protected route group
4. Add a nav item in `CMSLayout.tsx`

## API client

All API calls go through `src/api/client.ts` which:
- Sets `baseURL` to `/api/v1` (proxied by Vite dev server to `localhost:8080`)
- Attaches `Authorization: Bearer <token>` from `authStore` on every request
- Auto-calls `logout()` on any 401 response

## Forms

All forms use `react-hook-form` + `zod` resolver. Example pattern:

```tsx
const schema = z.object({ name: z.string().min(1) })
type FormData = z.infer<typeof schema>

const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
  resolver: zodResolver(schema),
})
```

## Volunteer sheet

The volunteer registration form is a Framer Motion slide-in panel (`VolunteerSheet.tsx`) that can be opened from anywhere via `useVolunteerStore().open()`. It includes a TipTap rich text editor for the skills field.

## Loading states

- Route-level: `<Suspense fallback={<PageLoader />}>` wraps all lazy routes
- Data-level: TanStack Query `isLoading` + `<Skeleton>` components
- Mutations: `isPending` disables submit buttons
