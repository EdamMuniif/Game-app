'use client';

import AppShell from '../../components/AppShell';
import { useTournament } from '../../lib/tournament-context';
import { resolvedTeams } from '../../lib/tournament';

export default function BracketPage() {
  const { state } = useTournament();
  const knockoutMatches = state.matches.filter((match) => match.kind === 'knockout');
  const teamMap = Object.fromEntries(state.teams.map((team) => [team.id, team]));
  const rounds = [...new Set(knockoutMatches.map((match) => match.round))];

  function teamName(id) {
    return teamMap[id]?.name || 'TBD';
  }

  return (
    <AppShell pageTitle="Bracket">
      <section className="panel bracket-toolbar">
        <div>
          <p className="eyebrow">KNOCKOUT BRACKET</p>
          <h3>Competition pathway</h3>
          <p className="muted">Winners automatically appear in the next round after their result is marked Final.</p>
        </div>
        <span className="chip">{knockoutMatches.length} knockout match{knockoutMatches.length === 1 ? '' : 'es'}</span>
      </section>

      {!knockoutMatches.length ? (
        <section className="panel empty-state"><span>◫</span><strong>No knockout bracket yet</strong><p>Generate knockout fixtures from the Draw or complete the group stage first.</p></section>
      ) : (
        <section className="bracket-scroll" aria-label="Knockout tournament bracket">
          <div className="bracket-board">
            {rounds.map((round) => {
              const roundMatches = knockoutMatches.filter((match) => match.round === round);
              return (
                <div className="bracket-round" key={round}>
                  <div className="bracket-round-head"><strong>{round}</strong><span>{roundMatches.length}</span></div>
                  <div className="bracket-round-matches">
                    {roundMatches.map((match) => {
                      const [aId, bId] = resolvedTeams(match, state.matches);
                      const aWinner = match.winnerId && match.winnerId === aId;
                      const bWinner = match.winnerId && match.winnerId === bId;
                      return (
                        <article className="bracket-match" key={match.id}>
                          <div className="bracket-match-label"><span>Match {match.matchNo}</span><small>{match.time || 'TBD'} • {match.court || 'Court TBD'}</small></div>
                          <div className={aWinner ? 'bracket-team winner' : 'bracket-team'}>
                            <span>{teamName(aId)}</span><strong>{match.scoreA ?? '—'}</strong>
                          </div>
                          <div className={bWinner ? 'bracket-team winner' : 'bracket-team'}>
                            <span>{teamName(bId)}</span><strong>{match.scoreB ?? '—'}</strong>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </AppShell>
  );
}
