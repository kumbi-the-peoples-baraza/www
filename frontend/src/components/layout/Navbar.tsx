import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useVolunteerStore } from "@/store/volunteerStore";
import { useContactStore } from "@/store/contactStore";
import { useAuthStore } from "@/store/authStore";
import ThemeSwitcher from "@/components/ui/ThemeSwitcher";
import LoginOverlay from "@/components/ui/LoginOverlay";
import { cn } from "@/lib/utils";

const navLinks = [
  { to: "/", label: "Home" },
  { to: "/projects", label: "Projects" },
  { to: "/blog", label: "Blog" },
  { to: "/about", label: "About" },
];

// Lock icon for admin login
function IconLock() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export default function Navbar() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const { open: openVolunteer } = useVolunteerStore();
  const { open: openContact } = useContactStore();
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();

  useEffect(() => setSidebarOpen(false), [location]);
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  const isActive = (to: string) =>
    to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-40 nav-surface">
        <nav className="max-w-7xl mx-auto px-6 sm:px-8 h-16 flex items-center gap-4">
          {/* ── Mobile: hamburger LEFT ── */}
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
            className="md:hidden w-10 h-10 flex items-center justify-center rounded-xl hover:bg-primary/10 transition-colors shrink-0"
            style={{ color: "hsl(var(--nav-fg))" }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="w-5 h-5"
            >
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <div className="w-9 h-9 rounded-xl flex bg-green-100  items-center justify-center font-black">
              <span id="logo"></span>
            </div>
            <span
              className="font-black text-xl items-center tracking-tight hidden sm:block"
              style={{ color: "hsl(var(--nav-fg))" }}
            >
              Kumbi
            </span>
          </Link>

          {/* Desktop nav links — centred */}
          <div className="hidden md:flex items-center gap-0.5 flex-1 justify-center">
            {navLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className={cn(
                  "nav-link px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                  isActive(l.to) && "nav-link-active",
                )}
              >
                {l.label}
              </Link>
            ))}
            <button
              onClick={openVolunteer}
              className="nav-link px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            >
              Volunteer
            </button>
            <button
              onClick={openContact}
              className="nav-link px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            >
              Contact Us
            </button>
          </div>

          {/* Spacer on mobile */}
          <div className="flex-1 md:hidden" />

          {/* ── Far right: ThemeSwitcher + admin icon ── */}
          <div className="flex items-center gap-2 shrink-0">
            <ThemeSwitcher />
            {isAuthenticated ? (
              <Link
                to="/cms"
                title="CMS Dashboard"
                className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-primary/10 transition-colors"
                style={{ color: "hsl(var(--nav-fg) / 0.7)" }}
              >
                <IconLock />
              </Link>
            ) : (
              <button
                onClick={() => setLoginOpen(true)}
                title="Admin login"
                className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-primary/10 transition-colors"
                style={{ color: "hsl(var(--nav-fg) / 0.7)" }}
              >
                <IconLock />
              </button>
            )}
          </div>
        </nav>
      </header>

      {/* ── Login overlay ── */}
      <LoginOverlay open={loginOpen} onClose={() => setLoginOpen(false)} />

      {/* ── Sidebar ── */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 sidebar-overlay"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              key="sidebar"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="fixed top-0 left-0 bottom-0 z-50 w-72 flex flex-col nav-surface shadow-2xl"
            >
              <div
                className="flex items-center justify-between px-6 h-16 border-b"
                style={{ borderColor: "hsl(var(--nav-border))" }}
              >
                <Link to="/" className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-black text-base">
                    K
                  </div>
                  <span
                    className="font-black text-xl tracking-tight"
                    style={{ color: "hsl(var(--nav-fg))" }}
                  >
                    Kumbi
                  </span>
                </Link>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-primary/10 transition-colors"
                  style={{ color: "hsl(var(--nav-fg))" }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    className="w-5 h-5"
                  >
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-1">
                {navLinks.map((l) => (
                  <Link
                    key={l.to}
                    to={l.to}
                    className={cn(
                      "nav-link flex items-center px-4 py-3.5 rounded-xl text-base font-semibold transition-all",
                      isActive(l.to) && "nav-link-active",
                    )}
                  >
                    {l.label}
                  </Link>
                ))}
                <div
                  className="my-2 border-t"
                  style={{ borderColor: "hsl(var(--nav-border))" }}
                />
                <button
                  onClick={() => {
                    openContact();
                    setSidebarOpen(false);
                  }}
                  className="nav-link flex items-center px-4 py-3.5 rounded-xl text-base font-semibold text-left w-full"
                >
                  Contact Us
                </button>
                {isAuthenticated ? (
                  <Link
                    to="/cms"
                    className="nav-link nav-link-active flex items-center px-4 py-3.5 rounded-xl text-base font-semibold"
                  >
                    CMS Dashboard ↗
                  </Link>
                ) : (
                  <button
                    onClick={() => {
                      setSidebarOpen(false);
                      setLoginOpen(true);
                    }}
                    className="nav-link flex items-center gap-2 px-4 py-3.5 rounded-xl text-base font-semibold text-left w-full"
                  >
                    <IconLock /> Admin Login
                  </button>
                )}
              </nav>

              <div
                className="px-4 pb-6 pt-4 flex flex-col gap-3 border-t"
                style={{ borderColor: "hsl(var(--nav-border))" }}
              >
                <button
                  onClick={() => {
                    openVolunteer();
                    setSidebarOpen(false);
                  }}
                  className="btn-primary w-full"
                >
                  Volunteer with Kumbi
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
