// 底部三 Tab 导航（R11）：props { active, onChange }，三 Tab（问候/日历/设置）。
// 激活态 text-brand 加粗，未激活 text-ink-sub。

function GreetingIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-6 w-6" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-6 w-6" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" />
      <circle cx="9" cy="7" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="7" cy="17" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

const TABS = [
  { id: 'greeting', label: '问候', Icon: GreetingIcon },
  { id: 'calendar', label: '日历', Icon: CalendarIcon },
  { id: 'settings', label: '设置', Icon: SettingsIcon },
];

export default function TabBar({ active, onChange }) {
  return (
    <nav className="flex shrink-0 border-t border-black/5 bg-surface" aria-label="主导航">
      {TABS.map(({ id, label, Icon }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-current={isActive ? 'page' : undefined}
            className={`flex flex-1 flex-col items-center gap-1 py-2.5 transition-colors ${
              isActive ? 'text-brand' : 'text-ink-sub'
            }`}
          >
            <Icon />
            <span className={`text-xs ${isActive ? 'font-bold' : ''}`}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
