/**
 * Guest tour: anyone with the link explores the app with sample data and no
 * account. Runs the app in demo mode (local only, nothing shared) with the
 * leader view so every screen is open. Opening #/guest turns it on; "Exit
 * tour" turns it off and returns to sign-in.
 */
const KEY = 'stry-guest';

export function guestEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) === 'on';
  } catch {
    return false;
  }
}

/**
 * Called before first render: #/guest in the URL switches the device into the
 * tour. Also listens for the hash changing to #/guest while the app is open
 * (a link tapped inside the app) and reloads so the store starts in tour mode.
 */
export function claimGuestFromLocation(): void {
  const claim = (reload: boolean) => {
    if (!/^#\/?guest\b/i.test(window.location.hash)) return;
    try {
      localStorage.setItem(KEY, 'on');
    } catch {
      /* ignore */
    }
    window.location.replace(`${window.location.pathname}#/home`);
    if (reload) window.location.reload();
  };
  claim(false);
  window.addEventListener('hashchange', () => claim(true));
}

export function enterGuest(): void {
  try {
    localStorage.setItem(KEY, 'on');
  } catch {
    /* ignore */
  }
  window.location.hash = '#/home';
  window.location.reload();
}

export function exitGuest(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  window.location.hash = '#/home';
  window.location.reload();
}

export function guestLink(): string {
  return `${window.location.origin}${window.location.pathname}#/guest`;
}

export function guestMessage(): string {
  return `Take a look at the STRY alliance app. Tap the link for a guided look with sample data, no account needed.\n${guestLink()}`;
}
