import { Mail, Phone, MapPin, Globe } from "lucide-react";
import { useContactStore } from "@/store/contactStore";
import { useConfig } from "@/hooks/useConfig";

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
        {/* Brand */}
        <div>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-16 h-16 rounded-xl bg-blue-200 flex items-center justify-center text-primary-foreground font-black text-lg">
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
          <p
            className="text-sm leading-relaxed mb-7 max-w-sm"
            style={{ color: fgMuted }}
          >
            {f.about}
          </p>
          <div className="flex gap-3">
            {[Globe, Globe, Globe].map((Icon, i) => (
              <a
                key={i}
                href="#"
                className="w-10 h-10 rounded-xl border flex items-center justify-center hover:bg-primary/10 hover:border-primary hover:text-primary transition-all"
                style={{ borderColor: border, color: fgMuted }}
              >
                <Icon className="w-4 h-4" />
              </a>
            ))}
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
