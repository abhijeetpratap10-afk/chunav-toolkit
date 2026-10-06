'use strict';
/* Strategy + Future tabs: booth-level vote model from community composition, priorities, organisation, outreach, plan.
   Everything seat-specific comes from region.json -> "model", "outreach", "plan", "risks", "rules". */

const CAT = [
  { k: 'strong', label: 'Strong', min: 0.55, color: '#1b7837', note: 'Expected support 55%+. Job: maximise turnout.' },
  { k: 'lean', label: 'Leaning', min: 0.47, color: '#7fbf7b', note: '47–55%. Job: turnout plus persuasion.' },
  { k: 'contested', label: 'Contested', min: 0.38, color: '#e0a030', note: '38–47%. Job: persuasion, local issues, candidate contact.' },
  { k: 'difficult', label: 'Difficult', min: 0, color: '#c0392b', note: 'Below 38%. Job: respectful outreach on development and welfare; never ignore.' }
];
const catOf = s => CAT.find(c => s >= c.min);

/* ---------- model configuration (region.json "model", with the user's overrides in settings) ---------- */
const MCFG = () => REGION.model || {};
function modelGroups() {
  const gs = MCFG().groups;
  if (gs && gs.length) return gs;
  const blocs = (REGION.castes || {}).blocs || {};          // fallback: one group per bloc from the rules file
  const names = [...new Set(Object.values(blocs).filter(Boolean))];
  return names.map(b => ({ k: b, label: b, bloc: b, members: Object.keys(blocs).filter(c => blocs[c] === b) }));
}
function groupOf() {
  const map = {};
  for (const g of modelGroups()) for (const m of g.members || []) map[m] = g.k;
  return { ...map, ...((S.store.settings || {}).casteGroup || {}) };
}
const DEFAULT_SUPPORT = () => Object.fromEntries(modelGroups().map(g => [g.k, (MCFG().support || {})[g.k] ?? 40]));
const partyName = () => (S.store.settings || {}).party || MCFG().party || 'our party';
const calib = () => MCFG().calibrate_to && MCFG().calibrate_to.share ? MCFG().calibrate_to : null;

function settings() {
  S.store.settings = S.store.settings || {};
  const st = S.store.settings;
  st.support = { ...DEFAULT_SUPPORT(), ...(st.support || {}) };
  if (st.turnout == null) st.turnout = MCFG().turnout || 60;
  if (st.calibrate == null) st.calibrate = !!calib();
  if (st.target == null) st.target = MCFG().target || 45;
  if (!st.pollDate) st.pollDate = MCFG().poll_date || '';
  return st;
}

/* ---------- the model ---------- */
let MODEL = null;
function runModel() {
  const st = settings();
  const GROUP_OF = groupOf();
  const booths = [];
  const groupTot = {};
  let unclassTot = 0;
  for (const p of S.P) {
    for (const b of p.booth_list) {
      const g = {};
      let U = 0;
      for (const c of b.castes) {
        const k = GROUP_OF[c.en];
        if (k && st.support[k] != null) g[k] = (g[k] || 0) + c.n; else U += c.n;
      }
      for (const [k, n] of Object.entries(g)) groupTot[k] = (groupTot[k] || 0) + n;
      unclassTot += U;
      booths.push({ p, b, g, U });
    }
  }
  const sup = k => st.support[k] / 100;
  const allC = Object.entries(groupTot).reduce((s2, [k, n]) => s2 + n * sup(k), 0);
  const allN = Object.values(groupTot).reduce((s2, n) => s2 + n, 0);
  const overallAvg = allN ? allC / allN : 0.4;
  for (const r of booths) {
    let num = 0, den = 0;
    for (const [k, n] of Object.entries(r.g)) { num += n * sup(k); den += n; }
    const avg = den ? num / den : overallAvg;
    r.raw = Math.min(0.97, Math.max(0.03, (num + r.U * avg) / Math.max(1, r.b.voters)));
  }
  const V = booths.reduce((s2, r) => s2 + r.b.voters, 0) || 1;
  const rawShare = booths.reduce((s2, r) => s2 + r.raw * r.b.voters, 0) / V;
  let delta = 0;
  const cal = calib();
  if (st.calibrate && cal) {
    const lg = p => Math.log(p / (1 - p)), sg = x => 1 / (1 + Math.exp(-x));
    let lo = -6, hi = 6;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      const m = booths.reduce((s2, r) => s2 + sg(lg(r.raw) + mid) * r.b.voters, 0) / V;
      if (m > cal.share) hi = mid; else lo = mid;
    }
    delta = (lo + hi) / 2;
    booths.forEach(r => { r.share = 1 / (1 + Math.exp(-(Math.log(r.raw / (1 - r.raw)) + delta))); });
  } else booths.forEach(r => { r.share = r.raw; });
  const T = st.turnout / 100;
  booths.forEach(r => {
    r.cat = catOf(r.share);
    r.turnoutGain = r.b.voters * 0.05 * (2 * r.share - 1);
  });
  const panch = new Map();
  for (const r of booths) {
    const a = panch.get(r.p.id) || { v: 0, s: 0 };
    a.v += r.b.voters; a.s += r.share * r.b.voters;
    panch.set(r.p.id, a);
  }
  const share = booths.reduce((s2, r) => s2 + r.share * r.b.voters, 0) / V;
  MODEL = { booths, groupTot, unclassTot, V, rawShare, share, delta, T, panchShare: id => { const a = panch.get(id); return a ? a.s / a.v : 0; } };
  return MODEL;
}
const modelColor = p => { const m = MODEL || runModel(); return catOf(m.panchShare(p.id)).color; };

