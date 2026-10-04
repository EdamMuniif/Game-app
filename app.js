(() => {
  'use strict';

  const STORAGE_KEY = 'spikeCup26TournamentManagerV1';
  const defaultRules = [
    { id: crypto.randomUUID(), title: 'Team roster', text: 'Each team may register up to 12 players. Jersey numbers must be unique within the team.' },
    { id: crypto.randomUUID(), title: 'Player eligibility', text: 'Only players included in the submitted team list are eligible to participate unless the organizers approve a replacement.' },
    { id: crypto.randomUUID(), title: 'Match reporting', text: 'Teams must report before the scheduled match time. Late arrival may be handled by the organizing committee.' },
    { id: crypto.randomUUID(), title: 'Match result', text: 'The official result is the set score recorded and confirmed by the match officials or tournament organizer.' },
    { id: crypto.randomUUID(), title: 'Conduct', text: 'Players and team officials must follow sportsmanship, safety instructions, and venue requirements throughout the tournament.' }
  ];

  const defaultState = {
    settings: {
      tournamentName: 'SPIKE CUP 26',
      sport: 'Volleyball',
      venue: 'Thilafushi Shipyard Stadium',
      date: '2026-10-22',
      submissionDeadline: '2026-10-18',
      maxTeams: 8,
      format: 'knockout',
      groupCount: 2,
      advancePerGroup: 2,
      bestOfSets: 3,
      winPoints: 3,
      courts: 1,
      startTime: '18:00'
    },
    teams: [],
    matches: [],
    rules: defaultRules,
    activity: [{ id: crypto.randomUUID(), text: 'Tournament workspace created', at: new Date().toISOString() }],
    drawLocked: false,
    knockoutGeneratedFromGroups: false
  };

  let state = loadState();
  let currentPage = 'home';

  const $ = (id) => document.getElementById(id);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  function deepClone(obj){ return JSON.parse(JSON.stringify(obj)); }
  function loadState(){
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return deepClone(defaultState);
      const parsed = JSON.parse(raw);
      return {
        ...deepClone(defaultState),
        ...parsed,
        settings: { ...deepClone(defaultState.settings), ...(parsed.settings || {}) },
        teams: Array.isArray(parsed.teams) ? parsed.teams : [],
        matches: Array.isArray(parsed.matches) ? parsed.matches : [],
        rules: Array.isArray(parsed.rules) ? parsed.rules : deepClone(defaultRules),
        activity: Array.isArray(parsed.activity) ? parsed.activity : []
      };
    } catch {
      return deepClone(defaultState);
    }
  }
  function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); renderAll(); }
  function addActivity(text){ state.activity.unshift({ id: crypto.randomUUID(), text, at: new Date().toISOString() }); state.activity = state.activity.slice(0, 10); }
  function toast(message){ const el = $('toast'); el.textContent = message; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2200); }
  function escapeHtml(str=''){ return String(str).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c])); }
  function formatDate(dateStr){ if (!dateStr) return 'Not set'; const d = new Date(dateStr + 'T00:00:00'); return new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric'}).format(d); }
  function formatDateTime(iso){ const d = new Date(iso); return new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(d); }
  function formatName(format){ return ({knockout:'Knockout',groups:'Group Stage',groups_knockout:'Groups + Knockout'})[format] || format; }
  function excelLetter(index){ let n = index + 1, s = ''; while(n){ n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n/26); } return s; }
  function teamById(id){ return state.teams.find(t => t.id === id) || null; }
  function drawnTeams(){ return state.teams.filter(t => t.letter).sort((a,b) => a.drawIndex - b.drawIndex); }
  function nextPowerOfTwo(n){ let p=1; while(p<n) p*=2; return p; }
  function groupName(index){ return `Group ${excelLetter(index)}`; }

  function setPage(page){
    currentPage = page;
    $$('.page').forEach(p => p.classList.toggle('active', p.dataset.page === page));
    $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.pageTarget === page));
    const titles = {home:'Dashboard',teams:'Teams',draw:'Team Draw',matches:'Matches',rules:'Rules',settings:'Settings'};
    $('pageTitle').textContent = titles[page] || 'Tournament';
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function renderAll(){
    renderHome(); renderTeams(); renderDraw(); renderMatches(); renderRules(); renderSettings();
    $('brandTournamentName').textContent = state.settings.tournamentName;
  }

  function renderHome(){
    const s = state.settings, count = state.teams.length, pct = Math.min(100, Math.round(count / Math.max(1,s.maxTeams) * 100));
    $('heroTournamentName').textContent = s.tournamentName;
    $('heroMeta').textContent = `${s.venue || 'Venue not set'} • ${formatDate(s.date)}`;
    $('statTeams').textContent = `${count} / ${s.maxTeams}`;
    $('statTeamsHint').textContent = `${Math.max(0,s.maxTeams-count)} places remaining`;
    $('statFormat').textContent = formatName(s.format);
    $('statFormatHint').textContent = s.format === 'knockout' ? 'Single elimination' : s.format === 'groups' ? `${s.groupCount} groups` : `${s.groupCount} groups then knockout`;
    const drawDone = state.teams.length > 0 && state.teams.every(t => t.letter);
    $('statDraw').textContent = drawDone ? 'Complete' : 'Pending';
    $('statDrawHint').textContent = drawDone ? 'All teams have draw letters' : 'Draw letters not assigned';
    $('statMatches').textContent = state.matches.length;
    $('statMatchesHint').textContent = state.matches.length ? `${state.matches.filter(m=>m.status==='final').length} completed` : 'No fixtures generated';
    $('progressLabel').textContent = `${count} of ${s.maxTeams} teams submitted`;
    $('progressPercent').textContent = `${pct}%`; $('progressFill').style.width = `${pct}%`;
    $('deadlineText').textContent = formatDate(s.submissionDeadline);
    $('detailVenue').textContent = s.venue || 'Not set'; $('detailDate').textContent = formatDate(s.date);
    $('detailFormat').textContent = formatName(s.format); $('detailSets').textContent = s.bestOfSets === 1 ? 'Single set' : `Best of ${s.bestOfSets} sets`;
    const steps = [
      {done: count > 0, title:'Register teams', text:`${count} team${count===1?'':'s'} submitted`},
      {done: count > 0 && state.teams.every(t=>t.letter), title:'Complete team draw', text:'Assign a random letter to each team'},
      {done: state.matches.length > 0, title:'Generate fixtures', text:'Build the tournament match table'},
      {done: state.matches.some(m=>m.status==='final'), title:'Record results', text:'Update scores and match status'}
    ];
    $('workflowList').innerHTML = steps.map((x,i)=>`<li class="${x.done?'done':''}"><div class="step-icon">${x.done?'✓':i+1}</div><div><strong>${x.title}</strong><span>${x.text}</span></div></li>`).join('');
    $('activityList').innerHTML = state.activity.length ? state.activity.slice(0,5).map(a=>`<div class="activity-item"><strong>${escapeHtml(a.text)}</strong><span>${formatDateTime(a.at)}</span></div>`).join('') : '<div class="empty-state"><strong>No activity yet</strong></div>';
  }

  function renderTeams(){
    const count = state.teams.length;
    $('teamsCountLabel').textContent = count; $('teamCapacityChip').textContent = `${count} / ${state.settings.maxTeams}`;
    const body = $('teamsTableBody');
    body.innerHTML = state.teams.map((t,i)=>`<tr><td>${i+1}</td><td><strong>${escapeHtml(t.name)}</strong></td><td>${escapeHtml(t.department||'—')}</td><td>${escapeHtml(t.captain||'—')}</td><td>${t.letter?`<span class="chip">${t.letter}</span>`:'—'}</td><td>${escapeHtml(t.group||'—')}</td><td><div class="table-actions"><button class="icon-btn" data-edit-team="${t.id}" title="Edit">✎</button><button class="icon-btn danger" data-delete-team="${t.id}" title="Delete">×</button></div></td></tr>`).join('');
    $('teamsEmpty').classList.toggle('hidden', count>0); $('teamSubmitBtn').disabled = count >= state.settings.maxTeams && !$('teamId').value;
  }

  function renderDraw(){
    const teams = drawnTeams(); const drawDone = state.teams.length>0 && teams.length===state.teams.length;
    $('drawStatusChip').textContent = drawDone ? 'Complete' : 'Pending';
    $('drawGrid').innerHTML = teams.map(t=>`<div class="draw-card"><span class="group-tag">${escapeHtml(t.group||'Draw')}</span><div class="letter">${t.letter}</div><strong>${escapeHtml(t.name)}</strong><small>${escapeHtml(t.department||'')}</small></div>`).join('');
    $('drawEmpty').classList.toggle('hidden', teams.length>0);
    $('drawSummary').innerHTML = `<div class="summary-card"><span>Registered teams</span><strong>${state.teams.length}</strong></div><div class="summary-card"><span>Format</span><strong>${formatName(state.settings.format)}</strong></div><div class="summary-card"><span>Draw status</span><strong>${drawDone?'Complete':'Pending'}</strong></div>`;
    $('generateFixturesBtn').disabled = !drawDone;
    renderStructurePreview(drawDone);
  }

  function assignGroups(){
    const s = state.settings; const list = drawnTeams();
    if (!['groups','groups_knockout'].includes(s.format)) { state.teams.forEach(t=>t.group=null); return; }
    const groups = Math.max(1, Math.min(s.groupCount, list.length || 1));
    list.forEach((t,i)=>{ t.group = groupName(i % groups); });
  }

  function renderStructurePreview(drawDone){
    const container = $('structurePreview'); const s = state.settings;
    if (!drawDone){ container.innerHTML = '<div class="empty-state"><strong>Complete the draw to preview the structure.</strong></div>'; return; }
    if (s.format === 'knockout'){
      $('structurePreviewTitle').textContent = 'Knockout pairing preview';
      const list = drawnTeams();
      let html='<div class="pairings">';
      for(let i=0;i<list.length;i+=2){ html += `<div class="pairing"><span>${list[i]?`${list[i].letter} — ${escapeHtml(list[i].name)}`:'BYE'}</span><span>VS</span><span>${list[i+1]?`${list[i+1].letter} — ${escapeHtml(list[i+1].name)}`:'BYE'}</span></div>`; }
      container.innerHTML = html + '</div>';
    } else {
      $('structurePreviewTitle').textContent = 'Group allocation preview';
      assignGroups();
      const groups = groupTeams();
      container.innerHTML = `<div class="structure-groups">${Object.entries(groups).map(([g,teams])=>`<div class="group-box"><h4>${g}</h4><ul>${teams.map(t=>`<li>${t.letter} — ${escapeHtml(t.name)}</li>`).join('')}</ul></div>`).join('')}</div>`;
    }
  }

  function groupTeams(){
    const out = {};
    drawnTeams().forEach(t=>{ if(t.group){ (out[t.group] ||= []).push(t); } });
    return out;
  }

  function runDraw(){
    if (!state.teams.length) return toast('Add teams before running the draw.');
    const shuffled = [...state.teams].sort(()=>Math.random()-.5);
    shuffled.forEach((t,i)=>{ t.letter = excelLetter(i); t.drawIndex = i; t.group = null; });
    assignGroups(); state.matches = []; state.knockoutGeneratedFromGroups = false; state.drawLocked = true;
    addActivity(`Team draw completed for ${state.teams.length} teams`); saveState(); toast('Team draw completed.');
  }
  function resetDraw(){
    if (!state.teams.some(t=>t.letter)) return;
    if (!confirm('Reset all draw letters and clear generated fixtures?')) return;
    state.teams.forEach(t=>{t.letter=null;t.drawIndex=null;t.group=null;}); state.matches=[]; state.knockoutGeneratedFromGroups=false; state.drawLocked=false;
    addActivity('Team draw reset'); saveState(); toast('Draw reset.');
  }

  function generateFixtures(){
    if (!state.teams.length || !state.teams.every(t=>t.letter)) return toast('Complete the team draw first.');
    state.matches = [];
    if (state.settings.format === 'knockout') generateKnockout(drawnTeams(), 'Knockout');
    else generateGroupStage();
    state.knockoutGeneratedFromGroups = false;
    addActivity(`Fixtures generated: ${state.matches.length} matches`); saveState(); setPage('matches'); toast('Fixtures generated.');
  }

  function generateGroupStage(){
    assignGroups();
    const groups = groupTeams(); let matchNo=1;
    Object.entries(groups).forEach(([group,teams])=>{
      for(let i=0;i<teams.length;i++) for(let j=i+1;j<teams.length;j++){
        state.matches.push({id:crypto.randomUUID(),kind:'group',stage:group,round:group,matchNo:matchNo++,teamAId:teams[i].id,teamBId:teams[j].id,scoreA:null,scoreB:null,status:'scheduled',date:'',time:'',court:''});
      }
    });
  }

  function generateKnockout(participants, stageLabel='Knockout'){
    const ids = participants.map(t=>typeof t==='string'?t:t.id); const size = nextPowerOfTwo(Math.max(2,ids.length));
    const slots = [...ids]; while(slots.length<size) slots.push(null);
    const rounds = Math.log2(size); const roundMatches=[]; let matchNo = state.matches.length + 1;
    for(let r=0;r<rounds;r++){
      const count = size / Math.pow(2,r+1); const idsForRound=[];
      for(let i=0;i<count;i++){
        const id = crypto.randomUUID(); idsForRound.push(id);
        let sourceA=null, sourceB=null;
        if(r===0){ sourceA = slots[i*2] ? {type:'team',id:slots[i*2]} : null; sourceB = slots[i*2+1] ? {type:'team',id:slots[i*2+1]} : null; }
        else { sourceA={type:'winner',matchId:roundMatches[r-1][i*2]}; sourceB={type:'winner',matchId:roundMatches[r-1][i*2+1]}; }
        const roundName = count===1 ? 'Final' : count===2 ? 'Semi-final' : count===4 ? 'Quarter-final' : `Round ${r+1}`;
        state.matches.push({id,kind:'knockout',stage:stageLabel,round:roundName,matchNo:matchNo++,sourceA,sourceB,scoreA:null,scoreB:null,status:'scheduled',winnerId:null,date:'',time:'',court:''});
      }
      roundMatches.push(idsForRound);
    }
    recomputeKnockout();
  }

  function sourceTeamId(source){
    if(!source) return null;
    if(source.type==='team') return source.id;
    if(source.type==='winner') return state.matches.find(m=>m.id===source.matchId)?.winnerId || null;
    return null;
  }
  function resolvedTeams(match){
    if(match.kind==='group') return [match.teamAId,match.teamBId];
    return [sourceTeamId(match.sourceA),sourceTeamId(match.sourceB)];
  }
  function recomputeKnockout(){
    let changed=true, safety=0;
    while(changed && safety++<10){
      changed=false;
      state.matches.filter(m=>m.kind==='knockout').forEach(m=>{
        const [a,b]=resolvedTeams(m); let winner=m.winnerId;
        if(a && !b) winner=a;
        else if(!a && b) winner=b;
        else if(a && b && m.status==='final' && Number.isFinite(Number(m.scoreA)) && Number.isFinite(Number(m.scoreB)) && Number(m.scoreA)!==Number(m.scoreB)) winner=Number(m.scoreA)>Number(m.scoreB)?a:b;
        else if(!(a&&b&&m.status==='final')) winner=null;
        if(winner!==m.winnerId){m.winnerId=winner;changed=true;}
      });
    }
  }

  function groupStandings(group){
    const teams = state.teams.filter(t=>t.group===group); const table = {};
    teams.forEach(t=>table[t.id]={team:t,p:0,w:0,l:0,sf:0,sa:0,sd:0,pts:0});
    state.matches.filter(m=>m.kind==='group'&&m.stage===group&&m.status==='final').forEach(m=>{
      const a=table[m.teamAId],b=table[m.teamBId]; if(!a||!b) return;
      const sa=Number(m.scoreA), sb=Number(m.scoreB); if(!Number.isFinite(sa)||!Number.isFinite(sb)||sa===sb) return;
      a.p++;b.p++;a.sf+=sa;a.sa+=sb;b.sf+=sb;b.sa+=sa;
      if(sa>sb){a.w++;b.l++;a.pts+=state.settings.winPoints;} else {b.w++;a.l++;b.pts+=state.settings.winPoints;}
    });
    Object.values(table).forEach(x=>x.sd=x.sf-x.sa);
    return Object.values(table).sort((a,b)=>b.pts-a.pts||b.sd-a.sd||b.sf-a.sf||a.team.drawIndex-b.team.drawIndex);
  }

  function allGroupMatchesFinal(){ const g=state.matches.filter(m=>m.kind==='group'); return g.length>0 && g.every(m=>m.status==='final'); }
  function generateKnockoutFromGroups(){
    if(state.settings.format!=='groups_knockout') return;
    if(!allGroupMatchesFinal()) return toast('Complete all group matches first.');
    state.matches = state.matches.filter(m=>m.kind==='group');
    const qualifiers=[]; Object.keys(groupTeams()).sort().forEach(g=>qualifiers.push(...groupStandings(g).slice(0,state.settings.advancePerGroup).map(x=>x.team)));
    if(qualifiers.length<2) return toast('Not enough qualifying teams.');
    generateKnockout(qualifiers,'Knockout Stage'); state.knockoutGeneratedFromGroups=true;
    addActivity(`Knockout stage generated with ${qualifiers.length} qualifiers`); saveState(); toast('Knockout stage generated.');
  }

  function renderMatches(){
    recomputeKnockout();
    $('matchesEmpty').classList.toggle('hidden', state.matches.length>0);
    $('matchesContainer').innerHTML = '';
    $('matchesSubtitle').textContent = state.matches.length ? `${state.matches.length} fixtures • ${state.matches.filter(m=>m.status==='final').length} completed` : 'Generate fixtures after completing the draw.';
    renderStandings();
    const showAdvance = state.settings.format==='groups_knockout' && state.matches.some(m=>m.kind==='group') && !state.matches.some(m=>m.kind==='knockout');
    $('generateKnockoutFromGroupsBtn').classList.toggle('hidden', !showAdvance);
    $('generateKnockoutFromGroupsBtn').disabled = !allGroupMatchesFinal();
    if(!state.matches.length) return;
    const grouped={};
    state.matches.forEach(m=>{ const key = m.kind==='group'?m.stage:`${m.stage} — ${m.round}`; (grouped[key] ||= []).push(m); });
    $('matchesContainer').innerHTML = Object.entries(grouped).map(([stage,matches])=>`<div class="stage-block"><div class="stage-header"><h3>${escapeHtml(stage)}</h3><span class="chip">${matches.length} match${matches.length===1?'':'es'}</span></div>${matches.map(matchHtml).join('')}</div>`).join('');
  }

  function matchHtml(m){
    const [aId,bId]=resolvedTeams(m), a=teamById(aId), b=teamById(bId); const aName=a?.name||'TBD', bName=b?.name||'TBD';
    const score = m.scoreA==null||m.scoreB==null ? '—' : `${m.scoreA} : ${m.scoreB}`;
    const disabled = !(aId&&bId);
    return `<div class="match-card"><div class="match-no">Match ${m.matchNo}</div><div class="team-slot ${a?'':'tbd'}">${escapeHtml(aName)}</div><div class="score-badge">${score}</div><div class="team-slot ${b?'':'tbd'}">${escapeHtml(bName)}</div><div><span class="match-status status-${m.status}">${m.status}</span></div><div><button class="btn btn-ghost" data-score-match="${m.id}" ${disabled?'disabled':''}>Score</button></div></div>`;
  }

  function renderStandings(){
    const section=$('standingsSection');
    if(!state.matches.some(m=>m.kind==='group')){section.innerHTML='';return;}
    const groups=Object.keys(groupTeams()).sort();
    section.innerHTML = `<div class="standings-wrap"><div class="panel-head"><div><p class="eyebrow">GROUP STANDINGS</p><h3>Live table</h3></div></div><div class="standings-grid">${groups.map(g=>{const rows=groupStandings(g);return `<div class="standings-card"><h4>${g}</h4><table><thead><tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>L</th><th>SD</th><th>Pts</th></tr></thead><tbody>${rows.map((r,i)=>`<tr class="${i<state.settings.advancePerGroup&&state.settings.format==='groups_knockout'?'qualifier':''}"><td>${i+1}</td><td>${escapeHtml(r.team.name)}</td><td>${r.p}</td><td>${r.w}</td><td>${r.l}</td><td>${r.sd}</td><td><strong>${r.pts}</strong></td></tr>`).join('')}</tbody></table></div>`}).join('')}</div></div>`;
  }

  function renderRules(){
    $('rulesList').innerHTML = state.rules.map((r,i)=>`<div class="rule-item"><div class="rule-number">${i+1}</div><div><strong>${escapeHtml(r.title)}</strong><p>${escapeHtml(r.text)}</p></div><div class="table-actions"><button class="icon-btn" data-edit-rule="${r.id}">✎</button><button class="icon-btn danger" data-delete-rule="${r.id}">×</button></div></div>`).join('');
  }

  function renderSettings(){
    const s=state.settings;
    $('settingName').value=s.tournamentName; $('settingSport').value=s.sport; $('settingVenue').value=s.venue; $('settingDate').value=s.date; $('settingDeadline').value=s.submissionDeadline;
    $('settingMaxTeams').value=s.maxTeams; $('settingFormat').value=s.format; $('settingGroupCount').value=s.groupCount; $('settingAdvance').value=s.advancePerGroup;
    $('settingBestOf').value=s.bestOfSets; $('settingWinPoints').value=s.winPoints; $('settingCourts').value=s.courts; $('settingStartTime').value=s.startTime;
    toggleGroupSettings();
  }
  function toggleGroupSettings(){ const show=['groups','groups_knockout'].includes($('settingFormat').value); $$('.group-setting').forEach(x=>x.classList.toggle('hidden',!show)); }

  function openScoreModal(matchId){
    const m=state.matches.find(x=>x.id===matchId); if(!m) return; const [aId,bId]=resolvedTeams(m); if(!aId||!bId) return toast('Both teams must be known first.');
    $('scoreMatchId').value=m.id; $('scoreTeamAName').textContent=teamById(aId)?.name||'Team A'; $('scoreTeamBName').textContent=teamById(bId)?.name||'Team B';
    $('scoreA').value=m.scoreA??0; $('scoreB').value=m.scoreB??0; $('scoreStatus').value=m.status; $('scoreModalBackdrop').classList.remove('hidden');
  }
  function closeScoreModal(){ $('scoreModalBackdrop').classList.add('hidden'); }

  document.addEventListener('click', (e)=>{
    const target=e.target.closest('[data-page-target]'); if(target){ setPage(target.dataset.pageTarget); return; }
    const editTeam=e.target.closest('[data-edit-team]'); if(editTeam){ const t=teamById(editTeam.dataset.editTeam); if(!t) return; $('teamId').value=t.id;$('teamName').value=t.name;$('teamDepartment').value=t.department||'';$('teamCaptain').value=t.captain||'';$('teamManager').value=t.manager||'';$('teamContact').value=t.contact||'';$('teamFormTitle').textContent='Edit team';$('teamSubmitBtn').textContent='Save changes';$('cancelEditTeam').classList.remove('hidden'); return; }
    const delTeam=e.target.closest('[data-delete-team]'); if(delTeam){ const t=teamById(delTeam.dataset.deleteTeam); if(!t) return; if(!confirm(`Delete ${t.name}? This will clear the draw and fixtures.`)) return; state.teams=state.teams.filter(x=>x.id!==t.id); state.teams.forEach(x=>{x.letter=null;x.drawIndex=null;x.group=null;}); state.matches=[]; state.knockoutGeneratedFromGroups=false; addActivity(`Team deleted: ${t.name}`); saveState(); toast('Team deleted.'); return; }
    const score=e.target.closest('[data-score-match]'); if(score){ openScoreModal(score.dataset.scoreMatch); return; }
    const editRule=e.target.closest('[data-edit-rule]'); if(editRule){ const r=state.rules.find(x=>x.id===editRule.dataset.editRule); if(!r)return; $('ruleId').value=r.id;$('ruleTitle').value=r.title;$('ruleText').value=r.text;$('ruleFormTitle').textContent='Edit rule';$('cancelRuleEdit').classList.remove('hidden'); return; }
    const delRule=e.target.closest('[data-delete-rule]'); if(delRule){ if(!confirm('Delete this rule?')) return; state.rules=state.rules.filter(x=>x.id!==delRule.dataset.deleteRule); saveState(); toast('Rule deleted.'); }
  });

  $('teamForm').addEventListener('submit',(e)=>{
    e.preventDefault(); const id=$('teamId').value; const name=$('teamName').value.trim(); if(!name) return;
    if(!id && state.teams.length>=state.settings.maxTeams) return toast('Maximum team limit reached.');
    const data={name,department:$('teamDepartment').value.trim(),captain:$('teamCaptain').value.trim(),manager:$('teamManager').value.trim(),contact:$('teamContact').value.trim()};
    if(id){ const t=teamById(id); Object.assign(t,data); addActivity(`Team updated: ${name}`); }
    else{ state.teams.push({id:crypto.randomUUID(),...data,letter:null,drawIndex:null,group:null}); addActivity(`Team registered: ${name}`); }
    $('teamForm').reset(); $('teamId').value=''; $('teamFormTitle').textContent='Add team'; $('teamSubmitBtn').textContent='Add team'; $('cancelEditTeam').classList.add('hidden');
    if(state.teams.some(t=>t.letter)){ state.teams.forEach(t=>{t.letter=null;t.drawIndex=null;t.group=null;}); state.matches=[]; state.knockoutGeneratedFromGroups=false; addActivity('Draw cleared because the team list changed'); }
    saveState(); toast(id?'Team updated.':'Team added.');
  });
  $('cancelEditTeam').addEventListener('click',()=>{$('teamForm').reset();$('teamId').value='';$('teamFormTitle').textContent='Add team';$('teamSubmitBtn').textContent='Add team';$('cancelEditTeam').classList.add('hidden');renderTeams();});
  $('runDrawBtn').addEventListener('click',()=>{ if(state.teams.some(t=>t.letter) && !confirm('Run a new draw? Existing fixtures will be cleared.')) return; runDraw(); });
  $('resetDrawBtn').addEventListener('click',resetDraw); $('generateFixturesBtn').addEventListener('click',generateFixtures);
  $('clearMatchesBtn').addEventListener('click',()=>{if(!state.matches.length)return;if(!confirm('Clear all fixtures and results?'))return;state.matches=[];state.knockoutGeneratedFromGroups=false;addActivity('Fixtures cleared');saveState();toast('Fixtures cleared.');});
  $('generateKnockoutFromGroupsBtn').addEventListener('click',generateKnockoutFromGroups);
  $('closeScoreModal').addEventListener('click',closeScoreModal); $('cancelScoreModal').addEventListener('click',closeScoreModal); $('scoreModalBackdrop').addEventListener('click',e=>{if(e.target===e.currentTarget)closeScoreModal();});
  $('scoreForm').addEventListener('submit',(e)=>{
    e.preventDefault(); const m=state.matches.find(x=>x.id===$('scoreMatchId').value); if(!m)return; const a=Number($('scoreA').value),b=Number($('scoreB').value),status=$('scoreStatus').value;
    if(status==='final'&&a===b) return toast('A final match cannot end in a tie.');
    m.scoreA=a;m.scoreB=b;m.status=status;recomputeKnockout();addActivity(`Result updated for Match ${m.matchNo}: ${a}-${b}`);saveState();closeScoreModal();toast('Result saved.');
  });

  $('ruleForm').addEventListener('submit',(e)=>{e.preventDefault();const id=$('ruleId').value;const title=$('ruleTitle').value.trim(),text=$('ruleText').value.trim();if(!title||!text)return;if(id){const r=state.rules.find(x=>x.id===id);Object.assign(r,{title,text});}else state.rules.push({id:crypto.randomUUID(),title,text});$('ruleForm').reset();$('ruleId').value='';$('ruleFormTitle').textContent='New rule';$('cancelRuleEdit').classList.add('hidden');saveState();toast('Rule saved.');});
  $('cancelRuleEdit').addEventListener('click',()=>{$('ruleForm').reset();$('ruleId').value='';$('ruleFormTitle').textContent='New rule';$('cancelRuleEdit').classList.add('hidden');});
  $('addRuleBtn').addEventListener('click',()=>{$('ruleForm').reset();$('ruleId').value='';$('ruleFormTitle').textContent='New rule';$('ruleTitle').focus();});

  $('settingFormat').addEventListener('change',toggleGroupSettings);
  $('settingsForm').addEventListener('submit',(e)=>{
    e.preventDefault();
    const next={tournamentName:$('settingName').value.trim()||'Tournament',sport:$('settingSport').value,venue:$('settingVenue').value.trim(),date:$('settingDate').value,submissionDeadline:$('settingDeadline').value,maxTeams:Number($('settingMaxTeams').value),format:$('settingFormat').value,groupCount:Number($('settingGroupCount').value)||1,advancePerGroup:Number($('settingAdvance').value)||1,bestOfSets:Number($('settingBestOf').value),winPoints:Number($('settingWinPoints').value)||3,courts:Number($('settingCourts').value)||1,startTime:$('settingStartTime').value};
    if(next.maxTeams<state.teams.length) return toast(`Maximum teams cannot be below ${state.teams.length}.`);
    const structural = next.format!==state.settings.format || next.groupCount!==state.settings.groupCount || next.maxTeams!==state.settings.maxTeams || next.advancePerGroup!==state.settings.advancePerGroup;
    if(structural && (state.matches.length||state.teams.some(t=>t.letter)) && !confirm('These changes affect the tournament structure. Clear the draw and fixtures?')) return;
    state.settings=next;
    if(structural){state.teams.forEach(t=>{t.letter=null;t.drawIndex=null;t.group=null;});state.matches=[];state.knockoutGeneratedFromGroups=false;}
    addActivity('Tournament settings updated');saveState();toast('Settings saved.');
  });
  $('resetAllBtn').addEventListener('click',()=>{if(!confirm('Reset all teams, draw, matches, rules and settings? This cannot be undone.'))return;state=deepClone(defaultState);localStorage.removeItem(STORAGE_KEY);saveState();setPage('home');toast('Tournament data reset.');});

  $('exportBtn').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='spike-cup-26-backup.json';a.click();URL.revokeObjectURL(a.href);});
  $('importInput').addEventListener('change',(e)=>{const file=e.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const parsed=JSON.parse(reader.result);if(!parsed.settings||!Array.isArray(parsed.teams))throw new Error('Invalid backup');if(!confirm('Import this backup and replace current tournament data?'))return;state={...deepClone(defaultState),...parsed,settings:{...deepClone(defaultState.settings),...(parsed.settings||{})}};saveState();toast('Backup imported.');}catch{toast('Invalid backup file.');}};reader.readAsText(file);e.target.value='';});

  renderAll(); setPage('home');
})();