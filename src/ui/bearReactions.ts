/** Random reactions for a fed bear: a little animation plus a floating emoji. */
export interface BearReaction {
  /** CSS class suffix on .bear-sprite (see app.css "Bear reactions"). */
  anim: 'jump' | 'wiggle' | 'spin' | 'squish' | 'clap' | 'dance' | 'nod' | 'flip';
  /** One to three emoji that float up. */
  emojis: string[];
  /** Short speech-bubble text. */
  quip: string;
}

const REACTIONS: BearReaction[] = [
  { anim: 'jump', emojis: ['🎉'], quip: 'Yippee!' },
  { anim: 'jump', emojis: ['⭐', '⭐'], quip: 'Boing!' },
  { anim: 'wiggle', emojis: ['❤️'], quip: 'Love you!' },
  { anim: 'wiggle', emojis: ['😋'], quip: 'Yum!' },
  { anim: 'spin', emojis: ['✨', '✨', '✨'], quip: 'Wheee!' },
  { anim: 'squish', emojis: ['🍯'], quip: 'Mmm honey' },
  { anim: 'clap', emojis: ['👏', '👏'], quip: 'Bravo!' },
  { anim: 'dance', emojis: ['🎵', '🎶'], quip: 'Dance time!' },
  { anim: 'nod', emojis: ['💪'], quip: 'Stronger!' },
  { anim: 'flip', emojis: ['🤸', '🌟'], quip: 'Ta-da!' },
  { anim: 'wiggle', emojis: ['🫶', '❤️'], quip: 'Thanks, STRY!' },
  { anim: 'squish', emojis: ['😴', '💤'], quip: 'Sleepy… kidding!' },
  { anim: 'jump', emojis: ['🐝', '🍯'], quip: 'Bees!' },
  { anim: 'nod', emojis: ['🛡️'], quip: 'For STRY!' },
  { anim: 'dance', emojis: ['🔥'], quip: 'On fire!' },
  { anim: 'spin', emojis: ['🌈'], quip: 'Dizzy!' },
];

let last = -1;
/** Picks a reaction, never the same one twice in a row. */
export function pickReaction(): BearReaction {
  let i = Math.floor(Math.random() * REACTIONS.length);
  if (i === last) i = (i + 1) % REACTIONS.length;
  last = i;
  return REACTIONS[i];
}

export const REACTION_MS = 750;
