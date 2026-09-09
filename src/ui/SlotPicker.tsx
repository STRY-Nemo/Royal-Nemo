import type { Availability, SlotPriorities, SlotPriority, Team } from '../domain/types';
import { slotsFromChoice } from '../engine/suggest';

/** Current per-slot answer for display, falling back to the plain choice of older records. */
export function currentSlots(av: Pick<Availability, 'choice' | 'slots'> | undefined): SlotPriorities | null {
  if (!av) return null;
  return av.slots ?? slotsFromChoice(av.choice);
}

/**
 * Applies a tap on one slot: setting a slot as 1st demotes the other's 1st to 2nd,
 * setting 2nd promotes the other to 1st, and a lone answer is always "1st".
 */
export function applySlotTap(current: SlotPriorities | null, key: keyof SlotPriorities, value: SlotPriority): SlotPriorities {
  const other: keyof SlotPriorities = key === 'team1' ? 'team2' : 'team1';
  const next: SlotPriorities = { team1: current?.team1 ?? 0, team2: current?.team2 ?? 0 };
  next[key] = value;
  if (value === 1 && next[other] === 1) next[other] = 2;
  if (value === 2 && next[other] === 2) next[other] = 1;
  if (value === 2 && next[other] === 0) next[key] = 1;
  if (value === 0 && next[other] === 2) next[other] = 1;
  return next;
}

interface Props {
  teams: Team[];
  value: SlotPriorities | null;
  onChange: (next: SlotPriorities) => void;
  disabled?: boolean;
  compact?: boolean;
}

/** Two rows (18:00 and 23:00) with 1st / 2nd / Can't buttons, plus "Can't play this week". */
export function SlotPicker({ teams, value, onChange, disabled, compact }: Props) {
  const keys: (keyof SlotPriorities)[] = ['team1', 'team2'];
  const options: { v: SlotPriority; label: string }[] = [
    { v: 1, label: '1st' },
    { v: 2, label: '2nd' },
    { v: 0, label: compact ? '✕' : "Can't" },
  ];
  return (
    <div className={`slot-picker${compact ? ' compact' : ''}`}>
      {keys.map((key, i) => {
        const team = teams[i];
        if (!team) return null;
        const cur = value?.[key] ?? null;
        return (
          <div key={key} className="slot-row">
            <div className="slot-label">
              <strong>{team.local_time}</strong>
              {!compact && <small className="muted"> {team.name}</small>}
            </div>
            <div className="segmented small" role="group" aria-label={`${team.name} ${team.local_time}`}>
              {options.map((o) => (
                <button key={o.v} type="button" aria-pressed={cur === o.v} className={cur === o.v ? `on p${o.v}` : ''} disabled={disabled} onClick={() => onChange(applySlotTap(value, key, o.v))}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        );
      })}
      {!compact && (
        <button type="button" className={`btn ${value && value.team1 === 0 && value.team2 === 0 ? 'danger' : 'ghost'} block`} disabled={disabled} onClick={() => onChange({ team1: 0, team2: 0 })}>
          Can't play this week
        </button>
      )}
    </div>
  );
}
