'use client';

import { useState } from 'react';
import { useTournament } from '../lib/tournament-context';

export default function TournamentAssistant() {
  const { isAdmin, state, askAssistant } = useTournament();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);

  if (!isAdmin) return null;

  async function submit(event) {
    event.preventDefault();
    const text = question.trim();
    if (!text || busy) return;

    setMessages((current) => [...current, { role: 'user', text }]);
    setQuestion('');
    setBusy(true);

    try {
      const answer = await askAssistant(text);
      setMessages((current) => [...current, { role: 'assistant', text: answer }]);
    } catch (error) {
      setMessages((current) => [...current, {
        role: 'assistant',
        text: error.message || 'Unable to use the tournament assistant.'
      }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={'tournament-assistant ' + (open ? 'open' : '')}>
      {open && (
        <section className="assistant-panel" aria-label="AI tournament assistant">
          <div className="assistant-head">
            <div>
              <span>AI ASSISTANT</span>
              <strong>{state.settings.tournamentName}</strong>
            </div>
            <button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label="Close AI assistant">×</button>
          </div>

          <div className="assistant-messages" aria-live="polite">
            {!messages.length && (
              <div className="assistant-empty">
                Ask about teams, rosters, fixtures, results, standings, or the next match.
              </div>
            )}
            {messages.map((message, index) => (
              <div className={'assistant-message ' + message.role} key={index}>
                {message.text}
              </div>
            ))}
            {busy && <div className="assistant-message assistant">Thinking…</div>}
          </div>

          <form className="assistant-form" onSubmit={submit}>
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              maxLength="1500"
              placeholder="Ask about this tournament…"
              aria-label="Question for AI tournament assistant"
            />
            <button className="btn btn-primary" type="submit" disabled={busy || !question.trim()}>
              Ask
            </button>
          </form>
          <small className="assistant-note">Read-only assistant. It cannot change tournament records.</small>
        </section>
      )}

      <button
        type="button"
        className="assistant-fab"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label={open ? 'Close AI assistant' : 'Open AI assistant'}
      >
        AI
      </button>
    </div>
  );
}
