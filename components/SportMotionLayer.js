'use client';

const ICONS = {
  Football: '⚽',
  Futsal: '⚽',
  Volleyball: '🏐',
  Badminton: '🏸',
  Other: '●'
};

export default function SportMotionLayer({ sport = 'Other', compact = false }) {
  const normalized = ICONS[sport] ? sport : 'Other';
  return (
    <div
      className={'sport-motion sport-motion-' + normalized.toLowerCase() + (compact ? ' compact' : '')}
      aria-hidden="true"
    >
      <span className="sport-motion-object">{ICONS[normalized]}</span>
      <span className="sport-motion-object secondary">{ICONS[normalized]}</span>
    </div>
  );
}
