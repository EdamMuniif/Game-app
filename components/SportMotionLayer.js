'use client';

import BadmintonShuttle from './BadmintonShuttle';

const ICONS = {
  Football: '⚽',
  Futsal: '⚽',
  Volleyball: '🏐',
  Other: '●'
};

export default function SportMotionLayer({ sport = 'Other', compact = false }) {
  const normalized = ['Football', 'Futsal', 'Volleyball', 'Badminton'].includes(sport) ? sport : 'Other';

  return (
    <div
      className={'sport-motion sport-motion-' + normalized.toLowerCase() + (compact ? ' compact' : '')}
      aria-hidden="true"
    >
      {normalized === 'Badminton' ? (
        <>
          <span className="sport-motion-shuttle">
            <BadmintonShuttle />
          </span>
          <span className="sport-motion-shuttle secondary">
            <BadmintonShuttle />
          </span>
        </>
      ) : (
        <>
          <span className="sport-motion-object">{ICONS[normalized]}</span>
          <span className="sport-motion-object secondary">{ICONS[normalized]}</span>
        </>
      )}
    </div>
  );
}
