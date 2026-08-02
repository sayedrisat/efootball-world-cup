import { BookOpenText, Radio, ShieldCheck, Trophy } from 'lucide-react'

const navItems = [
  { icon: Radio, label: 'Live League', to: '/' },
  { icon: BookOpenText, label: 'Rules', to: '/rules' },
  { icon: ShieldCheck, label: 'Admin', to: '/admin' },
  { icon: Trophy, label: '6 Player Cup', to: '/world-cup' },
]

function Navigation({ currentRoute }) {
  return (
    <nav className="route-nav" aria-label="Tournament routes">
      <div className="route-brand">
        <span>EF</span>
        <strong>E-Football Hub</strong>
      </div>

      <div className="route-links">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = currentRoute === item.to

          return (
            <a
              aria-current={isActive ? 'page' : undefined}
              className={`route-link${isActive ? ' route-link--active' : ''}`}
              href={`#${item.to}`}
              key={item.to}
            >
              <Icon size={17} />
              {item.label}
            </a>
          )
        })}
      </div>
    </nav>
  )
}

export default Navigation
