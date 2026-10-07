'use client';

import { useEffect, useState } from 'react';
import AppShell from '../../components/AppShell';
import { useTournament } from '../../lib/tournament-context';
import { sportDefaults } from '../../lib/tournament';

function blockedToText(blocks) {
  return (Array.isArray(blocks) ? blocks : []).map((block) => [
    block.date || '',
    block.start || '',
    block.end || '',
    block.areaId || block.area || 'All',
    block.reason || ''
  ].join(',')).join('\n');
}

function parseBlocked(text) {
  if (!String(text || '').trim()) return [];
  return String(text).split('\n').map((line, index) => {
    const [date, start, end, area, ...reasonParts] = line.split(',').map((part) => part.trim());
    if (!date || !start || !end) throw new Error('Blocked period line ' + (index + 1) + ' must include date, start, and end.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) {
      throw new Error('Blocked period line ' + (index + 1) + ' has an invalid date or time.');
    }
    if (end <= start) throw new Error('Blocked period line ' + (index + 1) + ' must end after it starts.');
    return {
      date,
      start,
      end,
      areaId: !area || area.toLowerCase() === 'all' ? null : area,
      reason: reasonParts.join(', ')
    };
  });
}

export default function SettingsPage() {
  const { state, saveSettings, updateTournamentMeta, resetAll } = useTournament();
  const [form, setForm] = useState(state.settings);
  const [meta, setMeta] = useState({ status: state.status, public: state.public });
  const [areasText, setAreasText] = useState((state.settings.playingAreas || []).join('\n'));
  const [blockedText, setBlockedText] = useState(blockedToText(state.settings.blockedPeriods));
  const [message, setMessage] = useState('');

  useEffect(() => {
    setForm(state.settings);
    setMeta({ status: state.status, public: state.public });
    setAreasText((state.settings.playingAreas || []).join('\n'));
    setBlockedText(blockedToText(state.settings.blockedPeriods));
  }, [state.id, state.settings, state.status, state.public]);

  function change(event) {
    const { name, value, type } = event.target;
    setForm((current) => ({ ...current, [name]: type === 'number' ? Number(value) : value }));
  }

  function sportChange(event) {
    const sport = event.target.value;
    const defaults = sportDefaults(sport, {
      futsalFormat: form.futsalFormat,
      badmintonEvent: form.badmintonEvent
    });
    setForm((current) => ({
      ...current,
      ...defaults,
      sport,
      tournamentName: current.tournamentName,
      venue: current.venue,
      date: current.date,
      endDate: current.endDate,
      submissionDeadline: current.submissionDeadline,
      durationType: current.durationType,
      maxTeams: current.maxTeams,
      format: current.format,
      groupCount: current.groupCount,
      advancePerGroup: current.advancePerGroup,
      courts: current.courts,
      playingAreas: current.playingAreas,
      startTime: current.startTime,
      endTime: current.endTime,
      betweenMatchesMinutes: current.betweenMatchesMinutes,
      minimumRestMinutes: current.minimumRestMinutes,
      blockedPeriods: current.blockedPeriods
    }));
  }

  function submit(event) {
    event.preventDefault();
    const playingAreas = areasText.split('\n').map((value) => value.trim()).filter(Boolean);
    const blockedPeriods = parseBlocked(blockedText);
    const next = {
      ...form,
      durationType: form.durationType || '1_day',
      endDate: form.durationType === '1_day' ? form.date : form.endDate || form.date,
      playingAreas: playingAreas.length ? playingAreas : ['Court 1'],
      courts: playingAreas.length || Number(form.courts) || 1,
      blockedPeriods
    };

    const structural = (
      next.sport !== state.settings.sport ||
      next.format !== state.settings.format ||
      (
        ['groups', 'groups_knockout'].includes(next.format) &&
        Number(next.groupCount) !== Number(state.settings.groupCount)
      )
    );
    const qualificationChanged = (
      next.format === 'groups_knockout' &&
      Number(next.advancePerGroup) !== Number(state.settings.advancePerGroup)
    );

    if (Number(next.maxRoster) < Number(next.playersPerTeam)) {
      setMessage('Maximum roster cannot be smaller than players per team.');
      return;
    }

    if (structural && (state.matches.length || state.teams.some((team) => team.letter || team.drawNumber)) && !window.confirm('Sport, format, or group changes require a new official draw and fixtures. Continue?')) return;
    if (qualificationChanged && state.matches.some((match) => match.kind === 'knockout') && !window.confirm('Changing the number of qualifiers will remove the generated knockout stage. Group results will be kept. Continue?')) return;

    try {
      saveSettings(next);
      updateTournamentMeta(meta);
      setMessage('Tournament settings saved.');
    } catch (error) {
      setMessage(error.message);
    }
  }

  const groupMode = form.format === 'groups' || form.format === 'groups_knockout';
  const goalSport = form.sport === 'Football' || form.sport === 'Futsal';

  return (
    <AppShell pageTitle="Settings">
      {message && <div className="notice">{message}</div>}

      <article className="panel settings-panel">
        <div className="panel-head">
          <div><p className="eyebrow">TOURNAMENT SETTINGS</p><h3>Competition, scoring & scheduling</h3></div>
        </div>

        <form className="settings-form" onSubmit={submit}>
          <div className="form-section">
            <h4>Event</h4>
            <div className="form-grid">
              <label>Tournament name<input name="tournamentName" required value={form.tournamentName} onChange={change} /></label>
              <label>Sport
                <select name="sport" value={form.sport} onChange={sportChange}>
                  <option>Football</option><option>Futsal</option><option>Volleyball</option><option>Badminton</option><option>Other</option>
                </select>
              </label>
              {form.sport === 'Other' && <label>Sport name<input name="otherSportName" value={form.otherSportName || ''} onChange={change} /></label>}
              <label>Venue<input name="venue" value={form.venue} onChange={change} /></label>
              <label>Duration
                <select name="durationType" value={form.durationType || '1_day'} onChange={change}>
                  <option value="1_day">1-Day Cup</option><option value="2_day">2-Day Cup</option><option value="weekly">Weekly Cup</option><option value="custom">Custom</option>
                </select>
              </label>
              <label>Start date<input name="date" type="date" value={form.date} onChange={change} /></label>
              {form.durationType !== '1_day' && <label>End date<input name="endDate" type="date" value={form.endDate || ''} onChange={change} /></label>}
              <label>Submission deadline<input name="submissionDeadline" type="date" value={form.submissionDeadline || ''} onChange={change} /></label>
              <label>Status
                <select value={meta.status} onChange={(event) => setMeta((current) => ({ ...current, status: event.target.value }))}>
                  <option value="draft">Draft</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="ongoing">Ongoing</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
              <label className="captain-check">
                <input type="checkbox" checked={Boolean(meta.public)} onChange={(event) => setMeta((current) => ({ ...current, public: event.target.checked }))} />
                <span>Public tournament</span>
              </label>
            </div>
          </div>

          <div className="form-section">
            <h4>Teams & competition format</h4>
            <div className="form-grid">
              <label>Maximum teams / entries<input name="maxTeams" type="number" min="2" max="64" required value={form.maxTeams} onChange={change} /></label>
              <label>Players per team / entry<input name="playersPerTeam" type="number" min="1" max="30" value={form.playersPerTeam || 1} onChange={change} /></label>
              <label>Maximum roster<input name="maxRoster" type="number" min={Math.max(1, Number(form.playersPerTeam) || 1)} max="40" value={form.maxRoster || 12} onChange={change} /></label>
              <label>Competition format
                <select name="format" value={form.format} onChange={change}>
                  <option value="round_robin">Round Robin</option>
                  <option value="knockout">Knockout</option>
                  <option value="groups">Group stage only</option>
                  <option value="groups_knockout">Groups + knockout</option>
                </select>
              </label>
              {groupMode && <>
                <label>Number of groups<input name="groupCount" type="number" min="1" max="16" value={form.groupCount} onChange={change} /></label>
                <label>Teams advancing per group<input name="advancePerGroup" type="number" min="1" max="8" value={form.advancePerGroup} onChange={change} /></label>
              </>}
            </div>
          </div>

          <div className="form-section">
            <h4>Sport-specific scoring</h4>
            <div className="form-grid">
              {form.sport === 'Futsal' && (
                <label>Futsal format
                  <select name="futsalFormat" value={form.futsalFormat || '5v5'} onChange={change}>
                    <option>3v3</option><option>4v4</option><option>5v5</option>
                  </select>
                </label>
              )}

              {goalSport && <>
                <label>Win points<input name="winPoints" type="number" min="0" max="10" value={form.winPoints} onChange={change} /></label>
                <label>Draw points<input name="drawPoints" type="number" min="0" max="10" value={form.drawPoints} onChange={change} /></label>
                <label>Loss points<input name="lossPoints" type="number" min="0" max="10" value={form.lossPoints} onChange={change} /></label>
                <label>Knockout tie-break
                  <select name="knockoutTieBreak" value={form.knockoutTieBreak || 'penalties'} onChange={change}>
                    <option value="penalties">Penalties</option>
                    <option value="extra_time">Extra time</option>
                    <option value="direct_penalties">Direct penalties</option>
                    <option value="manual">Manual decision</option>
                  </select>
                </label>
              </>}

              {form.sport === 'Volleyball' && <>
                <label>Best of sets
                  <select name="bestOfSets" value={form.bestOfSets || 3} onChange={change}>
                    <option value={1}>1 set</option><option value={3}>Best of 3</option><option value={5}>Best of 5</option>
                  </select>
                </label>
                <label>Set target<input name="setTarget" type="number" min="1" max="50" value={form.setTarget || 25} onChange={change} /></label>
                <label>Deciding-set target<input name="decidingSetTarget" type="number" min="1" max="50" value={form.decidingSetTarget || 15} onChange={change} /></label>
                <label>Win by<input name="winBy" type="number" min="1" max="10" value={form.winBy || 2} onChange={change} /></label>
                <label>Match win points<input name="winPoints" type="number" min="0" max="10" value={form.winPoints} onChange={change} /></label>
              </>}

              {form.sport === 'Badminton' && <>
                <label>Event
                  <select name="badmintonEvent" value={form.badmintonEvent || 'Singles'} onChange={change}>
                    <option>Singles</option><option>Doubles</option><option>Mixed Doubles</option>
                  </select>
                </label>
                <label>Best of games
                  <select name="bestOfGames" value={form.bestOfGames || 3} onChange={change}>
                    <option value={1}>1 game</option><option value={3}>Best of 3</option><option value={5}>Best of 5</option>
                  </select>
                </label>
                <label>Game target<input name="gameTarget" type="number" min="1" max="50" value={form.gameTarget || 21} onChange={change} /></label>
                <label>Maximum game score<input name="maxGameScore" type="number" min="1" max="99" value={form.maxGameScore || 30} onChange={change} /></label>
                <label>Win by<input name="winBy" type="number" min="1" max="10" value={form.winBy || 2} onChange={change} /></label>
              </>}

              {form.sport === 'Other' && <>
                <label>Win points<input name="winPoints" type="number" min="0" max="10" value={form.winPoints} onChange={change} /></label>
                <label>Draw points<input name="drawPoints" type="number" min="0" max="10" value={form.drawPoints} onChange={change} /></label>
                <label>Loss points<input name="lossPoints" type="number" min="0" max="10" value={form.lossPoints} onChange={change} /></label>
              </>}
            </div>
          </div>

          <div className="form-section">
            <h4>Scheduling engine</h4>
            <div className="form-grid">
              <label>First match time<input name="startTime" type="time" value={form.startTime} onChange={change} /></label>
              <label>Daily end time<input name="endTime" type="time" value={form.endTime || '23:30'} onChange={change} /></label>
              <label>Estimated match slot (minutes)<input name="matchDurationMinutes" type="number" min="1" max="240" value={form.matchDurationMinutes || 30} onChange={change} /></label>
              <label>Internal break (minutes)<input name="breakMinutes" type="number" min="0" max="60" value={form.breakMinutes || 0} onChange={change} /></label>
              <label>Between matches (minutes)<input name="betweenMatchesMinutes" type="number" min="0" max="120" value={form.betweenMatchesMinutes || 0} onChange={change} /></label>
              <label>Minimum participant rest (minutes)<input name="minimumRestMinutes" type="number" min="0" max="240" value={form.minimumRestMinutes || 0} onChange={change} /></label>
              <label className="form-span-2">Playing areas — one per line
                <textarea rows="4" value={areasText} onChange={(event) => setAreasText(event.target.value)} placeholder={'Court 1\nCourt 2'} />
              </label>
              <label className="form-span-2">Blocked periods
                <textarea
                  rows="5"
                  value={blockedText}
                  onChange={(event) => setBlockedText(event.target.value)}
                  placeholder={'2026-10-22,19:00,19:30,All,Opening ceremony\n2026-10-22,20:00,20:30,Court 2,Maintenance'}
                />
                <small>Format: date,start,end,area or All,reason — one block per line.</small>
              </label>
            </div>
          </div>

          <div className="settings-actions">
            <button className="btn btn-primary" type="submit">Save settings</button>
            <button className="btn btn-danger" type="button" onClick={() => {
              if (window.confirm('Reset this tournament working data? Other tournaments are not affected.')) {
                resetAll();
                setMessage('Current tournament working data reset.');
              }
            }}>Reset current tournament</button>
          </div>
        </form>
      </article>
    </AppShell>
  );
}
