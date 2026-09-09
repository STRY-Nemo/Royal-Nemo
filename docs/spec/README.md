# STRY Canyon Clash coding handoff

Start by giving your coding agent START_HERE.md and this folder. This package is a product/design specification and verified seed data, not a running application.

## Confirmed requirements
- Mobile-only alliance organization app using the second, Celestial Blue STRY logo.
- Canyon Clash is the first working feature: two teams, 20 players each.
- Team 1 this week: 18:00. Team 2: 23:00. Canyon Clash recurs every Friday. Next Friday is September 11, 2026; confirm the event date in the configured timezone. Timezone is still unconfirmed.
- Use the 100-member September 7 roster. The owner confirmed that its Power (M) column means arena power in millions.
- Aim for nearly equal participation over time, automatically maintaining weekly history and suggesting rotation.
- Leaders can override suggestions to include strong mechanical players.

## Contents
- PRODUCT_SPEC.md: workflows, rotation policy, data model, and acceptance criteria.
- DESIGN.md: mobile screens and visual tokens.
- START_HERE.md: paste-ready coding instruction.
- data/members.json: 100 verified members with arena power, rank, level, and origin.
- data/event_draft.json: this week's two times with unknown timezone preserved and next Friday derived.
- source/: original spreadsheet, unchanged, including its separate Glory Wars tab.
- design/: selected logo and mobile concept image.

## Decisions remaining
Timezone and review of the derived Friday date block publishing the first real event. The specification labels other policy choices as proposed defaults so a prototype can proceed. Attendance source defaults to leader confirmation; there is no verified automatic Last Z integration. Do not represent suggested assignments as proof someone played.

The screenshots establish style and navigation. Their placeholder names, counts, availability, event dates, and actions do not override this specification or real data. Historical Canyon attendance is unknown at import, not inferred from GW.

## Coding tool recommendation
Try Codex for a small first milestone using this handoff and a repository. Keep progress in files and commits so another coding agent can resume. The identity of the user's “Fable 5.1” tool is unresolved, so no unsupported model or pricing comparison is made.

Official guidance checked September 9, 2026: https://learn.chatgpt.com/docs/pricing . Codex local and cloud work share an allowance, usage depends on model and task size, and smaller models can extend usage. Moving surfaces does not guarantee a fresh allowance. Check the account usage dashboard for actual remaining capacity.

## Updated scope
Canyon Clash repeats every Friday. This week's times are 18:00 and 23:00; future weeks may edit times. September 11, 2026 is the derived next Friday, pending review in the chosen timezone.

The MVP now also includes an editable alliance organization page and app-wide motion and quality of life requirements. Read ORGANIZATION.md and MOTION_AND_QOL.md. The newest available responsibilities spreadsheet is included unchanged, with its 16 tasks extracted to data/responsibilities.json. Original names remain intact pending identity mapping to the power roster. A plain TBD option is included alongside the source dropdown options, reflecting the earlier requested placeholder.

This package specifies the animations; it does not yet contain a running app or implemented animations. Existing PNG mockups predate the Organize tab and animation requirements.
