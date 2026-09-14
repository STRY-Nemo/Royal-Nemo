import { useEffect, useState } from 'react';

const KEY = 'stry-install-hint';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

function isStandalone(): boolean {
  try {
    return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  } catch {
    return false;
  }
}

function dismissed(): boolean {
  try {
    return localStorage.getItem(KEY) === 'dismissed';
  } catch {
    return false;
  }
}

/**
 * One-time nudge to add the app to the home screen. Hidden once installed or
 * dismissed. Chrome offers its install prompt directly; iOS gets the two-step
 * Share instructions since Safari has no prompt.
 */
export function InstallHint() {
  const [show, setShow] = useState(() => !isStandalone() && !dismissed());
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);
  if (!show) return null;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const dismiss = () => {
    try {
      localStorage.setItem(KEY, 'dismissed');
    } catch {
      /* ignore */
    }
    setShow(false);
  };
  return (
    <div className="callout install-hint" role="note">
      <span aria-hidden="true">📲</span>
      <span className="grow small">
        <strong>Add STRY to your home screen</strong> to open it like an app.{' '}
        {prompt ? '' : ios ? 'Tap Share, then "Add to Home Screen".' : 'Open the browser menu and choose "Add to Home screen".'}
      </span>
      {prompt && (
        <button type="button" className="btn primary small" onClick={() => void prompt.prompt().then(dismiss)}>
          Install
        </button>
      )}
      <button type="button" className="icon-btn" aria-label="Dismiss" onClick={dismiss}>
        ✕
      </button>
    </div>
  );
}
