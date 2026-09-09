import { useMemo, useState } from 'react';
import { PLACEHOLDER_NAMES } from '../data/seed';
import { suggestMatches } from '../engine/organization';
import { useFeedback } from '../motion';
import { useStore } from '../store/store';
import { Header, MemberPickerSheet } from '../ui/common';

/**
 * One-time leader review that maps spreadsheet labels (Rouge, Nemo, ...) to
 * real roster members. Suggestions are shown; nothing is merged silently.
 */
export function MappingScreen() {
  const { state, actions, membersById, isLeader } = useStore();
  const { toast } = useFeedback();
  const [pickFor, setPickFor] = useState<string | null>(null);
  const names = useMemo(() => state.organization.dropdown_names.filter((n) => !PLACEHOLDER_NAMES.includes(n)), [state.organization.dropdown_names]);
  const usage = (name: string) => state.organization.responsibilities.filter((r) => r.slots.some((s) => s.source_name === name && !s.placeholder)).length;

  return (
    <>
      <Header title="Map leadership names" back="/organize" />
      <main className="page">
        <p className="muted small">
          Source dropdown names come from the leadership spreadsheet. Suggested matches are based on similar usernames and must be confirmed by a leader. Rouge/Queen Rouge, Nemo/Nemo Hoes and Mario/Mario AK47 look like aliases; Roso and RosolinoFriddi are not assumed identical.
        </p>
        <div className="list">
          {names.map((name) => {
            const mapped = state.organization.name_mapping[name];
            const suggestions = suggestMatches(name, state.members).slice(0, 3);
            return (
              <div key={name} className="card">
                <div className="card-row">
                  <div className="grow">
                    <h3>{name}</h3>
                    <div className="faint">
                      Used in {usage(name)} task{usage(name) === 1 ? '' : 's'} · {mapped ? `mapped to ${membersById.get(mapped)?.username}` : 'not mapped'}
                    </div>
                  </div>
                  {isLeader && (
                    <button type="button" className="btn secondary small" onClick={() => setPickFor(name)}>
                      {mapped ? 'Change' : 'Choose'}
                    </button>
                  )}
                </div>
                {!mapped && suggestions.length > 0 && isLeader && (
                  <div className="filter-row" aria-label={`Suggestions for ${name}`}>
                    {suggestions.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        className="chip tap"
                        onClick={() => {
                          if (actions.mapName(name, m.id).ok) toast({ kind: 'ok', text: `${name} → ${m.username}` });
                        }}
                      >
                        {m.username}?
                      </button>
                    ))}
                  </div>
                )}
                {mapped && isLeader && (
                  <button type="button" className="link-btn" style={{ padding: 0 }} onClick={() => actions.mapName(name, null).ok && toast({ kind: 'ok', text: `${name} unmapped (existing slots keep their member)` })}>
                    Remove mapping
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </main>
      <MemberPickerSheet
        open={!!pickFor}
        title={`Map "${pickFor}" to`}
        onClose={() => setPickFor(null)}
        recent={pickFor ? suggestMatches(pickFor, state.members).map((m) => m.id) : []}
        selectedMemberId={pickFor ? state.organization.name_mapping[pickFor] : null}
        onPick={(o) => {
          if (pickFor && actions.mapName(pickFor, o.key).ok) toast({ kind: 'ok', text: `${pickFor} → ${o.label}` });
          setPickFor(null);
        }}
      />
    </>
  );
}
