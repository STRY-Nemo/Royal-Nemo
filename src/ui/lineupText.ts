import type { CanyonEvent, Member, MemberId } from '../domain/types';
import { starters, teamReserves, waitingList } from '../engine/lifecycle';

/** Both teams, their substitutes and the waiting list as plain text for the alliance chat. */
export function lineupText(event: CanyonEvent, membersById: Map<MemberId, Member>): string {
  const name = (id: MemberId) => membersById.get(id)?.username ?? id;
  const lines: string[] = [`Canyon Clash ${event.date}${event.timezone ? ` (${event.timezone})` : ''} — revision ${event.revision}`];
  for (const t of event.teams) {
    lines.push('', `${t.name} ${t.local_time}:`);
    starters(event, t.id).forEach((a, i) => lines.push(`${i + 1}. ${name(a.member_id)}${a.locked ? ' (lock)' : ''}`));
    const subs = teamReserves(event, t.id);
    if (subs.length) {
      lines.push(`${t.name} substitutes:`);
      subs.forEach((a) => lines.push(`- ${name(a.member_id)}`));
    }
  }
  const waiting = waitingList(event);
  if (waiting.length) {
    lines.push('', 'Waiting list:');
    waiting.forEach((a) => lines.push(`- ${name(a.member_id)}`));
  }
  return lines.join('\n');
}

/** Opens the system share sheet when there is one, otherwise copies to the clipboard. Resolves to what happened. */
export async function shareOrCopy(title: string, text: string): Promise<'shared' | 'copied' | 'canceled'> {
  try {
    if (navigator.share) {
      await navigator.share({ title, text });
      return 'shared';
    }
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'canceled';
  }
}
