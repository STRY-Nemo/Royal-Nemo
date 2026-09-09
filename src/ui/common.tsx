import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { CanyonEvent, EventStatus, Member, MemberId, Team } from '../domain/types';
import { deviceTimeZone, formatInZone, isValidTimeZone, zonedWallTimeToUtc, zoneAbbreviation } from '../engine/recurrence';
import { normalizeName } from '../engine/organization';
import { BottomSheet } from '../motion';
import { useRouter, type Tab } from '../store/router';
import { fmtPower, initials, useStore } from '../store/store';
import { BackIcon, CanyonIcon, HomeIcon, MembersIcon, OrganizeIcon, SearchIcon, SettingsIcon, StarIcon } from './icons';

// ---- Header -------------------------------------------------------------

export function Header({ title, back, actions }: { title?: string; back?: string | (() => void); actions?: ReactNode }) {
  const router = useRouter();
  return (
    <header className="app-header">
      {back !== undefined ? (
        <button type="button" className="icon-btn" aria-label="Back" onClick={() => (typeof back === 'function' ? back() : router.back(back))}>
          <BackIcon />
        </button>
      ) : (
        <div className="brand">
          <img src="/brand/stry-logo.png" alt="" width={32} height={32} />
          <span>STRY</span>
        </div>
      )}
      {title && (
        <div className="title truncate" role="heading" aria-level={1}>
          {title}
        </div>
      )}
      {!title && <div className="title" />}
      {actions}
      <button type="button" className="icon-btn" aria-label="Settings and account" onClick={() => router.navigate('/settings')}>
        <SettingsIcon />
      </button>
    </header>
  );
}

// ---- Tab bar --------------------------------------------------------------

const TABS: { tab: Tab; label: string; Icon: typeof HomeIcon }[] = [
  { tab: 'home', label: 'Home', Icon: HomeIcon },
  { tab: 'canyon', label: 'Canyon', Icon: CanyonIcon },
  { tab: 'organize', label: 'Organize', Icon: OrganizeIcon },
  { tab: 'members', label: 'Members', Icon: MembersIcon },
];

