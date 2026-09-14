import type { Availability, AvailabilityChoice, SlotPriorities, Team } from '../domain/types';
import { currentSlots } from './SlotPicker';
import { preferenceFromSlots, quickFromSlots, quickOptions, slotsForPreference, type Preference } from './quickAvailability';

interface Props {
  teams: Team[];
  current: Pick<Availability, 'choice' | 'slots'> | undefined;
  onSave: (choice: AvailabilityChoice, slots?: SlotPriorities) => void;
  disabled?: boolean;
  /** Accessible name for the group, e.g. the member's name on the collect screen. */
  label?: string;
}

/**
 * One row of big answers (Either / 18:00 / 23:00 / Can't). When both times work,
 * a second row lets the player put one time first; the rotation gives them that
 * time whenever there is room.
 */
export function QuickAvailability({ teams, current, onSave, disabled, label }: Props) {
  const slots = currentSlots(current);
  const quick = quickFromSlots(slots);
  const pref = preferenceFromSlots(slots);
  const prefs: { key: Preference; label: string }[] = [
    { key: 'team1', label: `${teams[0]?.local_time ?? 'Team 1'} first` },
    { key: 'team2', label: `${teams[1]?.local_time ?? 'Team 2'} first` },
    { key: 'none', label: 'No preference' },
  ];
  return (
    <div className="list" style={{ gap: 6 }}>
      <div className="quick-avail" role="group" aria-label={label ?? 'Availability'}>
        {quickOptions(teams).map((o) => (
          <button key={o.key} type="button" className={o.key} aria-pressed={quick === o.key} disabled={disabled} onClick={() => onSave(o.choice, o.slots)}>
            {o.label}
          </button>
        ))}
      </div>
      {quick === 'either' && (
        <div className="prefer-row" role="group" aria-label={`${label ?? 'Availability'} preference`}>
          <span className="small muted">Prefer</span>
          {prefs.map((p) => (
            <button key={p.key} type="button" className="chip" aria-pressed={pref === p.key} disabled={disabled} onClick={() => onSave('either', slotsForPreference(p.key))}>
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
