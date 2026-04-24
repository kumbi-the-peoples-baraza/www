import { Link } from 'react-router-dom'
import { Github, Twitter, Mail } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="glass border-t border-white/10 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-1 sm:grid-cols-3 gap-8">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg gradient-bg flex items-center justify-center text-white font-bold text-xs">J</div>
            <span className="font-bold gradient-text">Kumbi</span>
          </div>
          <p className="text-sm text-muted-foreground">Community projects & social work making a difference.</p>
        </div>
        <div>
          <h4 className="font-semibold mb-3 text-sm">Quick Links</h4>
          <div className="flex flex-col gap-2 text-sm text-muted-foreground">
            {[['/', 'Home'], ['/projects', 'Projects'], ['/blog', 'Blog'], ['/about', 'About'], ['/contact', 'Contact']].map(([to, label]) => (
              <Link key={to} to={to} className="hover:text-primary transition-colors">{label}</Link>
            ))}
          </div>
        </div>
        <div>
          <h4 className="font-semibold mb-3 text-sm">Connect</h4>
          <div className="flex gap-3">
            {[Github, Twitter, Mail].map((Icon, i) => (
              <a key={i} href="#" className="p-2 glass-card hover:bg-primary/10 transition-colors rounded-xl">
                <Icon className="w-4 h-4" />
              </a>
            ))}
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Kumbi. All rights reserved.
      </div>
    </footer>
  )
}
