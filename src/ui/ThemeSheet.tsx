import { useState } from 'react';
import { BottomSheet, useFeedback } from '../motion';
import { setTheme, themeBackground, THEMES, useTheme, type Theme } from './theme';

function Thumb({ theme }: { theme: Theme }) {
  const [missing, setMissing] = useState(false);
  return (
    <span className="theme-thumb" style={{ background: `linear-gradient(160deg, ${theme.swatch[0]}, ${theme.swatch[1]})` }} aria-hidden="true">
      {!missing && <img src={themeBackground(theme.id)} alt="" loading="lazy" draggable={false} onError={() => setMissing(true)} />}
    </span>
  );
}

/** Pick the background artwork and palette for this device. */
export function ThemeSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const current = useTheme();
  const { toast, announce } = useFeedback();
  const pick = (t: Theme) => {
    setTheme(t.id);
    announce(`${t.label} theme`);
    toast({ kind: 'ok', text: `${t.label} theme` });
    onClose();
  };
  return (
    <BottomSheet open={open} onClose={onClose} title="Theme">
      <p className="faint">Changes the background art and colours on this phone only. More backgrounds appear here as the artwork lands.</p>
      <div className="list" role="listbox" aria-label="Themes">
        {THEMES.map((t) => (
          <button key={t.id} type="button" role="option" aria-selected={t.id === current} className="sheet-item theme-row" onClick={() => pick(t)}>
            <Thumb theme={t} />
            <div className="grow">
              <div className="label">{t.label}</div>
              <div className="hint">{t.blurb}</div>
            </div>
            {t.id === current && <span className="small" style={{ color: 'var(--primary)' }}>On</span>}
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}
