import type { Member, OrganizationState, Responsibility, ResponsibilitySlot } from '../domain/types';
import membersJson from './members.json';
import responsibilitiesJson from './responsibilities.json';
import eventDraftJson from './event_draft.json';

/** Date the coding package was prepared; Canyon tracking starts here for all seed members. */
export const PACKAGE_DATE = '2026-09-09';
export const SERIES_ID = 'canyon-friday';

interface RawMember {
  member_id: string;
  username: string;
  alliance_rank: string;
  origin_alliance: string;
  level: number;
  arena_power_m: number;
  active: boolean;
  power_as_of: string;
}

export function loadSeedMembers(): Member[] {
  const raw = membersJson as RawMember[];
  return raw.map((m) => ({
    id: m.member_id,
    username: m.username,
    aliases: [],
    rank: m.alliance_rank as Member['rank'],
    origin_alliance: m.origin_alliance,
    level: m.level,
    arena_power_m: m.arena_power_m,
    power_as_of: m.power_as_of,
    active: m.active,
    tracking_start: PACKAGE_DATE,
  }));
}

interface RawSlot {
  position: number;
  label: string;
  source_name: string | null;
  member_id: string | null;
}
interface RawResponsibility {
  id: string;
  title: string;
  slots: RawSlot[];
}

export const PLACEHOLDER_NAMES = ['TBD', 'TBD/Rotation', 'TBD/Capo'];

export function loadSeedOrganization(): OrganizationState {
  const raw = responsibilitiesJson as { dropdown_names: string[]; responsibilities: RawResponsibility[] };
  const responsibilities: Responsibility[] = raw.responsibilities.map((r, index) => ({
    id: r.id,
    title: r.title,
    order: index,
    archived: false,
    slots: r.slots.map(
      (s): ResponsibilitySlot => ({
        position: s.position as ResponsibilitySlot['position'],
        label: s.label,
        source_name: s.source_name,
        member_id: s.member_id,
        placeholder: s.source_name && PLACEHOLDER_NAMES.includes(s.source_name) ? s.source_name : null,
      }),
    ),
  }));
  const names = raw.dropdown_names.includes('TBD') ? raw.dropdown_names : [...raw.dropdown_names, 'TBD'];
  return { responsibilities, dropdown_names: names, name_mapping: {}, revision: 1 };
}

export const seedEventDraft = eventDraftJson as {
  event_date: string;
  timezone: string | null;
  teams: { name: string; local_time: string; capacity: number }[];
};
