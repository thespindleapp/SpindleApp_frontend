export function HangerRail() {
  return (
    <svg className="hanger-rail" viewBox="0 0 240 150" aria-hidden="true">
      <path d="M18 31 C70 29 150 32 222 30" />
      <path d="M30 31 L26 138" />
      <path d="M210 30 L214 138" />
      <path d="M12 138 L44 138" />
      <path d="M198 138 L230 138" />
      <circle cx="16" cy="143" r="4" />
      <circle cx="226" cy="143" r="4" />
      <g className="hanger-sway is-a">
        <path d="M64 40 L64 34 C64 27 71 27 71 32" />
        <path d="M64 40 L46 54 L82 54 Z" />
      </g>
      <g className="hanger-sway is-b">
        <path d="M104 40 L104 34 C104 27 111 27 111 32" />
        <path d="M104 40 L86 54 L122 54 Z" />
        <path d="M104 54 L104 60" />
        <path d="M89 60 L119 60 L119 81 L89 81 Z" className="hanger-garment" />
        <path d="M89 60 L104 72 L119 60" />
      </g>
      <g className="hanger-sway is-c">
        <path d="M144 40 L144 34 C144 27 151 27 151 32" />
        <path d="M144 40 L126 54 L162 54 Z" />
      </g>
      <g className="hanger-sway is-d">
        <path d="M182 40 L182 34 C182 27 189 27 189 32" />
        <path d="M182 40 L166 54 L198 54 Z" />
      </g>
    </svg>
  );
}

export function EmptyThreadMark() {
  return (
    <svg className="empty-thread" viewBox="0 0 160 200" aria-hidden="true">
      <path d="M74 16 L86 16 L86 28 L74 28 Z" />
      <path d="M62 30 C50 34 48 50 54 66 C58 78 56 90 50 104 C46 116 52 124 80 124 C108 124 114 116 110 104 C104 90 102 78 106 66 C112 50 110 34 98 30 C90 27 70 27 62 30 Z" className="empty-thread-body" />
      <path d="M80 124 L80 176" />
      <path d="M80 176 L56 194" />
      <path d="M80 176 L104 194" />
      <path d="M80 176 L80 196" />
      <g className="hanger-sway is-a">
        <path d="M64 30 C70 52 66 74 72 100" className="empty-thread-yarn" />
        <path d="M64 30 C70 52 66 74 72 100" strokeDasharray="1 5" />
      </g>
      <g className="hanger-sway is-b" style={{ transformOrigin: '96px 30px', animationDuration: '3.6s', animationDelay: '-1.8s' }}>
        <path d="M96 30 C92 48 98 62 94 80" className="empty-thread-yarn" />
        <path d="M96 30 C92 48 98 62 94 80" strokeDasharray="1 5" />
      </g>
      <path d="M84 52 L92 47" />
      <circle cx="93" cy="46" r="2" />
      <path d="M82 64 L88 58" />
      <circle cx="89" cy="57" r="2" />
    </svg>
  );
}

export function MailboxMark() {
  return (
    <svg className="inbox-mailbox" viewBox="0 0 250 160" aria-hidden="true">
      <path className="inbox-trail" d="M8 66 C28 70 34 50 22 46 C10 42 12 62 32 58 C44 55 48 44 54 38" />
      <g className="inbox-plane">
        <path d="M56 36 L92 22 L72 46 Z" className="inbox-plane-body" />
        <path d="M72 46 L70 34 L92 22" />
      </g>
      <path d="M140 150 L140 96" />
      <path d="M152 150 L152 96" />
      <path d="M104 96 L104 62 C104 44 118 36 138 36 L176 36 C196 36 206 48 206 64 L206 96 Z" className="inbox-box" />
      <path d="M104 62 C104 48 114 40 126 40 C140 40 148 50 148 62 L148 96" />
      <path d="M114 70 L138 70" />
      <path d="M196 72 L196 22" />
      <g className="inbox-flag">
        <path d="M196 22 L222 22 L222 38 L196 38" />
      </g>
      <path d="M60 150 C110 148 170 152 230 150" />
      <path d="M118 150 C120 144 124 144 126 150" />
      <path d="M164 150 C166 142 172 143 172 150" />
    </svg>
  );
}

export function SupplierMark() {
  return (
    <svg className="supplier-mark" viewBox="0 0 260 160" aria-hidden="true">
      <path d="M30 140 L30 82 L70 62 L70 82 L110 62 L110 82 L150 62 L150 140 Z" className="supplier-mill" />
      <path d="M160 96 L160 40 L178 40 L178 96" />
      <path d="M150 96 L204 96 L204 140 L150 140" />
      <path d="M44 100 L58 100 L58 114 L44 114 Z" />
      <path d="M76 100 L90 100 L90 114 L76 114 Z" />
      <path d="M108 100 L122 100 L122 114 L108 114 Z" />
      <path d="M168 140 L168 116 L186 116 L186 140" />
      <path d="M12 140 C80 138 170 142 248 140" />
      <path className="supplier-smoke" d="M169 34 C160 24 178 20 170 10 C166 4 176 0 184 2" />
      <g className="supplier-letter">
        <path d="M196 0 L228 0 L228 22 L196 22 Z" />
        <path d="M196 0 L212 13 L228 0" />
      </g>
    </svg>
  );
}
