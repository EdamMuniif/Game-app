'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '../../../components/AppShell';
import { useTournament } from '../../../lib/tournament-context';
import { sportDefaults } from '../../../lib/tournament';

const SPORTS = ['Football', 'Futsal', 'Volleyball', 'Badminton', 'Other'];
const DURATIONS = [
  ['1_day', '1-Day Cup'],
  ['2_day', '2-Day Cup'],
  ['weekly', 'Weekly Cup'],
  ['custom', 'Custom']
];

function initialForm() {
  const defaults = sportDefaults('Volleyball');
  return {
    tournamentName: '',
    sport: 'Volleyball',
    otherSportName: '',
    durationType: '1_day',
    date: '',
    endDate: '',
    startTime: '18:00',
    endTime: '23:00',
    venue: 'Thilafushi Shipyard Stadium',
    public: false,
    maxTeams: 8,
    playersPerTeam: defaults.playersPerTeam,
    maxRoster: defaults.maxRoster,
    futsalFormat: '5v5',
    badmintonEvent: 'Singles',
    format: 'knockout',
    groupCount: 2,
    advancePerGroup: 2,
    courts: 1,
    playingAreas: ['Court 1'],
    matchDurationMinutes: defaults.matchDurationMinutes,
    minimumRestMinutes: 15,
    teamNames: Array.from({ length: 8 }, (_, index) => 'Team ' + (index + 1))
  };
}