/* ---------- helpers ---------- */
const pct = (n, d, k = 1) => d ? (n * 100 / d).toFixed(k) + '%' : '–';
function totalsOf(field) { let t = 0; S.P.forEach(p => p.booth_list.forEach(b => { t += b[field] || 0; })); return t; }
function blocTotals(m) {
  const t = {};
  for (const g of modelGroups()) t[g.bloc || g.k] = (t[g.bloc || g.k] || 0) + (m.groupTot[g.k] || 0);
  return t;
}

/* ---------- Strategy tab ---------- */
function renderStrategy() {
  const v = $('#view-strategy');
  if (!S.P.length) { v.innerHTML = '<div class="empty">No region loaded. Open one in Settings.</div>'; return; }
  const m = runModel();
  const st = settings();
  const H = S.history || {};
  const vs = (H.elections || []).filter(e => e.level === 'VS' || !e.level).sort((a, b) => b.year - a.year);
  const last = vs[0] || {};
  const cal = calib();
  const V = m.V, booths = m.booths.length;
  const women = totalsOf('women'), men = totalsOf('men'), y1825 = totalsOf('y1825'), y1819 = totalsOf('y1819'), old60 = totalsOf('old60'), pages = totalsOf('pages');
  const urbanBlocks = new Set(BLOCKS.filter(b => b.urban).map(b => b.hi));
  const city = S.P.filter(p => p.precision === 'town' || urbanBlocks.has(p.block_hi)).reduce((s2, p) => s2 + p.voters, 0);
  const bloc = blocTotals(m);
  const polled = V * m.T, modelVotes = m.share * polled, need = polled * st.target / 100;
  const cats = CAT.map(c => { const rs = m.booths.filter(r => r.cat === c); return { c, n: rs.length, v: rs.reduce((s2, r) => s2 + r.b.voters, 0) }; });
  const drop = last.electors ? last.electors - V : 0;
  const card = (big, small) => `<div class="kcard"><b>${big}</b><span>${small}</span></div>`;
  const party = partyName();

  const turnoutTop = m.booths.filter(r => r.share >= 0.5).sort((a, b) => b.turnoutGain - a.turnoutGain).slice(0, 40);
  const persuadeTop = m.booths.filter(r => r.share >= 0.38 && r.share < 0.55).sort((a, b) => b.b.voters - a.b.voters).slice(0, 40);
  const keyGroups = r => r.b.castes.filter(c => c.en !== UNCLASSIFIED()).slice(0, 3).map(c => `${esc(c.en)} ${(c.n * 100 / r.b.voters).toFixed(0)}%`).join(' · ');
  const boothTable = rows => rows.length ? `<div class="tscroll" style="max-height:420px"><table class="reg"><thead><tr><th>Booth</th><th>Polling station</th><th>Panchayat</th><th>Block</th><th class="r">Voters</th><th class="r">Model</th><th>Category</th><th class="r">Pages</th><th>Largest identified groups</th></tr></thead><tbody>${rows.map(r => `<tr class="srow" data-id="${esc(r.p.id)}"><td class="num">${r.b.no}</td><td>${esc(r.b.name_en)}</td><td>${esc(r.p.en)}</td><td>${esc(r.p.block_en)}</td><td class="r num">${fmt(r.b.voters)}</td><td class="r num">${(r.share * 100).toFixed(0)}%</td><td><span class="badge" style="background:${r.cat.color};color:#fff">${r.cat.label}</span></td><td class="r num">${r.b.pages || ''}</td><td class="muted">${keyGroups(r)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No booths in this group with the current numbers.</div>';

  const groups = modelGroups();
  const supportRows = groups.map(g => `<tr><td>${esc(g.label)}<div class="muted" style="font-size:11px">${esc((g.members || []).join(', '))}</div></td><td class="muted">${esc(g.bloc || '')}</td><td class="r num">${fmt(m.groupTot[g.k] || 0)}</td><td class="r num">${pct(m.groupTot[g.k] || 0, V)}</td>
    <td class="r"><input type="number" min="0" max="100" step="1" class="supin" data-g="${esc(g.k)}" value="${st.support[g.k]}" aria-label="Expected support among ${esc(g.label)}">%</td><td class="r muted num">${DEFAULT_SUPPORT()[g.k]}%</td></tr>`).join('');

  const outreachText = REGION.outreach || {};
  const blocNames = [...new Set(groups.map(g => g.bloc || g.k))];
  const outreach = [
    ...blocNames.map(b => [b, bloc[b] || 0, outreachText[b] || 'Meet respected community leaders, give the community visible roles in booth committees, and talk about local issues and welfare schemes that matter to these families.']),
    ...(m.unclassTot ? [['Not identified', m.unclassTot, `${pct(m.unclassTot, V)} of voters could not be placed in a group. Booth committees should check the community mix on the ground. The model gives each one the average support of the identified voters in the same booth.`]] : [])
  ];
  const findings = [
    last.margin ? `<li><b>Every vote counts.</b> The last assembly election (${last.year}) was decided by ${fmt(last.margin)} votes out of ${fmt(last.polled || 0)}, about ${(last.margin / booths).toFixed(1)} votes per booth.</li>` : '',
    drop ? `<li><b>The roll has changed.</b> It now has ${fmt(V)} voters against ${fmt(last.electors)} in ${last.year} (${drop > 0 ? fmt(drop) + ' fewer' : fmt(-drop) + ' more'}). Make sure every eligible supporter is enrolled (Form 6).</li>` : '',
    `<li><b>Composition (${!hasNewLogic() ? 'surname rules' : casteSource() === 'new' ? 'new logic estimate' : 'surname rules only'}):</b> ${blocNames.map(b => `${esc(b)} ${pct(bloc[b] || 0, V)}`).join(', ')}, not identified ${pct(m.unclassTot, V)}. Totals are useful for planning; single voters can be wrong.</li>`,
    men ? `<li><b>Gender:</b> ${fmt(women)} women and ${fmt(men)} men, ${Math.round(women * 1000 / Math.max(1, men))} women per 1,000 men.${women < men * 0.95 ? ' Women look under-enrolled: run a women\'s enrolment drive.' : ''}</li>` : '',
    y1825 ? `<li><b>Young voters:</b> ${fmt(y1825)} voters are aged 18–25 (${pct(y1825, V)}), ${fmt(y1819)} of them 18–19. Enrol everyone who turns 18 by the qualifying date.</li>` : '',
    city ? `<li><b>Urban areas:</b> ${fmt(city)} voters (${pct(city, V)}) live in towns or city wards. Urban turnout is usually lower, so plan ward by ward.</li>` : '',
    `<li><b>Booth map:</b> ${cats.map(c => `${c.c.label} ${c.n} (${fmt(c.v)} voters)`).join(' · ')}.</li>`,
    old60 ? `<li><b>${fmt(old60)} voters are 60+.</b> Help those eligible use the ECI home-voting facility (Form 12D) when the schedule is announced.</li>` : ''
  ].join('');

  v.innerHTML = `
  <div class="pagebar"><h2>Strategy</h2>${casteSourceControl()}<span class="muted">${esc(seatName())}${REGION.state ? ' · ' + esc(REGION.state) : ''} · ${esc(party)}</span></div>
  <div class="kgrid">
    ${card(fmt(V), `voters on the roll${drop ? ` · ${fmt(Math.abs(drop))} ${drop > 0 ? 'fewer' : 'more'} than ${last.year}` : ''}`)}
    ${last.margin ? card(fmt(last.margin), `${last.year} winning margin · ${(last.margin / booths).toFixed(1)} votes per booth`) : card(fmt(booths), 'booths')}
    ${card((m.share * 100).toFixed(1) + '%', `modelled ${esc(party)} share${st.calibrate && cal ? `, calibrated to ${esc(cal.label || 'the last result')}` : ''} · ${fmt(Math.round(modelVotes))} votes at ${st.turnout}% turnout`)}
    ${card(fmt(Math.round(need)), `votes needed for a ${st.target}% share · gap ${fmt(Math.round(need - modelVotes))}`)}
    ${card(fmt(pages), `panna pramukhs needed (one per voter-list page) across ${booths} booths`)}
  </div>

  <section class="card"><h3>What the numbers say</h3><ol class="findings">${findings}</ol></section>

  ${(H.elections || []).length ? `<section class="card"><h3>Election history</h3>
    <p class="muted" style="margin:0 0 10px">${esc((H.segments || {}).note || '')}</p>
    ${[['VS', 'Vidhan Sabha (assembly) elections'], ['LS', 'Lok Sabha (parliament) elections']].map(([lv, title]) => { const es = H.elections.filter(e => (e.level || 'VS') === lv); return es.length ? `
      <div class="hy" style="margin:6px 0 6px;font-size:15px">${title}</div>
      <div class="hgrid">${es.map(e => `<div class="hbox ${lv}"><div class="hy">${e.year} · ${lv === 'VS' ? 'Vidhan Sabha' : 'Lok Sabha'}</div><table class="mini">${(e.results || []).map(r => `<tr><td>${esc(r.candidate)} <span class="muted">${esc(r.party)}</span></td><td class="n">${fmt(r.votes)}</td><td class="n">${Number(r.pct).toFixed(1)}%</td></tr>`).join('')}</table>
        <div class="muted" style="margin-top:4px">Winner ${esc(e.winner)} · margin ${fmt(e.margin)}${e.turnout ? ` · turnout ${e.turnout}%` : ''}</div>${e.note ? `<div class="muted" style="margin-top:4px">${esc(e.note)}</div>` : ''}</div>`).join('')}</div>` : ''; }).join('')}
    ${((H.segments || {}).list || []).length ? `<div class="hy" style="margin:14px 0 6px;font-size:15px">Assembly segments of the Lok Sabha seat</div>
    <table class="mini" style="max-width:640px">${H.segments.list.map(g => `<tr${g.this ? ' style="font-weight:700"' : ''}><td class="num">${g.no}</td><td>${esc(g.name)}${g.reserved ? ` <span class="muted">(${g.reserved})</span>` : ''}${g.this ? ' ← this seat' : ''}</td><td>${esc(g.mla)}</td><td>${esc(g.party)}</td></tr>`).join('')}</table>` : ''}
    ${(H.sources || []).length ? `<div class="muted" style="margin-top:8px">Sources: ${H.sources.map(s2 => esc(s2.label)).join('; ')}.</div>` : ''}</section>` : ''}

  <section class="card"><h3>Vote model and assumptions</h3>
    <p class="muted" style="margin:0 0 8px">Expected ${esc(party)} support per community group. Default numbers: ${esc(MCFG().support_source || 'set in region.json')}. Change any number to match what your booth workers report; which community belongs to which group is set in Settings. Voters not placed in a group get the average of the identified voters in the same booth.${cal ? ` With "calibrate" on, every booth is shifted equally so the seat total matches ${esc(cal.label || 'the last result')} (${(cal.share * 100).toFixed(1)}%).` : ''} The model is a planning aid, not a forecast.</p>
    <div class="row" style="gap:16px;margin-bottom:8px">
      <label class="row">Turnout <input type="number" id="stTurn" min="30" max="95" value="${st.turnout}" style="width:70px">%</label>
      <label class="row">Target share <input type="number" id="stTarget" min="20" max="80" value="${st.target}" style="width:70px">%</label>
      ${cal ? `<label class="row"><input type="checkbox" id="stCal" ${st.calibrate ? 'checked' : ''}> Calibrate to ${esc(cal.label || 'last result')}</label>` : ''}
      <button type="button" class="btn small" id="stReset">Reset to defaults</button>
      <button type="button" class="btn small" id="stMap">Show model on map</button>
      ${cal ? `<span class="muted">Uncalibrated estimate: ${(m.rawShare * 100).toFixed(1)}%</span>` : ''}
    </div>
    <div class="tscroll" style="max-height:none"><table class="reg"><thead><tr><th>Group</th><th>Bloc</th><th class="r">Voters</th><th class="r">Share</th><th class="r">Expected support</th><th class="r">Default</th></tr></thead><tbody>${supportRows}
      <tr><td>Not identified</td><td class="muted">—</td><td class="r num">${fmt(m.unclassTot)}</td><td class="r num">${pct(m.unclassTot, V)}</td><td class="r muted">booth average</td><td></td></tr></tbody></table></div>
    <div class="catrow">${cats.map(c => `<div class="catcard" style="border-color:${c.c.color}"><b style="color:${c.c.color}">${c.c.label}</b><span class="num">${c.n} booths · ${fmt(c.v)} voters</span><small class="muted">${c.c.note}</small></div>`).join('')}</div></section>

  <section class="card"><h3>Top 40 booths for turnout</h3><p class="muted" style="margin:0 0 8px">Supportive booths ranked by the extra net votes a 5-point turnout rise would bring. Put the strongest booth committees and panna pramukhs here.</p>${boothTable(turnoutTop)}</section>
  <section class="card"><h3>Top 40 booths for persuasion</h3><p class="muted" style="margin:0 0 8px">The largest leaning and contested booths. The candidate should visit these, hear local issues, and recruit respected local people.</p>${boothTable(persuadeTop)}</section>

  <section class="card"><h3>Organisation needed</h3><div class="orggrid">
    ${[['Areas with a sanyojak', S.store.areas.length, Math.ceil(S.P.length / 8), 'about 8 panchayats each'],
      ['Panchayats with a sah-sanyojak', [...S.areaOf.keys()].filter(id => hasSah(S.byId.get(id))).length, S.P.length, 'one per panchayat; cities by ward'],
      ['Shakti Kendras', '—', Math.ceil(booths / 5), 'one per 5 booths'],
      ['Booth committees', '—', booths, 'one per booth, all communities represented'],
      ['Panna pramukhs', '—', pages, 'one per voter-list page of about 30 voters'],
      ['Polling agents', '—', booths * 2, 'one agent and one reliever per booth']]
      .map(([l, have, need2, note]) => `<div class="org"><b class="num">${have} / ${fmt(need2)}</b><span>${l}</span><small class="muted">${note}</small></div>`).join('')}
  </div></section>

  <section class="card"><h3>Outreach by community</h3><div class="ogrid">${outreach.map(([t, n, txt]) => `<div class="ocard"><div class="row" style="justify-content:space-between"><b>${esc(t)}</b><span class="num muted">${fmt(n || 0)} · ${pct(n || 0, V)}</span></div><p>${esc(txt)}</p></div>`).join('')}</div>
    <p class="muted" style="margin:8px 0 0">The campaign should speak about development, local issues and the candidate's record to every voter. Community data is only for internal planning, such as who visits which booth.</p></section>

  <section class="card rules"><h3>Rules that must be followed</h3><ul>
    <li>Asking for votes on the grounds of religion, caste, race, community or language is a corrupt practice (Representation of the People Act 1951, Section 123(3) and 123(3A)) and can void the election.</li>
    <li>No cash, liquor or gifts to voters (Section 123(1)), and no hired transport for voters to the booth (Section 123(5)).</li>
    <li>Follow the Model Code of Conduct from the day the schedule is announced: permissions for rallies and vehicles, no religious places for campaigning.</li>
    <li>Keep a daily expense register${REGION.expense_limit ? `. The expenditure limit for an assembly candidate here is ${esc(REGION.expense_limit)}` : ' and stay within the ECI expenditure limit for your state'}.</li>
    <li>Voter-list data is personal information. Share contact lists only with your own workers, and never publish them.</li>
    ${(REGION.rules || []).map(r => `<li>${esc(r)}</li>`).join('')}
  </ul></section>`;

  const save = () => { scheduleSave(); renderStrategy(); };
  v.querySelectorAll('.supin').forEach(inp => inp.onchange = () => { const x = Math.max(0, Math.min(100, Number(inp.value) || 0)); settings().support[inp.dataset.g] = x; save(); });
  $('#stTurn').onchange = e => { settings().turnout = Math.max(30, Math.min(95, Number(e.target.value) || 60)); save(); };
  $('#stTarget').onchange = e => { settings().target = Math.max(20, Math.min(80, Number(e.target.value) || 45)); save(); };
  if ($('#stCal')) $('#stCal').onchange = e => { settings().calibrate = e.target.checked; save(); };
  $('#stReset').onclick = () => { settings().support = { ...DEFAULT_SUPPORT() }; save(); };
  $('#stMap').onclick = () => { S.mode = 'model'; $$('#colorby button').forEach(x => x.setAttribute('aria-pressed', x.dataset.mode === 'model')); setTab('map'); };
  v.querySelectorAll('tr.srow').forEach(tr => tr.onclick = () => openOnMap(S.byId.get(tr.dataset.id)));
}

/* ---------- Future tab ---------- */
function defaultPlan() {
  const booths = S.P.reduce((s2, p) => s2 + p.booths, 0);
  return [
    { phase: 'Organisation', when: 'First two months', items: [
      ['areas', `Group all ${S.P.length} panchayats into areas and appoint a sanyojak for each`, 'live:areas'],
      ['sah', 'Appoint a sah-sanyojak in every panchayat (ward-wise in cities)', 'live:sah'],
      ['committees', `Form a committee in every one of the ${booths} booths, with every community represented`],
      ['panna', 'Name a panna pramukh for every voter-list page'],
      ['form20', 'Get the official Form-20 booth-wise results of past elections from the state CEO website and compare them with the model'],
      ['unity', 'Bring all local party leaders on board, so there is one campaign']
    ] },
    { phase: 'Voter list', when: 'During the claims and objections period', items: [
      ['check', 'Booth committees check that every known supporter is on the roll'],
      ['form6', 'File Form 6 for eligible people missing from the roll, and Form 8 for corrections'],
      ['youth', 'First-time voter drive: everyone who turns 18 by the qualifying date'],
      ['women', 'Women\'s enrolment drive where women are under-enrolled']
    ] },
    { phase: 'Outreach', when: 'Before the schedule is announced', items: [
      ['jansampark', 'Candidate visits every panchayat and city ward at least once, starting with the persuasion booths'],
      ['leaders', 'Meet respected community and village leaders of every community in every block'],
      ['beneficiaries', 'Contact beneficiaries of government schemes, booth by booth'],
      ['issues', `Collect local issues from booth committees and publish a development plan for ${REGION.name || 'the seat'}`],
      ['youthwomen', 'Separate youth and women\'s meetings in every block']
    ] },
    { phase: 'Campaign', when: 'From the date the schedule is announced', items: [
      ['mcc', 'Set up a Model Code compliance and permissions cell, and keep the daily expense register'],
      ['door', 'Three rounds of door-to-door contact by panna pramukhs'],
      ['slips', 'Make sure every voter receives the official voter information slip'],
      ['home', 'Help eligible elderly voters and voters with disabilities apply for home voting (Form 12D)']
    ] },
    { phase: 'Polling and counting', when: 'Poll day and counting day', items: [
      ['agents', 'Appoint a trained polling agent and a reliever for every booth'],
      ['tracking', 'Track turnout every two hours in the priority booths and follow up with supporters who have not voted'],
      ['counting', 'Appoint counting agents for every counting table and keep Form 17C copies from every booth']
    ] }
  ];
}
function renderFuture() {
  const v = $('#view-future');
  const st = settings();
  S.store.plan = S.store.plan || { done: {}, notes: {}, custom: [] };
  const plan = S.store.plan;
  const days = st.pollDate ? Math.ceil((new Date(st.pollDate) - new Date()) / 86400000) : null;
  const live = key => {
    if (key === 'live:areas') { const n = S.areaOf.size; return { done: n === S.P.length, txt: `${n}/${S.P.length} panchayats in areas` }; }
    if (key === 'live:sah') { const n = S.P.filter(hasSah).length; return { done: n === S.P.length, txt: `${n}/${S.P.length} sah-sanyojaks` }; }
    return null;
  };
  const base = (REGION.plan && REGION.plan.length) ? REGION.plan : defaultPlan();
  const phases = [...base, { phase: 'My own tasks', when: 'Added by you', items: plan.custom.map(c => [c.id, c.text]) }];
  const risks = REGION.risks || [];
  v.innerHTML = `<div class="pagebar"><h2>Road to polling day</h2>
      <label class="row">Expected polling date <input type="date" id="fuDate" value="${esc(st.pollDate)}"></label>
      ${days == null ? '' : `<span class="badge" style="background:var(--accent);color:var(--paper);font-size:14px">${days > 0 ? `${days} days to go` : 'Polling date has passed'}</span>`}
      <span class="muted">Change the date when the Election Commission announces the schedule.</span></div>
    <div class="fgrid">${phases.map(ph => {
      const items = ph.items.map(([id, text, lk]) => { const l = lk ? live(lk) : null; return { id, text, l, done: l ? l.done : !!plan.done[id] }; });
      const nd = items.filter(i => i.done).length;
      return `<section class="card"><div class="row" style="justify-content:space-between"><h3 style="margin:0">${esc(ph.phase)}</h3><span class="muted num">${nd}/${items.length}</span></div>
        <div class="muted" style="margin:2px 0 8px">${esc(ph.when)}</div>
        <div class="bar" style="height:6px;margin-bottom:8px"><span style="width:${items.length ? nd * 100 / items.length : 0}%;background:var(--accent)"></span></div>
        ${items.map(i => `<div class="task"><label class="row" style="align-items:flex-start;flex-wrap:nowrap"><input type="checkbox" data-task="${esc(i.id)}" ${i.done ? 'checked' : ''} ${i.l ? 'disabled' : ''}><span>${esc(i.text)}${i.l ? ` <span class="badge" style="background:var(--chip)">${esc(i.l.txt)}</span>` : ''}</span></label>
          <input type="text" class="tnote" data-note="${esc(i.id)}" value="${esc(plan.notes[i.id] || '')}" placeholder="Owner / note" aria-label="Note for ${esc(i.text)}">
          ${ph.phase === 'My own tasks' ? `<button type="button" class="btn small danger" data-deltask="${esc(i.id)}">Remove</button>` : ''}</div>`).join('') || '<div class="empty">No tasks yet.</div>'}
        ${ph.phase === 'My own tasks' ? `<div class="row" style="margin-top:8px"><input type="text" id="fuNew" placeholder="Add a task" style="flex:1"><button type="button" class="btn small" id="fuAdd">Add</button></div>` : ''}</section>`;
    }).join('')}
    ${risks.length ? `<section class="card"><h3>Watch list</h3><ul class="findings">${risks.map(r => `<li>${esc(r)}</li>`).join('')}</ul></section>` : ''}</div>`;
  v.querySelectorAll('[data-task]').forEach(c => c.onchange = () => { plan.done[c.dataset.task] = c.checked; scheduleSave(); renderFuture(); });
  v.querySelectorAll('[data-note]').forEach(i => i.onchange = () => { plan.notes[i.dataset.note] = i.value.trim(); scheduleSave(); });
  v.querySelectorAll('[data-deltask]').forEach(b => b.onclick = () => { plan.custom = plan.custom.filter(c => c.id !== b.dataset.deltask); scheduleSave(); renderFuture(); });
  const add = () => { const t = $('#fuNew').value.trim(); if (!t) return; plan.custom.push({ id: 'c' + Date.now().toString(36), text: t }); scheduleSave(); renderFuture(); };
  $('#fuAdd').onclick = add;
  $('#fuNew').onkeydown = e => { if (e.key === 'Enter') add(); };
  $('#fuDate').onchange = e => { settings().pollDate = e.target.value; scheduleSave(); renderFuture(); };
}

/* ---------- export sheet ---------- */
function boothPlanSheet() {
  const m = runModel();
  const rows = [...m.booths].sort((a, b) => a.b.no - b.b.no).map(r => [r.b.no, r.b.name_en, r.b.name_hi, r.p.en, r.p.block_en, S.areaOf.get(r.p.id)?.name || 'Not assigned',
    r.b.voters, r.b.women || 0, r.b.y1825 || 0, r.b.pages || 0, Math.round(r.share * 100), r.cat.label, Math.round(r.turnoutGain)]);
  return { name: 'Booth plan', widths: [7, 40, 40, 22, 14, 14, 9, 9, 10, 8, 10, 12, 16], rows: [['Booth', 'Polling station', 'Polling station (local)', 'Panchayat', 'Block', 'Area', 'Voters', 'Women', 'Age 18-25', 'Pages', 'Model support %', 'Category', 'Net votes from +5 pts turnout'], ...rows] };
}
