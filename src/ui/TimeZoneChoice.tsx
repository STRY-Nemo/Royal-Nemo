import { useState } from 'react';
import { APOCALYPSE_TIME_ZONE, COMMON_TIME_ZONES, deviceTimeZone, timeZoneLabel } from '../engine/recurrence';

interface Props {
  id: string;
  /** Selected zone, '' for none, or '__custom' while typing another name. */
  value: string;
  customValue: string;
  onChange: (tz: string) => void;
  onCustomChange: (name: string) => void;
  disabled?: boolean;
}

/**
 * Two big choices cover almost everyone: the game clock and this phone's zone.
 * "Other" reveals the full list and a free-text field for the rare exception.
 */
export function TimeZoneChoice({ id, value, customValue, onChange, onCustomChange, disabled }: Props) {
  const device = deviceTimeZone();
  const isGame = value === APOCALYPSE_TIME_ZONE;
  const isDevice = value === device && !isGame;
  const [other, setOther] = useState(!!value && !isGame && !isDevice);
  const showOther = other || (!!value && !isGame && !isDevice);
  return (
    <div className="list" style={{ gap: 8 }}>
      <div className="segmented" role="group" aria-label="Timezone">
        <button type="button" aria-pressed={isGame} className={isGame ? 'on' : ''} disabled={disabled} onClick={() => { setOther(false); onChange(APOCALYPSE_TIME_ZONE); }}>
          Game time
          <small>Apocalypse, UTC−2</small>
        </button>
        <button type="button" aria-pressed={isDevice} className={isDevice ? 'on' : ''} disabled={disabled} onClick={() => { setOther(false); onChange(device); }}>
          My device
          <small>{device}</small>
        </button>
        <button type="button" aria-pressed={showOther} className={showOther ? 'on' : ''} disabled={disabled} onClick={() => setOther(true)}>
          Other
          <small>{showOther && value && value !== '__custom' ? timeZoneLabel(value) : 'pick a zone'}</small>
        </button>
      </div>
      {showOther && (
        <>
          <select id={id} className="select" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
            <option value="">Not set</option>
            {!COMMON_TIME_ZONES.includes(device) && <option value={device}>{device} (this device)</option>}
            {COMMON_TIME_ZONES.map((z) => (
              <option key={z} value={z}>
                {timeZoneLabel(z)}
                {z === device ? ' (this device)' : ''}
              </option>
            ))}
            <option value="__custom">Type another name…</option>
          </select>
          {value === '__custom' && <input className="input" placeholder="e.g. Europe/Warsaw" value={customValue} onChange={(e) => onCustomChange(e.target.value)} aria-label="Custom timezone" disabled={disabled} />}
        </>
      )}
    </div>
  );
}