export default function NewTournamentPage() {
  const router = useRouter();
  const { createTournament, isAdmin, requestAdmin } = useTournament();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState('');

  const areaLabel = form.sport === 'Football' ? 'Field' : form.sport === 'Other' ? 'Area' : 'Court';

  const stepTitle = useMemo(() => ({
    1: 'Tournament',
    2: 'Sport setup',
    3: 'Teams / entries',
    4: 'Competition'
  })[step], [step]);

  function update(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function changeSport(sport) {
    const defaults = sportDefaults(sport, {
      futsalFormat: form.futsalFormat,
      badmintonEvent: form.badmintonEvent
    });
    setForm((current) => ({
      ...current,
      sport,
      playersPerTeam: defaults.playersPerTeam,
      maxRoster: defaults.maxRoster,
      matchDurationMinutes: defaults.matchDurationMinutes
    }));
  }

  function changeTeamCount(value) {
    const count = Math.max(2, Math.min(64, Number(value) || 2));
    setForm((current) => ({
      ...current,
      maxTeams: count,
      teamNames: Array.from({ length: count }, (_, index) => current.teamNames[index] || 'Team ' + (index + 1))
    }));
  }

  function changeCourtCount(value) {
    const count = Math.max(1, Math.min(12, Number(value) || 1));
    setForm((current) => ({
      ...current,
      courts: count,
      playingAreas: Array.from({ length: count }, (_, index) => current.playingAreas[index] || areaLabel + ' ' + (index + 1))
    }));
  }

  function next() {
    setMessage('');
    if (step === 1 && !form.tournamentName.trim()) {
      setMessage('Enter a tournament name.');
      return;
    }
    if (step === 1 && !form.date) {
      setMessage('Select a tournament start date.');
      return;
    }
    setStep((current) => Math.min(4, current + 1));
  }

  function create() {
    if (!isAdmin) {
      requestAdmin('Admin access is required to create a tournament.');
      return;
    }
    try {
      const id = createTournament({
        ...form,
        endDate: form.durationType === '1_day' ? form.date : form.endDate || form.date
      });
      if (id) router.push('/teams');
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <AppShell pageTitle="Create Tournament">
      {message && <div className="notice">{message}</div>}

      <section className="wizard-shell">
        <div className="wizard-progress">
          {[1, 2, 3, 4].map((number) => (
            <button
              type="button"
              key={number}
              className={number === step ? 'active' : number < step ? 'done' : ''}
              onClick={() => number < step && setStep(number)}
            >
              <span>{number < step ? '✓' : number}</span>
              <strong>{['Tournament', 'Sport setup', 'Teams', 'Competition'][number - 1]}</strong>
            </button>
          ))}
        </div>

        <article className="panel wizard-panel">
          <div className="panel-head">
            <div><p className="eyebrow">STEP {step} OF 4</p><h3>{stepTitle}</h3></div>
          </div>

          {step === 1 && (
            <div className="settings-form">
              <div className="form-grid">
                <label>Tournament name<input value={form.tournamentName} onChange={(event) => update('tournamentName', event.target.value)} placeholder="e.g. SRC Futsal Cup 2027" /></label>
                <label>Sport
                  <select value={form.sport} onChange={(event) => changeSport(event.target.value)}>
                    {SPORTS.map((sport) => <option key={sport}>{sport}</option>)}
                  </select>
                </label>
                {form.sport === 'Other' && <label>Sport name<input value={form.otherSportName} onChange={(event) => update('otherSportName', event.target.value)} /></label>}
                <label>Duration
                  <select value={form.durationType} onChange={(event) => update('durationType', event.target.value)}>
                    {DURATIONS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                  </select>
                </label>
                <label>Start date<input type="date" value={form.date} onChange={(event) => update('date', event.target.value)} /></label>
                {form.durationType !== '1_day' && <label>End date<input type="date" value={form.endDate} onChange={(event) => update('endDate', event.target.value)} /></label>}
                <label>Start time<input type="time" value={form.startTime} onChange={(event) => update('startTime', event.target.value)} /></label>
                <label>Daily end time<input type="time" value={form.endTime} onChange={(event) => update('endTime', event.target.value)} /></label>
                <label>Venue<input value={form.venue} onChange={(event) => update('venue', event.target.value)} /></label>
                <label className="captain-check wizard-check">
                  <input type="checkbox" checked={form.public} onChange={(event) => update('public', event.target.checked)} />
                  <span>Public tournament — visible on public pages</span>
                </label>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="settings-form">
              <div className="form-grid">
                {form.sport === 'Futsal' && (
                  <label>Futsal format
                    <select value={form.futsalFormat} onChange={(event) => {
                      const value = event.target.value;
                      const count = Number(value.split('v')[0]) || 5;
                      setForm((current) => ({ ...current, futsalFormat: value, playersPerTeam: count }));
                    }}>
                      <option>3v3</option><option>4v4</option><option>5v5</option>
                    </select>
                  </label>
                )}

                {form.sport === 'Badminton' && (
                  <label>Badminton event
                    <select value={form.badmintonEvent} onChange={(event) => {
                      const value = event.target.value;
                      const count = value === 'Singles' ? 1 : 2;
                      setForm((current) => ({ ...current, badmintonEvent: value, playersPerTeam: count, maxRoster: count }));
                    }}>
                      <option>Singles</option><option>Doubles</option><option>Mixed Doubles</option>
                    </select>
                  </label>
                )}

                <label>Players per team / entry<input type="number" min="1" max="30" value={form.playersPerTeam} onChange={(event) => update('playersPerTeam', Number(event.target.value))} /></label>
                <label>Maximum roster<input type="number" min="1" max="40" value={form.maxRoster} onChange={(event) => update('maxRoster', Number(event.target.value))} /></label>
                <label>Estimated match slot (minutes)<input type="number" min="5" max="240" value={form.matchDurationMinutes} onChange={(event) => update('matchDurationMinutes', Number(event.target.value))} /></label>
                <label>Minimum rest (minutes)<input type="number" min="0" max="240" value={form.minimumRestMinutes} onChange={(event) => update('minimumRestMinutes', Number(event.target.value))} /></label>
              </div>
              <div className="sport-setup-note">
                <strong>{form.sport}</strong>
                <span>These are starting defaults. Detailed scoring rules remain editable in Tournament Settings.</span>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="settings-form">
              <div className="form-grid compact-create-grid">
                <label>Number of teams / entries<input type="number" min="2" max="64" value={form.maxTeams} onChange={(event) => changeTeamCount(event.target.value)} /></label>
              </div>
              <div className="team-name-grid">
                {form.teamNames.map((name, index) => (
                  <label key={index}>Entry {index + 1}
                    <input
                      value={name}
                      onChange={(event) => setForm((current) => ({
                        ...current,
                        teamNames: current.teamNames.map((item, position) => position === index ? event.target.value : item)
                      }))}
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="settings-form">
              <div className="form-grid">
                <label>Competition format
                  <select value={form.format} onChange={(event) => update('format', event.target.value)}>
                    <option value="round_robin">Round Robin</option>
                    <option value="knockout">Knockout</option>
                    <option value="groups_knockout">Groups + Knockout</option>
                  </select>
                </label>
                {form.format === 'groups_knockout' && (
                  <>
                    <label>Number of groups<input type="number" min="2" max="16" value={form.groupCount} onChange={(event) => update('groupCount', Number(event.target.value))} /></label>
                    <label>Advance per group<input type="number" min="1" max="8" value={form.advancePerGroup} onChange={(event) => update('advancePerGroup', Number(event.target.value))} /></label>
                  </>
                )}
                <label>Playing areas<input type="number" min="1" max="12" value={form.courts} onChange={(event) => changeCourtCount(event.target.value)} /></label>
              </div>

              <div className="team-name-grid area-name-grid">
                {form.playingAreas.map((name, index) => (
                  <label key={index}>{areaLabel} {index + 1}
                    <input
                      value={name}
                      onChange={(event) => setForm((current) => ({
                        ...current,
                        playingAreas: current.playingAreas.map((item, position) => position === index ? event.target.value : item)
                      }))}
                    />
                  </label>
                ))}
              </div>

              <div className="creation-summary">
                <strong>{form.tournamentName}</strong>
                <span>{form.sport} • {form.maxTeams} entries • {form.format.replaceAll('_', ' ')} • {form.courts} playing area{form.courts === 1 ? '' : 's'}</span>
              </div>
            </div>
          )}

          <div className="wizard-actions">
            <button className="btn btn-ghost" type="button" disabled={step === 1} onClick={() => setStep((current) => Math.max(1, current - 1))}>Back</button>
            {step < 4
              ? <button className="btn btn-primary" type="button" onClick={next}>Continue</button>
              : <button className="btn btn-primary" type="button" onClick={create}>Create tournament</button>}
          </div>
        </article>
      </section>
    </AppShell>
  );
}
