import { NavLink } from 'react-router-dom';

export function SettingsNav({
  variant,
  teamCount,
  plan,
}: {
  variant: 'side' | 'bar';
  teamCount: number | null;
  plan: string | null;
}) {
  const items = [
    { to: '/settings/profile', label: 'Profile', note: '' },
    { to: '/settings/team', label: 'Team and roles', note: teamCount === null ? '' : String(teamCount) },
    { to: '/settings/subscription', label: 'Subscription', note: plan ?? '' },
    { to: '/settings/email-connections', label: 'Forwarding', note: '' },
    { to: '/settings/notifications', label: 'Notifications', note: '' },
  ];

  return (
    <nav className={variant === 'side' ? 'side-nav' : 'settings-bar'} aria-label="Settings">
      {variant === 'side' ? <div className="side-label">Settings</div> : null}
      {items.map((item) => (
        <NavLink key={item.to} to={item.to}>
          <span>{item.label}</span>
          <span className="count">{item.note}</span>
        </NavLink>
      ))}
    </nav>
  );
}
