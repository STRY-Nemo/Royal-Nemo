# Editable alliance responsibilities

## Source and preservation
Use source/STRY_Leadership_Responsibilities_Updated_v2.xlsx, the newest matching file found. It contains 16 responsibilities with four ordered slots: Lead, Assigned 2, Assigned 3, Assigned 4. data/responsibilities.json faithfully preserves task titles, slot order, blank slots and names. Do not confuse these leadership tasks with Canyon team selection.

Examples: GW is Appins / Rouge / Paju / empty; SVS is Nemo / Rouge / empty / empty; Canyon is Apparition / Roso / empty / empty; Trade Hubs is Rouge / Nemo / empty / empty. Alliance Mail is Rouge / Nemo / Roso / Appins. Keep all other source rows, including unassigned ones.

Source dropdown names: Rouge, Nemo, Appins, Apparition, Roso, Mada, TBD/Rotation, TBD/Capo, Paju, Mario. Add the earlier requested plain TBD option. Empty means unassigned; TBD is a labeled placeholder. Placeholder slots do not correspond to a member ID or confer permissions.

Names such as Rouge and Queen Rouge, Nemo and Nemo Hoes, Mario and Mario AK47 are likely aliases but must not be silently merged. Use a one-time leader mapping screen with suggested matches and explicit review; allow source display labels to remain until mapped. Do not guess that Roso and RosolinoFriddi are identical. Once mapped, store stable member IDs and retain display-name aliases; power updates and renames must not detach responsibilities.

## Phone layout and editing
Organize opens a searchable vertical list of task cards. Each card shows its title, a prominent Lead chip, and three labeled additional slots. Use a 2-by-2 grid inside the expanded card, not a wide spreadsheet. Collapsed cards summarize assignments. Provide All tasks / My tasks / Unassigned filters.

Tapping any slot opens a searchable dropdown-style bottom sheet. Show current selection, leadership/source names first, and an All members option for the full 100-person roster. Include clear assignment and placeholder choices. Selecting a name saves just that slot. Prevent assigning the same real member twice within a task. A person may own several different tasks. Leaders may add/rename/reorder/archive tasks and manage names; members have read-only access to the organization page.

Also implement mobile touch drag-and-drop: long-press the visible grip on an assignment chip (about 250ms), lift the chip, glow eligible destination slots, and auto-scroll near the top/bottom viewport edge. Normal swipes away from grips still scroll. On a blank destination move the source assignment and clear the source slot. On an occupied destination show a swap preview and commit on confirmation. Dragging must preserve each slot's role: moving into Lead changes responsibility lead. A directory candidate dragged into an empty slot assigns them without removing their other responsibilities. Dropping outside a valid target cancels. Prevent invalid duplicates and preserve the original state on cancellation or save failure.

Equivalent tap flows are mandatory: Move to slot and Swap with slot, plus dropdown selection. Do not require dragging for any operation. After changes, show saved feedback and Undo. Undo issues an audited inverse change with revision validation; if another leader changed the same slots, offer reload/compare instead of overwriting. Save multi-slot swaps atomically. Keep task/slot IDs stable on reorder; don't key notes or edits by row index.

## Acceptance
- All 16 source tasks and all four slots round-trip without lost names or changed ordering.
- Dropdown editing, clearing, TBD selection and full-roster search work on a phone.
- Dragging into blank slots moves; occupied slots offer explicit swap; cancel leaves data intact.
- Duplicate members within one task are rejected; assignments across multiple tasks are allowed.
- Long-press grip does not interfere with page scrolling, and an off-screen destination can be reached by auto-scroll.
- Each drag operation has an equivalent accessible tap operation; focus returns sensibly after the sheet closes.
- Members cannot edit through API calls; conflicting leader edits are detected. Undo cannot silently overwrite another leader.
- Search, filters, expanded cards and scroll position survive returning from a detail view.
