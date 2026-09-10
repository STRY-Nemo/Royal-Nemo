/** One-link invites: <site>/#/join/CODE opens the app straight on the join form. */
export function joinLink(code: string): string {
  return `${window.location.origin}${window.location.pathname}#/join/${encodeURIComponent(code)}`;
}

/** Invite code carried by the current URL (#/join/CODE or ?invite=CODE), or null. */
export function joinCodeFromLocation(): string | null {
  const hash = window.location.hash.replace(/^#/, '');
  const m = /^\/?join\/([^/?#]+)/i.exec(hash);
  if (m) return decodeURIComponent(m[1]).trim().toUpperCase();
  const q = new URLSearchParams(window.location.search).get('invite');
  return q ? q.trim().toUpperCase() : null;
}

/** Suggests a username from an in-game name: letters, digits, dots, dashes, underscores; 3–32 chars. */
export function suggestUsername(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9_.-]+/g, '')
    .slice(0, 32);
  return base.length >= 3 ? base : base.padEnd(3, '1');
}

export function joinMessage(code: string): string {
  return `Join the STRY alliance app. Tap the link, pick your in-game name and choose a PIN. That's it.\n${joinLink(code)}`;
}

export function leaderJoinMessage(code: string): string {
  return `Leader access for the STRY alliance app. Tap the link, pick your in-game name and choose a PIN. Your account is created as a leader (lineups, attendance, accounts). Please don't forward this link.\n${joinLink(code)}`;
}
