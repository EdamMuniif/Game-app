'use client';

import { useState } from 'react';
import AppShell from '../../components/AppShell';
import { useTournament } from '../../lib/tournament-context';

export default function RulesPage() {
  const { state, saveRule, deleteRule } = useTournament();
  const [editingId, setEditingId] = useState('');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');

  function submit(event) {
    event.preventDefault();
    if (!title.trim() || !text.trim()) return;
    saveRule({ title: title.trim(), text: text.trim() }, editingId);
    setEditingId(''); setTitle(''); setText('');
  }

  function edit(rule) { setEditingId(rule.id); setTitle(rule.title); setText(rule.text); }

  return (
    <AppShell pageTitle="Rules">
      <section className="page-grid rules-layout">
        <article className="panel">
          <div className="panel-head"><div><p className="eyebrow">TOURNAMENT RULES</p><h3>Rules & regulations</h3></div></div>
          <div className="rules-list">{state.rules.map((rule, index) => <div className="rule-item" key={rule.id}><div className="rule-number">{index + 1}</div><div><strong>{rule.title}</strong><p>{rule.text}</p></div><div className="table-actions"><button className="icon-btn" onClick={() => edit(rule)}>✎</button><button className="icon-btn danger" onClick={() => { if (window.confirm('Delete this rule?')) deleteRule(rule.id); }}>×</button></div></div>)}</div>
        </article>
        <article className="panel form-panel sticky-panel">
          <div className="panel-head"><div><p className="eyebrow">ADD / EDIT</p><h3>{editingId ? 'Edit rule' : 'New rule'}</h3></div></div>
          <form className="stack-form" onSubmit={submit}><label>Rule title<input required maxLength="80" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Player eligibility" /></label><label>Rule details<textarea required rows="6" maxLength="500" value={text} onChange={(event) => setText(event.target.value)} placeholder="Enter the rule details" /></label><div className="form-actions"><button className="btn btn-primary" type="submit">Save rule</button>{editingId && <button className="btn btn-ghost" type="button" onClick={() => { setEditingId(''); setTitle(''); setText(''); }}>Cancel</button>}</div></form>
        </article>
      </section>
    </AppShell>
  );
}
