// The brand guide's rules (in post-studio.html) as values the validator can
// check. If the guide changes, change these to match.

export const POST_TYPES = ['Announcement', 'AI insight', 'Stat', 'Client win', 'Hiring'];

// These types report real events at Forethrive, so they must come from an
// entry in brand/ideas.md, never from Claude's imagination.
export const REAL_EVENT_TYPES = ['Announcement', 'Client win', 'Hiring'];

export const LIMITS = {
  label: { maxChars: 28 },
  big: { maxChars: 10 },
  headline: { maxChars: 120, maxWords: 12 },
  sub: { maxChars: 180, maxWords: 25 },
  hook: { maxChars: 124 }, // "under 125 characters, because LinkedIn cuts the rest"
  bodyLines: { min: 1, max: 4 }, // caption lines 2 to 5
};

export const HASHTAGS = {
  max: 3,
  allowed: ['#AI', '#GenerativeAI', '#Automation', '#Forethrive'],
};

export const BANNED_WORDS = [
  'revolutionary',
  'revolutionise',
  'revolutionize',
  'cutting-edge',
  'cutting edge',
  'game-changing',
  'game changing',
  'game-changer',
  'game changer',
];

// The link goes in the first comment, never in the caption.
export const SITE = 'forethrive.ai';

export const STATUSES = ['draft', 'approved', 'skipped', 'posted'];