export function TabBar() {
  const { route, switchTab } = useRouter();
  const hidden = route.segments[0] === 'settings';
  if (hidden) return null;
  return (
    <nav className="tab-bar" aria-label="Main">
      <div className="tab-bar-inner">
        {TABS.map(({ tab, label, Icon }) => (
          <button key={tab} type="button" className="tab" aria-current={route.tab === tab ? 'page' : undefined} onClick={() => switchTab(tab)}>
            <Icon />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

export function StickyActions({ children }: { children: ReactNode }) {
  return (
    <div className="sticky-actions">
      <div className="sticky-actions-inner">{children}</div>
    </div>
  );
}

// ---- Misc ---------------------------------------------------------------

export function StatusBadge({ status }: { status: EventStatus }) {
  const label = status === 'draft' ? 'Draft' : status === 'published' ? 'Published' : status === 'finalized' ? 'Finalized' : 'Canceled';
  return <span className={`badge ${status}`}>{label}</span>;
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <StarIcon className="star" />
      <h3>{title}</h3>
      {children && <p className="small">{children}</p>}
      {action}
    </div>
  );
}

export function Avatar({ name }: { name: string }) {
  return (
    <span className="avatar" aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export function DemoBanner() {
  const { restored } = useStore();
  return (
    <div className="demo-banner" role="note">
      <span aria-hidden="true">⚠️</span>
      <span>
        <strong>Demo mode.</strong> Data is stored only in this browser{restored ? ' (restored from local storage)' : ''}. Nothing is shared with other members until the server build (milestone 4).
      </span>
    </div>
  );
}

/** Event date and team times shown in the event timezone and the device timezone. */
export function EventTimes({ event, compact }: { event: CanyonEvent; compact?: boolean }) {
  const device = deviceTimeZone();
  const tz = event.timezone && isValidTimeZone(event.timezone) ? event.timezone : null;
  const dateLabel = useMemo(() => {
    const [y, m, d] = event.date.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  }, [event.date]);
  return (
    <div className="stat" style={{ gap: 4 }}>
      <div style={{ fontWeight: 600 }} className="wrap">
        {dateLabel}
        {!event.date_confirmed && <span className="badge draft" style={{ marginLeft: 8 }}>Date to confirm</span>}
      </div>
      {tz ? (
        <div className="small muted wrap">
          Event timezone: {tz}
          {!compact && device !== tz && <> · Your device: {device}</>}
        </div>
      ) : (
        <div className="small" style={{ color: 'var(--warn)' }}>
          {compact ? 'Timezone not set' : 'Timezone not set — times below are wall-clock only'}
        </div>
      )}
      {!compact && (
        <div className="list" style={{ gap: 4, marginTop: 4 }}>
          {event.teams.map((t) => (
            <TeamTimeLine key={t.id} event={event} team={t} tz={tz} device={device} />
          ))}
        </div>
      )}
    </div>
  );
}

export function TeamTimeLine({ event, team, tz, device }: { event: CanyonEvent; team: Team; tz: string | null; device: string }) {
  if (!tz) {
    return (
      <div className="small">
        <strong>{team.name}</strong> {team.local_time}
      </div>
    );
  }
  const instant = zonedWallTimeToUtc(event.date, team.local_time, tz);
  const local = formatInZone(instant, device);
  const abbr = zoneAbbreviation(instant, tz);
  return (
    <div className="small wrap">
      <strong>{team.name}</strong> {team.local_time} {abbr}
      {device !== tz && <span className="muted"> · {local} on your device</span>}
    </div>
  );
}

export function PowerText({ m }: { m: number }) {
  return <span className="mono">{fmtPower(m)}</span>;
}

// ---- Search input ---------------------------------------------------------

export function SearchInput({ value, onChange, placeholder = 'Search', autoFocus }: { value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean }) {
  return (
    <div className="search">
      <SearchIcon />
      <input className="input" type="search" inputMode="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} autoFocus={autoFocus} autoComplete="off" />
    </div>
  );
}

export function matchesSearch(member: Member, query: string): boolean {
  if (!query.trim()) return true;
  const q = normalizeName(query);
  return normalizeName(member.username).includes(q) || member.aliases.some((a) => normalizeName(a).includes(q)) || member.id.includes(q);
}

// ---- Member picker sheet ----------------------------------------------------

export interface PickerOption {
  key: string;
  label: string;
  hint?: string;
  member?: Member;
  selected?: boolean;
  disabled?: boolean;
  disabledReason?: string;
}

interface PickerProps {
  open: boolean;
  title: string;
  onClose: () => void;
  onPick: (option: PickerOption) => void;
  /** Shown before the member list (e.g. Clear, TBD, leadership names). */
  fixedOptions?: PickerOption[];
  /** Restrict the full-roster section to these members; default all active. */
  members?: Member[];
  /** Members that are disabled in the roster, with a reason. */
  disabledMembers?: Map<MemberId, string>;
  /** Recently picked member ids appear first. */
  recent?: MemberId[];
  selectedMemberId?: MemberId | null;
  extraHint?: (m: Member) => string | undefined;
}

export function MemberPickerSheet({ open, title, onClose, onPick, fixedOptions = [], members, disabledMembers, recent = [], selectedMemberId, extraHint }: PickerProps) {
  const { state } = useStore();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) setQuery('');
  }, [open]);
  const roster = members ?? state.members.filter((m) => m.active);
  const list = useMemo(() => {
    const filtered = roster.filter((m) => matchesSearch(m, query));
    const recentSet = new Set(recent);
    return [...filtered].sort((a, b) => {
      const ra = recentSet.has(a.id) ? 0 : 1;
      const rb = recentSet.has(b.id) ? 0 : 1;
      if (ra !== rb) return ra - rb;
      return a.username.localeCompare(b.username, undefined, { sensitivity: 'base' });
    });
  }, [roster, query, recent]);
  const fixed = fixedOptions.filter((o) => !query.trim() || normalizeName(o.label).includes(normalizeName(query)));
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <SearchInput value={query} onChange={setQuery} placeholder="Search members" autoFocus />
      <div className="list" role="listbox" aria-label={title}>
        {fixed.map((o) => (
          <button key={o.key} type="button" className="sheet-item" role="option" aria-selected={!!o.selected} disabled={o.disabled} onClick={() => onPick(o)}>
            <div className="grow">
              <div className="label wrap">{o.label}</div>
              {(o.hint || o.disabledReason) && <div className="hint">{o.disabledReason ?? o.hint}</div>}
            </div>
          </button>
        ))}
        {fixed.length > 0 && list.length > 0 && <div className="faint" style={{ padding: '4px 4px 0' }}>All members ({list.length})</div>}
        {list.map((m) => {
          const reason = disabledMembers?.get(m.id);
          return (
            <button key={m.id} type="button" className="sheet-item" role="option" aria-selected={selectedMemberId === m.id} disabled={!!reason} onClick={() => onPick({ key: m.id, label: m.username, member: m })}>
              <Avatar name={m.username} />
              <div className="grow">
                <div className="label wrap">{m.username}</div>
                <div className="hint">
                  {fmtPower(m.arena_power_m)} · {m.rank}
                  {extraHint?.(m) ? ` · ${extraHint(m)}` : ''}
                  {reason ? ` · ${reason}` : ''}
                </div>
              </div>
            </button>
          );
        })}
        {list.length === 0 && fixed.length === 0 && <div className="faint">No matches.</div>}
      </div>
      <input ref={inputRef} type="hidden" />
    </BottomSheet>
  );
}
