import { Mail, Phone, MapPin } from "lucide-react";
import { useContactStore } from "@/store/contactStore";
import { useConfig } from "@/hooks/useConfig";
import { SafeHtml } from "@/components/ui/SafeHtml";

const XIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const InstagramIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
  </svg>
);

const FacebookIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

export default function Footer() {
  const { open: openContact } = useContactStore();
  const cfg = useConfig();
  const f = cfg.footer;
  const fg = "hsl(var(--nav-fg))";
  const fgMuted = "hsl(var(--nav-fg) / 0.65)";
  const border = "hsl(var(--nav-border))";

  return (
    <footer
      style={{
        background: "hsl(var(--nav-bg))",
        borderTop: `1px solid ${border}`,
      }}
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-10 pt-16 pb-10 grid grid-cols-1 md:grid-cols-2 gap-12">
        {/* Brand — theme-aware */}
        <div>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-16 h-16 rounded-xl bg-card border border-border shadow-sm logo-glow flex items-center justify-center font-black text-lg">
              <span id="logo"></span>
            </div>
            <div>
              <span className="font-black text-xl tracking-tight text-primary block">
                {cfg.nav.brand}
              </span>
              <span
                className="text-xs font-semibold tracking-widest uppercase"
                style={{ color: fgMuted }}
              >
                {cfg.nav.tagline}
              </span>
            </div>
          </div>
          <SafeHtml
            html={f.about}
            className="text-sm leading-relaxed mb-7 max-w-sm rich-content"
            as="p"
            style={{ color: fgMuted }}
          />

          <div className="flex gap-3">
            {f.twitter && (
              <a
                href={f.twitter}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-xl border flex items-center justify-center hover:bg-primary/10 hover:border-primary hover:text-primary transition-all"
                style={{ borderColor: border, color: fgMuted }}
              >
                <XIcon className="w-4 h-4" />
              </a>
            )}
            {f.instagram && (
              <a
                href={f.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-xl border flex items-center justify-center hover:bg-primary/10 hover:border-primary hover:text-primary transition-all"
                style={{ borderColor: border, color: fgMuted }}
              >
                <InstagramIcon className="w-4 h-4" />
              </a>
            )}
            {f.facebook && (
              <a
                href={f.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-xl border flex items-center justify-center hover:bg-primary/10 hover:border-primary hover:text-primary transition-all"
                style={{ borderColor: border, color: fgMuted }}
              >
                <FacebookIcon className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>

        {/* Contact */}
        <div>
          <h4
            className="font-black text-sm mb-6 uppercase tracking-widest"
            style={{ color: fg }}
          >
            Get in Touch
          </h4>
          <div className="flex flex-col gap-5">
            <div className="flex items-start gap-4">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: fg }}>
                  {cfg.nav.brand}
                </p>
                <p className="text-sm" style={{ color: fgMuted }}>
                  {f.address}
                </p>
                <p className="text-sm" style={{ color: fgMuted }}>
                  {f.city}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Mail className="w-4 h-4 text-primary" />
              </div>
              <a
                href={`mailto:${f.email}`}
                className="text-sm font-semibold hover:text-primary transition-colors"
                style={{ color: fgMuted }}
              >
                {f.email}
              </a>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Phone className="w-4 h-4 text-primary" />
              </div>
              <a
                href={`tel:${f.phone.replace(/\s/g, "")}`}
                className="text-sm font-semibold hover:text-primary transition-colors"
                style={{ color: fgMuted }}
              >
                {f.phone}
              </a>
            </div>
            <button
              onClick={openContact}
              className="btn-primary mt-2 self-start"
            >
              <Mail className="w-5 h-5" /> Get in Touch
            </button>
          </div>
        </div>
      </div>

      <div
        className="border-t py-5 text-center text-sm font-medium"
        style={{ borderColor: border, color: fgMuted }}
      >
        {f.copyright}
      </div>
    </footer>
  );
}
