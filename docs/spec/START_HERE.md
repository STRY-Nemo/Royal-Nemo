Build the STRY mobile-only Canyon Clash organizer from this package.

Read README.md, PRODUCT_SPEC.md and DESIGN.md first. Use the supplied celestial logo and mobile reference. The specification and actual seed data override screenshot placeholders. Also read ORGANIZATION.md and MOTION_AND_QOL.md; both are required MVP scope. Load all 100 records from data/members.json. Arena power is measured in millions. Do not use Glory Wars participation as Canyon history.

Start with milestone 1 and a runnable phone-width preview, then implement the rotation engine and its meaningful tests. Keep commits and a short progress file after each milestone so another coding agent can resume without this conversation. Do not build unrelated alliance features first.

Team 1 is 18:00 and Team 2 is 23:00 for this week's draft, 20 slots each. Canyon Clash is every Friday. Next Friday is September 11, 2026, derived from September 9. Let leaders confirm that date and set the timezone before publishing. Initial availability, assignments and Canyon attendance are empty, not fabricated.

The core objective is fair opportunities across weeks among available players. Follow the proposed deterministic rotation defaults in PRODUCT_SPEC.md, accounting for both time slots jointly. Provide leader locks with reasons for strong mechanical players. Separate selection from actual play; leader-confirmed attendance drives automatic history and future rotation. Weekly selection requires no AI API.

For a demo use clearly labeled local persistence. Before shared real use implement authenticated server persistence, role enforcement, transactional capacity/uniqueness, revision conflict checks and idempotent attendance finalization. Preserve any existing repo stack; otherwise choose a small maintained stack and explain the choice. Provide setup instructions, passing core tests and a working mobile preview. Identify the few remaining product assumptions without stopping useful prototype work.


Updated required scope: Canyon Clash repeats every Friday, plus an Organize page seeded from data/responsibilities.json. Read ORGANIZATION.md and MOTION_AND_QOL.md. Implement searchable assignment dropdowns AND optional touch drag-and-drop with tap equivalents, swaps, undo and conflict-safe saves. Include shared celestial motion and quality of life components across the entire app from milestone 1. Existing concept PNGs are visual references, not the latest navigation or data contract. Keep screenshot placeholders out of production data.
