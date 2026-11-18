const ROWS = [
  ['Daily digest', 'One email at 8:30 with values to check'],
  ['When two emails disagree', 'Sent straight away'],
  ['Weekly range summary', 'Mondays, for buyers and admins'],
] as const;

export function NotificationsPage() {
  return (
    <div className="page settings-page">
      <header>
        <span className="forwarding-kicker">Settings · Notifications</span>
        <h1>Notifications</h1>
        <p className="forwarding-lede">Spindle does not send these emails yet.</p>
      </header>
      <div className="settings-rows">
        {ROWS.map(([title, detail]) => (
          <div className="settings-row" key={title}>
            <span className="settings-row-copy">
              <span className="settings-row-title">{title}</span>
              <span className="settings-row-detail">{detail}</span>
            </span>
            <span className="settings-row-value">Not sent yet</span>
          </div>
        ))}
      </div>
    </div>
  );
}
