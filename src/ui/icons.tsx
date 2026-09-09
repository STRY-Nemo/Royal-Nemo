import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
const base = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export const HomeIcon = (p: P) => (
  <svg {...base} {...p} aria-hidden="true">
    <path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
  </svg>
);
export const CanyonIcon = (p: P) => (
  <svg {...base} {...p} aria-hidden="true">
    <path d="M3 20l5-11 4 6 3-4 6 9z" />
    <path d="M14 7l1.5-3 1.5 3" />
  </svg>
);
export const OrganizeIcon = (p: P) => (
  <svg {...base} {...p} aria-hidden="true">
    <rect x="3" y="4" width="18" height="6" rx="1.5" />
    <rect x="3" y="14" width="8" height="6" rx="1.5" />
    <rect x="13" y="14" width="8" height="6" rx="1.5" />
  </svg>
);
export const MembersIcon = (p: P) => (
  <svg {...base} {...p} aria-hidden="true">
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
    <circle cx="17" cy="9" r="2.5" />
    <path d="M21.5 19a5 5 0 0 0-5-5" />
  </svg>
);
export const ChevronRight = (p: P) => (
  <svg {...base} {...p} aria-hidden="true">
    <path d="M9 6l6 6-6 6" />
  </svg>
);
export const ChevronDown = (p: P) => (
  <svg {...base} {...p} aria-hidden="true">
    <path d="M6 9l6 6 6-6" />
  </svg>
);
export const IdeaIcon = (p: P) => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
    <path d="M9 18h6" />
    <path d="M10 21h4" />
    <path d="M12 3a6 6 0 0 0-3.5 10.9c.7.6 1 1.3 1.1 2.1h4.8c.1-.8.4-1.5 1.1-2.1A6 6 0 0 0 12 3z" />
  </svg>
);

export const BackIcon = (p: P) => (
  <svg {...base} {...p} aria-hidden="true">
    <path d="M15 6l-6 6 6 6" />
  </svg>
);
export const MoreIcon = (p: P) => (
  <svg {...base} {...p} aria-hidden="true" fill="currentColor" stroke="none">
    <circle cx="5" cy="12" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="19" cy="12" r="2" />
  </svg>
);
export const SearchIcon = (p: P) => (
  <svg {...base} {...p} aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </svg>
);
export const LockIcon = (p: P) => (
  <svg {...base} {...p} aria-hidden="true">
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);
export const SwapIcon = (p: P) => (
  <svg {...base} {...p} aria-hidden="true">
    <path d="M4 7h13l-3-3" />
    <path d="M20 17H7l3 3" />
  </svg>
);
export const CalendarIcon = (p: P) => (
  <svg {...base} {...p} aria-hidden="true">
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </svg>
);
export const ClockIcon = (p: P) => (
  <svg {...base} {...p} aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);
export const StarIcon = (p: P) => (
  <svg {...base} {...p} aria-hidden="true">
    <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z" />
  </svg>
);
export const CheckIcon = (p: P) => (
  <svg {...base} {...p} aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7" />
  </svg>
);
export const CloseIcon = (p: P) => (
  <svg {...base} {...p} aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const GripIcon = (p: P) => (
  <svg {...base} {...p} aria-hidden="true" fill="currentColor" stroke="none">
    <circle cx="9" cy="6" r="1.6" />
    <circle cx="15" cy="6" r="1.6" />
    <circle cx="9" cy="12" r="1.6" />
    <circle cx="15" cy="12" r="1.6" />
    <circle cx="9" cy="18" r="1.6" />
    <circle cx="15" cy="18" r="1.6" />
  </svg>
);
export const SettingsIcon = (p: P) => (
  <svg {...base} {...p} aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
);
export const UndoIcon = (p: P) => (
  <svg {...base} {...p} aria-hidden="true">
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
  </svg>
);
export const HistoryIcon = (p: P) => (
  <svg {...base} {...p} aria-hidden="true">
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4v5h5" />
    <path d="M12 8v4l3 2" />
  </svg>
);
export const ShareIcon = (p: P) => (
  <svg {...base} {...p} aria-hidden="true">
    <path d="M12 3v12" />
    <path d="M8 7l4-4 4 4" />
    <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
  </svg>
);
