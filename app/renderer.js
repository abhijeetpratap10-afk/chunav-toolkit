'use strict';
/* Sanyojak Map: areas -> sanyojak (area convenor), panchayat -> sah-sanyojak (co-convenor). */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => Number(n).toLocaleString('en-IN');
const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`; };
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

/* Everything about the seat comes from the region pack (regions/<id>/region.json). */
let REGION = {};
let BLOCKS = [];        // [{ hi, en, color, urban, v: css var }]
let blockOf = {};
let CASTE_COL = {};
const AREA_COLORS = ['#e6550d', '#3182bd', '#2ca25f', '#8856a7', '#d7301f', '#00a6a6', '#b8a100', '#8c510a', '#e377c2', '#4d4d4d', '#1b9e77', '#7570b3', '#f58231', '#0b6e99'];
const BLOCK_PALETTE = ['#2f6db5', '#4e8a3e', '#8a4fa3', '#b4572e', '#c0392b', '#00838f', '#9e7c0c', '#5d4037', '#ad1457', '#37474f'];
const casteColor = en => CASTE_COL[en] || '#7d8a74';
const UNCLASSIFIED = () => (REGION.castes && REGION.castes.unclassified) || 'Unclassified';
const seatName = () => [REGION.name, REGION.number].filter(Boolean).join(' ');
const lighten = (hex, f) => { const n = parseInt(hex.slice(1), 16); const m = c => Math.round(c + (255 - c) * f); return `rgb(${m(n >> 16)},${m((n >> 8) & 255)},${m(n & 255)})`; };

function applyRegion(region) {
  REGION = region || {};
  const st = (S.store.settings = S.store.settings || {});
  const fromData = [...new Set(S.P.map(p => p.block_hi))];
  const listed = (REGION.blocks || []).filter(b => fromData.includes(b.hi));
  const all = [...listed, ...fromData.filter(h => !listed.some(b => b.hi === h)).map(h => ({ hi: h, en: S.P.find(p => p.block_hi === h).block_en || h }))];
  BLOCKS = all.map((b, i) => ({ ...b, color: (st.blockColors || {})[b.hi] || b.color || BLOCK_PALETTE[i % BLOCK_PALETTE.length], v: `--b-${i}` }));
  blockOf = Object.fromEntries(BLOCKS.map(b => [b.hi, b]));
  CASTE_COL = { ...((REGION.castes || {}).colors || {}), ...(st.casteColors || {}) };
  let tag = document.getElementById('regionvars');
  if (!tag) { tag = document.createElement('style'); tag.id = 'regionvars'; document.head.appendChild(tag); }
  const vars = f => BLOCKS.map(b => `${b.v}: ${f ? lighten(b.color, f) : b.color};`).join(' ');
  tag.textContent = `:root { ${vars(0)} } @media (prefers-color-scheme: dark) { :root { ${vars(0.35)} } }`;
  const local = [REGION.local_name, REGION.number].filter(Boolean).join(' ');
  $('.brand').innerHTML = `<b>Sanyojak Map</b><span class="hi">${esc(local || 'No region loaded')}</span>`;
  $('#map').setAttribute('aria-label', `Map of ${seatName() || 'the seat'} with panchayats`);
  document.title = seatName() ? `${seatName()} · Sanyojak Map` : 'Sanyojak Map';
  S.blocks = new Set(BLOCKS.map(b => b.hi));
}

let REG_COLS = [];
const S = {
  P: [], B: {}, byId: new Map(), areaOf: new Map(), dupPhones: new Map(),
  store: { version: 1, areas: [], sah: {} },
  tab: 'map', mode: 'area', selectMode: false, sel: new Set(), focus: null,
  blocks: new Set(), q: '', show: 'all', regions: [], regionDir: '',
  layers: { areas: true, tehsil: true, district: true, cities: true, rivers: true, roads: true, rail: true },
  reg: { q: '', block: 'all', area: 'all', missing: false, caste: false, pct: false, open: new Set(), sort: { key: 'voters', dir: -1 } }
};

/* ---------- phone helpers ---------- */
const normPhone = s => {
  let d = String(s || '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d.slice(0, 13);
};
const validPhone = d => /^[6-9]\d{9}$/.test(d);
const fmtPhone = d => (d.length === 10 ? `${d.slice(0, 5)} ${d.slice(5)}` : d);
function phoneHint(d, ownerKey) {
  if (!d) return '';
  if (!validPhone(d)) return 'Enter a 10-digit mobile number';
  const others = (S.dupPhones.get(d) || []).filter(o => o.key !== ownerKey);
  return others.length ? `Also used by ${others.map(o => o.label).join(', ')}` : '';
}

/* ---------- derived data ---------- */
function rebuild() {
  S.areaOf = new Map();
  for (const a of S.store.areas) for (const id of a.panchayats) if (S.byId.has(id)) S.areaOf.set(id, a);
  S.dupPhones = new Map();
  const add = (phone, key, label) => {
    if (!phone) return;
    if (!S.dupPhones.has(phone)) S.dupPhones.set(phone, []);
    S.dupPhones.get(phone).push({ key, label });
  };
  for (const a of S.store.areas) add(a.sanyojak?.phone, 'a:' + a.id, `${a.name} sanyojak`);
  for (const [id, r] of Object.entries(S.store.sah)) { const p = S.byId.get(id); if (p) add(r.phone, 's:' + id, `${p.en} sah-sanyojak`); }
}
const sahOf = id => S.store.sah[id] || null;
const hasSah = p => { const r = sahOf(p.id); return !!(r && (r.name || r.phone)); };
const largest = p => (p.castes.find(c => c.en !== UNCLASSIFIED()) || p.castes[0] || { en: UNCLASSIFIED() }).en;
const areaStats = a => {
  const ps = a.panchayats.map(id => S.byId.get(id)).filter(Boolean);
  return { ps, voters: ps.reduce((s, p) => s + p.voters, 0), booths: ps.reduce((s, p) => s + p.booths, 0), sah: ps.filter(hasSah).length };
};
const matches = (p, q) => {
  if (!q) return true;
  const ql = q.toLowerCase();
  return p.en.toLowerCase().includes(ql) || p.hi.includes(q) ||
    p.villages.some(v => v.en.toLowerCase().includes(ql) || v.hi.includes(q)) ||
    (p.booth_list || []).some(b => b.name_en.toLowerCase().includes(ql) || b.name_hi.includes(q) || String(b.no) === ql) ||
    (sahOf(p.id)?.name || '').toLowerCase().includes(ql) || (S.areaOf.get(p.id)?.name || '').toLowerCase().includes(ql);
};
const visible = p => {
  if (!S.blocks.has(p.block_hi) || !matches(p, S.q)) return false;
  if (S.show === 'none') return !S.areaOf.has(p.id);
  if (S.show === 'nosah') return S.areaOf.has(p.id) && !hasSah(p);
  return true;
};
const colorOf = p => {
  if (S.mode === 'area') return S.areaOf.get(p.id)?.color || css('--none');
  if (S.mode === 'block') return (blockOf[p.block_hi] || {}).color || css('--none');
  if (S.mode === 'model') return modelColor(p);
  return casteColor(largest(p));
};

/* ---------- caste data source (new logic = default) ---------- */
const casteSource = () => ((S.store.settings || {}).casteSource === 'old' ? 'old' : 'new');
function applyCasteSource() {
  const src = casteSource();
  for (const p of S.P) {
    p.castes = (src === 'old' ? p.castes_old : p.castes_new) || p.castes_old || [];
    for (const b of p.booth_list) b.castes = (src === 'old' ? b.castes_old : b.castes_new) || b.castes_old || [];
  }
  const tot = {};
  S.P.forEach(p => p.castes.forEach(c => { tot[c.en] = (tot[c.en] || 0) + c.n; }));
  REG_COLS = Object.entries(tot).filter(([k]) => k !== UNCLASSIFIED()).sort((a, b) => b[1] - a[1]).slice(0, 12).map(e => e[0]);
  if (tot[UNCLASSIFIED()]) REG_COLS.splice(Math.min(REG_COLS.length, 1), 0, UNCLASSIFIED());
  if (typeof MODEL !== 'undefined') MODEL = null;
}
function setCasteSource(src) {
  S.store.settings = S.store.settings || {};
  S.store.settings.casteSource = src;
  applyCasteSource();
  scheduleSave();
  refresh();
  toast(src === 'new' ? 'Using NEW LOGIC caste estimates' : 'Using OLD surname-only caste data');
}
const hasNewLogic = () => S.P.some(p => p.castes_new && p.castes_new.length);
const casteSourceControl = () => !hasNewLogic() ? '' : `<label class="row muted">Caste data <select class="csrc" aria-label="Caste data source"><option value="new" ${casteSource() === 'new' ? 'selected' : ''}>New logic (recommended)</option><option value="old" ${casteSource() === 'old' ? 'selected' : ''}>Old logic (surname only)</option></select></label>`;

/* ---------- persistence ---------- */
let saveTimer = null;
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      const r = await window.api.saveStore(S.store);
      $('#saved').textContent = 'Saved ' + new Date(r.updated).toLocaleTimeString();
    } catch (e) { $('#saved').textContent = 'Not saved!'; toast('Could not save: ' + e.message); }
  }, 250);
}
function commit(opts = {}) { rebuild(); scheduleSave(); refresh(opts); }

/* ---------- mutations ---------- */
function removeFromAreas(pids) {
  const set = new Set(pids);
  for (const a of S.store.areas) a.panchayats = a.panchayats.filter(id => !set.has(id));
}
function saveArea(existing, f) {
  removeFromAreas(f.pids);
  if (existing) Object.assign(existing, { name: f.name, color: f.color, sanyojak: f.sanyojak, panchayats: [...f.pids] });
  else S.store.areas.push({ id: 'a' + Date.now().toString(36), name: f.name, color: f.color, sanyojak: f.sanyojak, panchayats: [...f.pids], created: new Date().toISOString() });
  commit();
}
function setSah(pid, patch) {
  const cur = S.store.sah[pid] || { name: '', phone: '' };
  const next = { ...cur, ...patch };
  if (!next.name && !next.phone) delete S.store.sah[pid]; else S.store.sah[pid] = next;
  commit({ inspector: false, table: false, areas: false });
}
const nextAreaName = () => {
  const used = new Set(S.store.areas.map(a => a.name.toLowerCase()));
  for (let i = 0; i < 26; i++) { const n = 'Area ' + String.fromCharCode(65 + i); if (!used.has(n.toLowerCase())) return n; }
  for (let i = 1; ; i++) { const n = 'Area A' + i; if (!used.has(n.toLowerCase())) return n; }
};
const nextColor = () => AREA_COLORS.find(c => !S.store.areas.some(a => a.color === c)) || AREA_COLORS[S.store.areas.length % AREA_COLORS.length];

/* ---------- dialogs & toast ---------- */
let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}
function modal(title, bodyHtml, buttons, onMount) {
  const d = $('#dlg');
  d.innerHTML = `<div class="dlg"><header>${esc(title)}</header><div class="body">${bodyHtml}</div><footer></footer></div>`;
  const foot = $('footer', d);
  buttons.forEach(b => {
    const el = document.createElement('button');
    el.type = 'button'; el.className = 'btn ' + (b.cls || ''); el.textContent = b.label;
    el.onclick = () => { if (!b.onClick || b.onClick() !== false) d.close(); };
    foot.appendChild(el);
  });
  if (!d.open) d.showModal();
  onMount && onMount(d);
}
const ask = (title, text, okLabel, danger) => new Promise(res => {
  let done = false;
  modal(title, `<p>${text}</p>`, [
    { label: 'Cancel', onClick: () => { done = true; res(false); } },
    { label: okLabel, cls: danger ? 'primary danger' : 'primary', onClick: () => { done = true; res(true); } }
  ]);
  $('#dlg').addEventListener('close', () => { if (!done) res(false); }, { once: true });
});

/* ---------- area dialog ---------- */
function areaDialog(existing, preselect = []) {
  const chosen = new Set(existing ? existing.panchayats : preselect);
  let color = existing ? existing.color : nextColor();
  const body = `
    <div class="grid2">
      <div class="field"><label for="ad-name">Area name</label><input id="ad-name" type="text" value="${esc(existing ? existing.name : nextAreaName())}" maxlength="40"><div class="hint" id="ad-nameh"></div></div>
      <div class="field"><label>Colour</label><div class="swatches" id="ad-sw"></div></div>
      <div class="field"><label for="ad-sn">Sanyojak name</label><input id="ad-sn" type="text" value="${esc(existing?.sanyojak?.name || '')}" maxlength="60"></div>
      <div class="field"><label for="ad-sp">Sanyojak mobile</label><input id="ad-sp" type="tel" inputmode="numeric" placeholder="98765 43210" value="${esc(fmtPhone(existing?.sanyojak?.phone || ''))}"><div class="hint" id="ad-sph"></div></div>
    </div>
    <div class="field" style="margin-top:12px"><label>Panchayats in this area <b id="ad-count" class="num"></b></label>
      <div class="row"><input id="ad-q" type="search" placeholder="Search panchayat or village" style="flex:1"><button type="button" class="btn small" id="ad-all">Select shown</button><button type="button" class="btn small" id="ad-none">Clear all</button></div>
      <div class="picker" id="ad-list"></div></div>`;
  modal(existing ? `Edit ${existing.name}` : 'New area', body, [
    { label: 'Cancel' },
    {
      label: existing ? 'Save changes' : 'Create area', cls: 'primary', onClick: () => {
        const name = $('#ad-name').value.trim();
        const dup = S.store.areas.some(a => a !== existing && a.name.toLowerCase() === name.toLowerCase());
        const phone = normPhone($('#ad-sp').value);
        if (!name) { $('#ad-nameh').textContent = 'Give the area a name'; return false; }
        if (dup) { $('#ad-nameh').textContent = 'Another area already has this name'; return false; }
        if (phone && !validPhone(phone)) { $('#ad-sph').textContent = 'Enter a 10-digit mobile number'; return false; }
        if (!chosen.size) { toast('Pick at least one panchayat'); return false; }
        saveArea(existing, { name, color, sanyojak: { name: $('#ad-sn').value.trim(), phone }, pids: chosen });
        toast(existing ? `${name} updated` : `${name} created with ${chosen.size} panchayats`);
        if (S.tab === 'map') { const ps = [...chosen].map(id => S.byId.get(id)); SMap.fitTo(ps); }
      }
    }
  ], d => {
    const sw = $('#ad-sw', d);
    const drawSw = () => { sw.innerHTML = AREA_COLORS.map(c => `<button type="button" aria-label="Colour ${c}" aria-pressed="${c === color}" style="background:${c}" data-c="${c}"></button>`).join(''); };
    drawSw();
    sw.onclick = e => { const b = e.target.closest('[data-c]'); if (b) { color = b.dataset.c; drawSw(); } };
    const list = $('#ad-list', d), count = $('#ad-count', d);
    const draw = () => {
      const q = $('#ad-q', d).value.trim();
      let html = '';
      for (const b of BLOCKS) {
        const ps = S.P.filter(p => p.block_hi === b.hi && matches(p, q)).sort((x, y) => x.en.localeCompare(y.en));
        if (!ps.length) continue;
        html += `<div class="grp">${esc(b.en)}</div>` + ps.map(p => {
          const other = S.areaOf.get(p.id);
          const tag = other && other !== existing ? `<span class="taken">moves from ${esc(other.name)}</span>` : `<span class="taken">${fmt(p.voters)}</span>`;
          return `<label><input type="checkbox" data-pid="${esc(p.id)}" ${chosen.has(p.id) ? 'checked' : ''}><span>${esc(p.en)} <small class="hi muted">${esc(p.hi.replace(/ \(.*/, ''))}</small></span>${tag}</label>`;
        }).join('');
      }
      list.innerHTML = html || '<div class="empty" style="padding:12px">No panchayats match.</div>';
      const voters = [...chosen].reduce((s, id) => s + (S.byId.get(id)?.voters || 0), 0);
      count.textContent = `· ${chosen.size} selected · ${fmt(voters)} voters`;
    };
    draw();
    list.onchange = e => { const c = e.target.closest('[data-pid]'); if (c) { c.checked ? chosen.add(c.dataset.pid) : chosen.delete(c.dataset.pid); draw(); } };
    $('#ad-q', d).oninput = draw;
    $('#ad-all', d).onclick = () => { $$('#ad-list [data-pid]', d).forEach(c => chosen.add(c.dataset.pid)); draw(); };
    $('#ad-none', d).onclick = () => { chosen.clear(); draw(); };
    $('#ad-sp', d).oninput = e => { const n = normPhone(e.target.value); $('#ad-sph', d).textContent = n ? phoneHint(n, existing ? 'a:' + existing.id : '') : ''; };
  });
}

/* ---------- KPIs / legend / chips ---------- */
function renderKpis() {
  const assigned = S.areaOf.size;
  const sah = [...S.areaOf.keys()].filter(id => hasSah(S.byId.get(id))).length;
  const covered = [...S.areaOf.keys()].reduce((s, id) => s + S.byId.get(id).voters, 0);
  const total = S.P.reduce((s, p) => s + p.voters, 0);
  const k = (b, l) => `<div class="kpi"><b>${b}</b><span>${l}</span></div>`;
  $('#kpis').innerHTML = k(S.store.areas.length, 'areas') + k(`${assigned}/${S.P.length}`, 'panchayats in areas') +
    k(`${sah}/${assigned}`, 'sah-sanyojaks appointed') + k(`${total ? Math.round(covered * 100 / total) : 0}%`, 'voters covered') +
    (hasNewLogic() ? k(casteSource() === 'new' ? 'New logic' : 'Old logic', 'caste data') : '');
}
function renderLegend() {
  const dot = c => `<svg width="12" height="12"><circle cx="6" cy="6" r="5" fill="${c}"/></svg>`;
  let items;
  if (S.mode === 'area') items = [...S.store.areas.map(a => [a.color, a.name]), [css('--none'), 'Not in an area']];
  else if (S.mode === 'block') items = BLOCKS.map(b => [b.color, b.en]);
  else if (S.mode === 'model') items = CAT.map(c => [c.color, `${c.label} (model)`]);
  else items = [...new Set(S.P.map(largest))].filter(n => n !== UNCLASSIFIED()).map(n => [casteColor(n), n]);
  $('#legend').innerHTML = items.map(([c, n]) => `<span class="k">${dot(c)}${esc(n)}</span>`).join('') +
    `<span class="k"><svg width="14" height="14"><circle cx="7" cy="7" r="6" fill="currentColor" fill-opacity=".9"/></svg>Exact spot</span>` +
    `<span class="k"><svg width="14" height="14"><circle cx="7" cy="7" r="6" fill="currentColor" fill-opacity=".4" stroke="currentColor" stroke-dasharray="2 1.6"/></svg>Post office area</span>` +
    `<span class="k"><svg width="14" height="14"><circle cx="7" cy="7" r="6" fill="gray"/><circle cx="7" cy="7" r="2.6" fill="white" stroke="black" stroke-width=".6"/></svg>Sah-sanyojak appointed</span>` +
    ((S.B.cities || []).length ? `<span class="k">◆ City · ● Town (km from ${esc(REGION.name || 'the seat')})</span>` : '');
}
function renderBlockbar() {
  const t = {};
  S.P.forEach(p => { t[p.block_hi] = (t[p.block_hi] || 0) + p.voters; });
  $('#blockbar').innerHTML = BLOCKS.map(b => `<button type="button" class="chip" data-b="${esc(b.hi)}" aria-pressed="${S.blocks.has(b.hi)}"><i style="background:var(${b.v})"></i>${esc(b.en)} <small>${fmt(t[b.hi] || 0)}</small></button>`).join('') +
    `<button type="button" class="chip" data-b="*"><small>All</small></button>`;
}

/* ---------- map ---------- */
function drawMap() {
  if (S.mode === 'model') runModel();
  SMap.render({
    colorOf, visible, layers: S.layers, focus: S.focus,
    isSel: p => S.sel.has(p.id), hasSah,
    areas: S.store.areas.map(a => ({ id: a.id, name: a.name, color: a.color, pids: a.panchayats.filter(id => S.byId.has(id)) }))
  });
  $('#mapcount').textContent = `${S.P.filter(visible).length} of ${S.P.length} shown`;
}
function renderSelbar() {
  const bar = $('#selbar');
  if (!S.selectMode || !S.sel.size) { bar.hidden = true; return; }
  const ps = [...S.sel].map(id => S.byId.get(id));
  const inArea = ps.filter(p => S.areaOf.has(p.id)).length;
  bar.hidden = false;
  bar.innerHTML = `<span><b>${ps.length}</b> selected · <b>${fmt(ps.reduce((s, p) => s + p.voters, 0))}</b> voters · <b>${ps.reduce((s, p) => s + p.booths, 0)}</b> booths</span>
    <button type="button" class="btn primary" data-sb="new">Create area from these</button>
    ${S.store.areas.length ? `<select data-sb="add" aria-label="Add to an existing area"><option value="">Add to area…</option>${S.store.areas.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select>` : ''}
    ${inArea ? `<button type="button" class="btn" data-sb="remove">Remove from areas (${inArea})</button>` : ''}
    <button type="button" class="btn" data-sb="clear">Clear</button>`;
}

/* ---------- inspector ---------- */
function overviewCard() {
  const areas = S.store.areas.map(a => {
    const st = areaStats(a);
    return `<div class="prow" data-act="showArea" data-id="${a.id}"><div><div class="pr1"><span class="sw" style="background:${a.color}"></span>${esc(a.name)}</div><div class="pr2 ${a.sanyojak?.name ? '' : 'miss'}">${a.sanyojak?.name ? esc(a.sanyojak.name) + ' · ' + esc(fmtPhone(a.sanyojak.phone)) : 'No sanyojak yet'}</div></div><div class="pv">${st.ps.length} pnch · ${st.sah}/${st.ps.length} sah</div></div>`;
  }).join('');
  const un = S.P.filter(p => !S.areaOf.has(p.id)).length;
  return `<div class="card"><h3>How this works</h3>
    <p style="margin:0 0 8px">1. Click <b>Select panchayats</b> and drag a box on the map around the panchayats of one area.</p>
    <p style="margin:0 0 8px">2. Click <b>Create area from these</b>, name it and enter the sanyojak's name and mobile number.</p>
    <p style="margin:0">3. Click any pin to add the <b>sah-sanyojak</b> for that panchayat and see all its booths.</p></div>
    <div class="card"><h3>Areas (${S.store.areas.length})</h3>${areas || '<div class="empty">No areas yet.</div>'}
    <div class="muted" style="margin-top:8px">${un} panchayat${un === 1 ? '' : 's'} not in any area</div>
    <div class="card-actions"><button type="button" class="btn primary" data-act="newArea">+ New area</button></div></div>`;
}
function selectionCard() {
  const ps = [...S.sel].map(id => S.byId.get(id)).sort((a, b) => a.en.localeCompare(b.en));
  return `<div class="card"><h3>Selection (${ps.length})</h3><div class="sel-list">${ps.map(p => `<span class="tag">${esc(p.en)}<button type="button" data-act="unsel" data-id="${esc(p.id)}" aria-label="Remove ${esc(p.en)}">×</button></span>`).join('')}</div></div>
    <div class="card"><h3>Tip</h3><div class="muted">Hold Shift while dragging to add more panchayats. Click a pin to add or remove just that one.</div></div>`;
}
function panchayatCard(p) {
  const area = S.areaOf.get(p.id), sah = sahOf(p.id) || { name: '', phone: '' };
  const tot = p.voters;
  const prec = { exact: ['exact', 'Exact spot'], town: ['town', 'City centre'], approx: ['approx', 'Approximate · post office area'] }[p.precision];
  const sany = area?.sanyojak || {};
  const areaBox = area ? `
    <div class="row" style="margin-bottom:6px"><span class="badge area" style="background:${area.color}">${esc(area.name)}</span><span class="muted">${areaStats(area).ps.length} panchayats · ${fmt(areaStats(area).voters)} voters</span></div>
    <div class="person"><span class="muted" style="font-size:12px">SANYOJAK</span>
      ${sany.name ? `<span class="pn">${esc(sany.name)}</span>` : '<span class="empty">Not entered</span>'}
      ${sany.phone ? `<span class="ph">${esc(fmtPhone(sany.phone))}</span>` : ''}</div>
    <div class="card-actions">${sany.phone ? `<button type="button" class="btn small" data-act="wa" data-phone="${sany.phone}">WhatsApp</button>` : ''}
      <button type="button" class="btn small" data-act="editArea" data-id="${area.id}">Edit area</button>
      <button type="button" class="btn small danger" data-act="leaveArea" data-id="${esc(p.id)}">Remove from area</button></div>`
    : `<div class="empty" style="margin-bottom:8px">Not in any area yet.</div>
      <div class="card-actions">${S.store.areas.length ? `<select data-act="joinArea" data-id="${esc(p.id)}" aria-label="Add to area"><option value="">Add to area…</option>${S.store.areas.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select>` : ''}
      <button type="button" class="btn small" data-act="newAreaWith" data-id="${esc(p.id)}">New area with this panchayat</button></div>`;
  const hint = phoneHint(sah.phone, 's:' + p.id);
  const top = p.castes.slice(0, 8), rest = p.castes.slice(8).reduce((s, c) => s + c.n, 0);
  const places = p.precision === 'town'
    ? (p.wards.length ? `<div class="muted" style="margin-top:8px"><b>Wards</b> (${p.wards.length}): ${p.wards.map(w => esc(w.en)).join(' · ')}</div>` : '')
    : `<div class="muted" style="margin-top:8px"><b>Villages</b>: ${p.villages.map(v => `${esc(v.en)} <span class="hi">${esc(v.hi)}</span>`).join(' · ')}</div>`;
  return `
    <div class="card"><div class="pname">${esc(p.en)}</div><div class="pname-hi">${esc(p.hi)}</div>
      <div style="margin-top:6px" class="row"><span class="badge ${prec[0]}">${prec[1]}</span></div>
      <dl class="kv"><dt>Block</dt><dd>${esc(p.block_en)}</dd>${p.tehsil_en ? `<dt>Tehsil</dt><dd>${esc(p.tehsil_en)}</dd>` : ''}
      <dt>Voters</dt><dd class="num">${fmt(tot)}</dd><dt>Booths</dt><dd class="num">${p.booths}</dd>
      <dt>Post office</dt><dd>${esc(p.post_en)}${p.pin ? ' · ' + esc(p.pin) : ''}</dd></dl></div>
    <div class="card"><h3>Area &amp; sanyojak</h3>${areaBox}</div>
    <div class="card"><h3>Sah-sanyojak of ${esc(p.en)}</h3>
      <div class="field"><label for="sh-name">Name</label><input id="sh-name" type="text" data-sah="name" data-pid="${esc(p.id)}" value="${esc(sah.name)}" maxlength="60" autocomplete="off"></div>
      <div class="field"><label for="sh-phone">Mobile number</label><input id="sh-phone" type="tel" inputmode="numeric" data-sah="phone" data-pid="${esc(p.id)}" value="${esc(fmtPhone(sah.phone))}" placeholder="98765 43210" class="${sah.phone && !validPhone(sah.phone) ? 'bad' : ''}"><div class="hint" id="sh-hint">${esc(hint)}</div></div>
      <div class="card-actions"><button type="button" class="btn small" data-act="wa" data-phone="${esc(sah.phone)}" ${validPhone(sah.phone) ? '' : 'disabled'} id="sh-wa">WhatsApp</button>
        <button type="button" class="btn small danger" data-act="clearSah" data-id="${esc(p.id)}">Clear</button></div></div>
    <div class="card"><h3>Caste groups</h3>
      <div class="bar">${p.castes.map(c => `<span style="width:${c.n * 100 / tot}%;background:${casteColor(c.en)}" title="${esc(c.en)}"></span>`).join('')}</div>
      <table class="mini" style="margin-top:8px">${top.map(c => `<tr><td><span class="sw" style="background:${casteColor(c.en)}"></span>${esc(c.en)}</td><td class="n">${fmt(c.n)}</td><td class="n">${(c.n * 100 / tot).toFixed(1)}%</td></tr>`).join('')}
      ${rest ? `<tr><td class="muted">${p.castes.length - 8} smaller groups</td><td class="n">${fmt(rest)}</td><td class="n">${(rest * 100 / tot).toFixed(1)}%</td></tr>` : ''}</table></div>
    <div class="card"><h3>All booths (${p.booth_list.length})</h3>
      ${p.booth_list.map(b => `<div class="booth"><span class="bn">#${b.no}</span><span>${esc(b.name_en)}<br><small class="hi">${esc(b.name_hi)}</small><br><small>${esc(b.ward_en || b.gram_en)}</small></span><span class="bv">${fmt(b.voters)}</span>
        <div class="bbar"><div class="bar" style="height:8px">${b.castes.map(c => `<span style="width:${c.n * 100 / b.voters}%;background:${casteColor(c.en)}" title="${esc(c.en)}"></span>`).join('')}</div>
        <small>${b.castes.slice(0, 3).map(c => `${esc(c.en)} ${(c.n * 100 / b.voters).toFixed(0)}%`).join(' · ')}</small></div></div>`).join('')}
      ${places}</div>`;
}
function renderInspector() {
  const el = $('#inspector');
  const keep = el.scrollTop;
  if (S.selectMode && S.sel.size) el.innerHTML = selectionCard();
  else if (S.focus) el.innerHTML = panchayatCard(S.focus);
  else el.innerHTML = overviewCard();
  el.scrollTop = keep;
}

/* ---------- areas page ---------- */
function renderAreas() {
  const v = $('#view-areas');
  const cards = S.store.areas.map(a => {
    const st = areaStats(a), san = a.sanyojak || {};
    return `<div class="acard" style="--c:${a.color}">
      <h3><span class="sw" style="background:${a.color};width:14px;height:14px;border-radius:50%"></span>${esc(a.name)}</h3>
      <div class="sub"><span><b>${st.ps.length}</b> panchayats</span><span><b>${fmt(st.voters)}</b> voters</span><span><b>${st.booths}</b> booths</span><span><b ${st.sah < st.ps.length ? 'style="color:var(--bad)"' : ''}>${st.sah}/${st.ps.length}</b> sah-sanyojaks</span></div>
      <div class="sany"><span class="muted" style="font-size:12px">SANYOJAK</span><br>${san.name ? `<b style="font-size:16px">${esc(san.name)}</b>` : '<span class="empty">Not entered</span>'}${san.phone ? ` &nbsp; <span class="num">${esc(fmtPhone(san.phone))}</span> <button type="button" class="btn small" data-act="wa" data-phone="${san.phone}">WhatsApp</button>` : ''}</div>
      ${st.ps.sort((x, y) => x.en.localeCompare(y.en)).map(p => { const r = sahOf(p.id); return `<div class="prow" data-act="openP" data-id="${esc(p.id)}"><div><div class="pr1">${esc(p.en)} <small class="hi muted">${esc(p.hi.replace(/ \(.*/, ''))}</small></div><div class="pr2 ${hasSah(p) ? '' : 'miss'}">${hasSah(p) ? 'Sah-sanyojak: ' + esc(r.name || '—') + (r.phone ? ' · ' + esc(fmtPhone(r.phone)) : '') : 'Sah-sanyojak not appointed'}</div></div><div class="pv">${fmt(p.voters)}<br>${p.booths} booths</div></div>`; }).join('')}
      <div class="card-actions"><button type="button" class="btn small" data-act="showArea" data-id="${a.id}">Show on map</button><button type="button" class="btn small" data-act="editArea" data-id="${a.id}">Edit</button><button type="button" class="btn small danger" data-act="delArea" data-id="${a.id}">Delete</button></div></div>`;
  }).join('');
  const un = S.P.filter(p => !S.areaOf.has(p.id));
  const unCard = un.length ? `<div class="acard" style="--c:var(--none)"><h3>Not in any area <span class="muted num" style="font-size:15px">${un.length}</span></h3>
    <div class="sub"><span><b>${fmt(un.reduce((s, p) => s + p.voters, 0))}</b> voters</span></div>
    ${BLOCKS.map(b => { const ps = un.filter(p => p.block_hi === b.hi); return ps.length ? `<div style="margin:6px 0"><b>${esc(b.en)}</b> <span class="muted">(${ps.length})</span><br><span class="muted">${ps.sort((x, y) => x.en.localeCompare(y.en)).map(p => esc(p.en)).join(' · ')}</span></div>` : ''; }).join('')}</div>` : '';
  v.innerHTML = `<div class="pagebar"><h2>Areas</h2><button type="button" class="btn primary" data-act="newArea">+ New area</button><span class="muted">Each area has one sanyojak; each panchayat in it has a sah-sanyojak.</span></div>
    <div class="areagrid">${cards}${unCard}${!cards && !unCard ? '<div class="empty">No areas yet.</div>' : ''}</div>`;
}

/* ---------- panchayat register page ---------- */
function regRows() {
  const f = S.reg;
  const cv = (p, c) => (p.castes.find(x => x.en === c)?.n || 0) / (f.pct ? p.voters : 1);
  const key = {
    en: p => p.en.toLowerCase(), block: p => p.block_en, area: p => (S.areaOf.get(p.id)?.name || 'zzz'),
    sany: p => (S.areaOf.get(p.id)?.sanyojak?.name || 'zzz').toLowerCase(), sah: p => (sahOf(p.id)?.name || 'zzz').toLowerCase(),
    voters: p => p.voters, booths: p => p.booths
  };
  const kf = f.sort.key.startsWith('c:') ? (p => cv(p, f.sort.key.slice(2))) : (key[f.sort.key] || key.voters);
  return S.P.filter(p => (f.block === 'all' || p.block_hi === f.block) && matches(p, f.q) &&
    (f.area === 'all' || (f.area === 'none' ? !S.areaOf.has(p.id) : S.areaOf.get(p.id)?.id === f.area)) &&
    (!f.missing || (S.areaOf.has(p.id) && !hasSah(p))))
    .sort((a, b) => { const x = kf(a), y = kf(b); return ((x < y ? -1 : x > y ? 1 : 0) * f.sort.dir) || b.voters - a.voters; });
}
function renderReg(full = true) {
  const v = $('#view-reg'), f = S.reg;
  if (full || !$('#regtable')) {
    v.innerHTML = `<div class="pagebar"><h2>Panchayats</h2>${casteSourceControl()}
      <input id="rq" type="search" placeholder="Search" value="${esc(f.q)}" style="width:220px">
      <select id="rb"><option value="all">All blocks</option>${BLOCKS.map(b => `<option value="${esc(b.hi)}" ${f.block === b.hi ? 'selected' : ''}>${esc(b.en)}</option>`).join('')}</select>
      <select id="ra"><option value="all">All areas</option><option value="none" ${f.area === 'none' ? 'selected' : ''}>Not in any area</option>${S.store.areas.map(a => `<option value="${a.id}" ${f.area === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select>
      <label class="row"><input type="checkbox" id="rm" ${f.missing ? 'checked' : ''}> Missing sah-sanyojak</label>
      <label class="row"><input type="checkbox" id="rc" ${f.caste ? 'checked' : ''}> Caste columns</label>
      <label class="row"><input type="checkbox" id="rp" ${f.pct ? 'checked' : ''}> Show as % of panchayat</label>
      <span class="muted" id="rcount"></span></div>
      <div class="tscroll"><table class="reg" id="regtable"></table></div>`;
  }
  const rows = regRows();
  $('#rcount').textContent = `${rows.length} of ${S.P.length}`;
  const th = (k, l, cls = '') => `<th data-k="${k}" class="${cls}" ${f.sort.key === k ? `aria-sort="${f.sort.dir > 0 ? 'ascending' : 'descending'}"` : ''}>${l}</th>`;
  const cs = f.caste ? REG_COLS : [];
  const nCols = 11 + cs.length + (f.caste ? 1 : 0);
  const show = (n, tot) => n ? (f.pct ? (n * 100 / tot).toFixed(1) + '%' : fmt(n)) : '<span class="muted">·</span>';
  const tint = (c, n, tot) => `style="background:${hexA(casteColor(c), Math.min(0.55, 0.9 * n / tot))}"`;
  $('#regtable').innerHTML = `<thead><tr><th style="width:24px"></th>${th('en', 'Panchayat')}${th('block', 'Block')}${th('area', 'Area')}${th('sany', 'Sanyojak')}<th>Sanyojak mobile</th>${th('sah', 'Sah-sanyojak')}<th>Sah-sanyojak mobile</th>${th('voters', 'Voters', 'r')}${th('booths', 'Booths', 'r')}${cs.map(c => th('c:' + c, `<span class="sw" style="background:${casteColor(c)}"></span>${esc(c)}`, 'r')).join('')}${f.caste ? '<th class="r">Other groups</th>' : ''}<th></th></tr></thead><tbody>${rows.map(p => {
    const a = S.areaOf.get(p.id), r = sahOf(p.id) || { name: '', phone: '' }, cm = Object.fromEntries(p.castes.map(c => [c.en, c.n]));
    const open = S.reg.open.has(p.id), oth = p.voters - cs.reduce((s2, c) => s2 + (cm[c] || 0), 0);
    const main = `<tr class="rrow" data-id="${esc(p.id)}"><td><button type="button" class="exp-btn" data-x="${esc(p.id)}" aria-expanded="${open}" aria-label="Show booths of ${esc(p.en)}" style="border:0;background:none;cursor:pointer">${open ? '▾' : '▸'}</button></td>
      <td class="pn"><i style="background:${a ? a.color : 'var(--none)'}"></i>${esc(p.en)}<small>${esc(p.hi.replace(/ \(.*/, ''))}</small></td><td>${esc(p.block_en)}</td>
      <td>${a ? `<span class="badge area" style="background:${a.color}">${esc(a.name)}</span>` : '<span class="muted">—</span>'}</td>
      <td>${a?.sanyojak?.name ? esc(a.sanyojak.name) : '<span class="muted">—</span>'}</td><td class="num">${a?.sanyojak?.phone ? esc(fmtPhone(a.sanyojak.phone)) : ''}</td>
      <td><input type="text" data-sah="name" data-pid="${esc(p.id)}" value="${esc(r.name)}" maxlength="60" aria-label="Sah-sanyojak name for ${esc(p.en)}" placeholder="${a ? 'Name' : ''}"></td>
      <td><input type="tel" class="ph ${r.phone && !validPhone(r.phone) ? 'bad' : ''}" data-sah="phone" data-pid="${esc(p.id)}" value="${esc(fmtPhone(r.phone))}" aria-label="Sah-sanyojak mobile for ${esc(p.en)}" title="${esc(phoneHint(r.phone, 's:' + p.id))}"></td>
      <td class="r num">${fmt(p.voters)}</td><td class="r num">${p.booths}</td>${cs.map(c => `<td class="r num" ${tint(c, cm[c] || 0, p.voters)}>${show(cm[c] || 0, p.voters)}</td>`).join('')}${f.caste ? `<td class="r num">${show(oth, p.voters)}</td>` : ''}
      <td><button type="button" class="btn small" data-act="openP" data-id="${esc(p.id)}">Map</button></td></tr>`;
    if (!open) return main;
    const bl = p.booth_list.map(b => `<tr><td class="n">${b.no}</td><td>${esc(b.name_en)}<div class="muted hi">${esc(b.name_hi)}</div></td><td>${esc(b.ward_en || b.gram_en)}</td><td class="n">${fmt(b.voters)}</td>
      <td><div class="bar" style="height:10px;min-width:150px">${b.castes.map(c => `<span style="width:${c.n * 100 / b.voters}%;background:${casteColor(c.en)}" title="${esc(c.en)}"></span>`).join('')}</div></td><td>${b.castes.slice(0, 3).map(c => `${esc(c.en)} ${(c.n * 100 / b.voters).toFixed(0)}%`).join(' · ')}</td></tr>`).join('');
    return main + `<tr class="exp"><td colspan="${nCols}"><table class="booths"><thead><tr><th>Booth</th><th>Polling station</th><th>${p.precision === 'town' ? 'Ward' : 'Village'}</th><th>Voters</th><th>Caste mix</th><th>Largest groups</th></tr></thead><tbody>${bl}</tbody></table></td></tr>`;
  }).join('')}</tbody>`;
}

/* ---------- blocks page ---------- */
function renderBlocks() {
  const v = $('#view-blocks');
  v.innerHTML = `<div class="pagebar"><h2>Blocks</h2>${casteSourceControl()}<span class="muted">Voters and community groups for each block of ${esc(seatName() || 'the seat')}. Click a card to show only that block on the map.</span></div>
    <div class="blockgrid">${BLOCKS.map(b => {
    const ps = S.P.filter(p => p.block_hi === b.hi);
    const tot = ps.reduce((s2, p) => s2 + p.voters, 0);
    const cs = Object.entries(ps.flatMap(p => p.castes).reduce((m, c) => { m[c.en] = (m[c.en] || 0) + c.n; return m; }, {})).map(([en, n]) => ({ en, n })).sort((x, y) => y.n - x.n);
    const top = cs.slice(0, 8), rest = cs.slice(8).reduce((s2, c) => s2 + c.n, 0);
    const inArea = ps.filter(p => S.areaOf.has(p.id)).length, sah = ps.filter(hasSah).length;
    return `<div class="bcard" style="--c:var(${b.v})" data-b="${esc(b.hi)}" tabindex="0">
      <h3>${esc(b.en)}<small class="hi">${esc(b.hi.replace(/ \(.*/, ''))}</small></h3>
      <div class="bk"><div><b>${fmt(tot)}</b> <span>voters</span></div><div><b>${ps.length}</b> <span>${b.urban ? 'areas' : 'panchayats'}</span></div><div><b>${ps.reduce((s2, p) => s2 + p.booths, 0)}</b> <span>booths</span></div></div>
      <div class="bar">${cs.map(c => `<span style="width:${c.n * 100 / tot}%;background:${casteColor(c.en)}" title="${esc(c.en)}"></span>`).join('')}</div>
      <table class="mini" style="margin-top:8px">${top.map(c => `<tr><td><span class="sw" style="background:${casteColor(c.en)}"></span>${esc(c.en)}</td><td class="n">${fmt(c.n)}</td><td class="n">${(c.n * 100 / tot).toFixed(1)}%</td></tr>`).join('')}
      ${rest ? `<tr><td class="muted">${cs.length - 8} smaller groups</td><td class="n">${fmt(rest)}</td><td class="n">${(rest * 100 / tot).toFixed(1)}%</td></tr>` : ''}</table>
      <div class="muted" style="margin-top:8px">${inArea}/${ps.length} in an area · ${sah} sah-sanyojaks</div></div>`;
  }).join('')}</div>`;
}

/* ---------- export ---------- */
function buildSheets() {
  const ps = [...S.P].sort((a, b) => a.block_en.localeCompare(b.block_en) || a.en.localeCompare(b.en));
  const areas = S.store.areas.map(a => { const st = areaStats(a); return [a.name, a.sanyojak?.name || '', a.sanyojak?.phone || '', st.ps.length, st.voters, st.booths, st.sah, st.ps.map(p => p.en).join(', ')]; });
  const pRows = ps.map(p => { const a = S.areaOf.get(p.id), r = sahOf(p.id) || {}; return [a?.name || 'Not assigned', p.block_en, p.tehsil_en || '', p.en, p.hi, a?.sanyojak?.name || '', a?.sanyojak?.phone || '', r.name || '', r.phone || '', p.voters, p.booths, p.post_en, p.pin || '', p.villages.map(v => v.en).join(', ')]; });
  const bRows = [];
  ps.forEach(p => { const a = S.areaOf.get(p.id); p.booth_list.forEach(b => bRows.push([a?.name || 'Not assigned', p.block_en, p.en, b.no, b.name_en, b.name_hi, b.ward_en || b.gram_en, b.voters, b.castes.slice(0, 3).map(c => `${c.en} ${(c.n * 100 / b.voters).toFixed(0)}%`).join(', ')])); });
  const contacts = [];
  S.store.areas.forEach(a => { if (a.sanyojak?.name || a.sanyojak?.phone) contacts.push(['Sanyojak', a.sanyojak.name || '', a.sanyojak.phone || '', a.name, '', '']); });
  ps.forEach(p => { const r = sahOf(p.id); if (r) contacts.push(['Sah-sanyojak', r.name || '', r.phone || '', S.areaOf.get(p.id)?.name || '', p.en, p.block_en]); });
  const caste = ['Area', 'Block', 'Panchayat', 'Voters', ...REG_COLS];
  const cRows = ps.map(p => { const cm = Object.fromEntries(p.castes.map(c => [c.en, c.n])); return [S.areaOf.get(p.id)?.name || 'Not assigned', p.block_en, p.en, p.voters, ...REG_COLS.map(c => cm[c] || 0)]; });
  return [
    { name: 'Areas', widths: [14, 26, 14, 12, 10, 8, 14, 80], rows: [['Area', 'Sanyojak', 'Mobile', 'Panchayats', 'Voters', 'Booths', 'Sah-sanyojaks appointed', 'Panchayats in area'], ...areas] },
    { name: 'Panchayats', widths: [14, 14, 14, 22, 22, 24, 14, 24, 14, 9, 8, 16, 9, 60], rows: [['Area', 'Block', 'Tehsil', 'Panchayat', 'Panchayat (Hindi)', 'Sanyojak', 'Sanyojak mobile', 'Sah-sanyojak', 'Sah-sanyojak mobile', 'Voters', 'Booths', 'Post office', 'PIN', 'Villages'], ...pRows] },
    { name: 'Booths', widths: [14, 14, 22, 7, 40, 40, 22, 9, 50], rows: [['Area', 'Block', 'Panchayat', 'Booth', 'Polling station', 'Polling station (Hindi)', 'Village / ward', 'Voters', 'Largest caste groups'], ...bRows] },
    { name: 'Contacts', widths: [14, 26, 14, 14, 22, 14], rows: [['Role', 'Name', 'Mobile', 'Area', 'Panchayat', 'Block'], ...contacts] },
    { name: 'Caste by panchayat', widths: [14, 14, 22, 9, ...REG_COLS.map(() => 12)], rows: [caste, ...cRows] },
    boothPlanSheet()
  ];
}
async function exportExcel() {
  const path = await window.api.exportXlsx(buildSheets());
  if (path) toast('Saved ' + path);
}

/* ---------- refresh ---------- */
function refresh(o = {}) {
  renderKpis();
  if (S.tab === 'map') {
    renderBlockbar(); renderLegend(); drawMap(); renderSelbar();
    if (o.inspector !== false) renderInspector();
  } else if (S.tab === 'areas' && o.areas !== false) renderAreas();
  else if (S.tab === 'blocks') renderBlocks();
  else if (S.tab === 'strategy') renderStrategy();
  else if (S.tab === 'future') renderFuture();
  else if (S.tab === 'reg' && o.table !== false) renderReg(true);
  else if (S.tab === 'settings') renderSettings();
}
function setTab(t) {
  S.tab = t;
  $$('.tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === t));
  ['map', 'areas', 'blocks', 'reg', 'strategy', 'future', 'settings'].forEach(id => { $('#view-' + id).hidden = id !== t; });
  if (t === 'map') requestAnimationFrame(() => refresh());
  else if (t === 'areas') renderAreas();
  else if (t === 'blocks') renderBlocks();
  else if (t === 'strategy') renderStrategy();
  else if (t === 'future') renderFuture();
  else if (t === 'settings') renderSettings();
  else renderReg(true);
}
function openOnMap(p) {
  S.focus = p; S.selectMode = false; SMap.setSelectMode(false); $('#btnSelect').setAttribute('aria-pressed', 'false');
  S.blocks.add(p.block_hi);
  setTab('map');
  setTimeout(() => SMap.focusOn(p, 3.5), 60);
}

/* ---------- events ---------- */
function placeMenu(m) {
  m.style.left = ''; m.style.right = '';
  const r = m.getBoundingClientRect();
  if (r.left < 8) { m.style.left = '0'; m.style.right = 'auto'; }
  else if (r.right > window.innerWidth - 8) { m.style.right = '0'; m.style.left = 'auto'; }
}

function bindEvents() {
  $$('.tabs button').forEach(b => b.onclick = () => setTab(b.dataset.tab));

  const menu = $('#menu'), layersMenu = $('#layers');
  const closeMenus = () => { menu.hidden = true; layersMenu.hidden = true; $('#pmenu').hidden = true; $('#btnMenu').setAttribute('aria-expanded', 'false'); $('#btnLayers').setAttribute('aria-expanded', 'false'); };
  $('#btnMenu').onclick = e => { e.stopPropagation(); const open = menu.hidden; closeMenus(); menu.hidden = !open; if (open) placeMenu(menu); $('#btnMenu').setAttribute('aria-expanded', String(open)); };
  $('#btnLayers').onclick = e => { e.stopPropagation(); const open = layersMenu.hidden; closeMenus(); layersMenu.hidden = !open; if (open) placeMenu(layersMenu); $('#btnLayers').setAttribute('aria-expanded', String(open)); };
  document.addEventListener('click', e => { if (!e.target.closest('.menuwrap')) closeMenus(); });
  layersMenu.innerHTML = [['areas', 'Area outlines'], ['tehsil', 'Tehsil borders & names'], ['district', 'District borders & names'], ['cities', 'Nearby cities & towns'], ['rivers', 'Rivers'], ['roads', 'Main roads'], ['rail', 'Railway']]
    .map(([k, l]) => `<label><input type="checkbox" data-layer="${k}" checked> ${l}</label>`).join('');
  layersMenu.onchange = e => { const c = e.target.closest('[data-layer]'); if (c) { S.layers[c.dataset.layer] = c.checked; drawMap(); } };
  menu.onclick = async e => {
    const b = e.target.closest('[data-act]'); if (!b) return; closeMenus();
    try {
      if (b.dataset.act === 'saveBackup') { const p = await window.api.exportJson(S.store); if (p) toast('Backup saved to ' + p); }
      if (b.dataset.act === 'openFolder') window.api.openDataFolder();
      if (b.dataset.act === 'restore') {
        const st = await window.api.restoreStore(); if (!st) return;
        if (await ask('Restore backup?', `This replaces everything now in the app with the backup (${st.areas.length} areas). A copy of the current data is kept in the backups folder.`, 'Restore', true)) {
          S.store = st; S.focus = null; S.sel.clear(); commit({ full: true }); toast('Backup restored');
        }
      }
    } catch (err) { toast(err.message); }
  };
  $('#btnExport').onclick = () => exportExcel().catch(err => toast('Export failed: ' + err.message));
  $('#btnPrint').onclick = e => { e.stopPropagation(); const open = $('#pmenu').hidden; closeMenus(); $('#pmenu').hidden = !open; if (open) placeMenu($('#pmenu')); $('#btnPrint').setAttribute('aria-expanded', String(open)); };
  $('#pmenu').onclick = e => { const b = e.target.closest('[data-pact]'); if (!b) return; closeMenus(); if (b.dataset.pact === 'tab') printCurrentTab(); else printDialog(); };
  document.addEventListener('keydown', e => { if (e.ctrlKey && e.key.toLowerCase() === 'p') { e.preventDefault(); printDialog(); } });

  $('#colorby').onclick = e => { const b = e.target.closest('[data-mode]'); if (!b) return; S.mode = b.dataset.mode; $$('#colorby button').forEach(x => x.setAttribute('aria-pressed', x === b)); renderLegend(); drawMap(); };
  $('#btnSelect').onclick = () => {
    S.selectMode = !S.selectMode; SMap.setSelectMode(S.selectMode);
    $('#btnSelect').setAttribute('aria-pressed', String(S.selectMode));
    if (S.selectMode) S.focus = null; else S.sel.clear();
    refresh();
  };
  $('#fShow').onchange = e => { S.show = e.target.value; drawMap(); };
  $('#qMap').oninput = e => { S.q = e.target.value.trim(); drawMap(); };
  $('#zin').onclick = () => SMap.zoomBy(1.6);
  $('#zout').onclick = () => SMap.zoomBy(1 / 1.6);
  $('#zreset').onclick = () => SMap.reset();
  $('#zwide').onclick = () => SMap.wide();
  $('#blockbar').onclick = e => {
    const b = e.target.closest('[data-b]'); if (!b) return;
    if (b.dataset.b === '*') S.blocks = new Set(BLOCKS.map(x => x.hi));
    else if (S.blocks.has(b.dataset.b) && S.blocks.size > 1) S.blocks.delete(b.dataset.b); else S.blocks.add(b.dataset.b);
    renderBlockbar(); drawMap();
  };
  $('#map').addEventListener('click', e => { if (e.target.closest('.pt')) return; if (!S.selectMode && S.focus) { S.focus = null; refresh(); } });

  $('#selbar').addEventListener('click', e => {
    const b = e.target.closest('[data-sb]'); if (!b || b.tagName === 'SELECT') return;
    const a = b.dataset.sb;
    if (a === 'new') areaDialog(null, [...S.sel]);
    if (a === 'clear') { S.sel.clear(); refresh(); }
    if (a === 'remove') { removeFromAreas([...S.sel]); commit(); toast('Removed from their areas'); }
  });
  $('#selbar').addEventListener('change', e => {
    const s = e.target.closest('select[data-sb="add"]'); if (!s || !s.value) return;
    const area = S.store.areas.find(x => x.id === s.value);
    removeFromAreas([...S.sel]); area.panchayats.push(...S.sel);
    toast(`${S.sel.size} panchayats added to ${area.name}`); S.sel.clear(); commit();
  });

  document.addEventListener('click', async e => {
    const el = e.target.closest('[data-act]'); if (!el || el.tagName === 'SELECT' || el.closest('#menu')) return;
    const id = el.dataset.id, act = el.dataset.act;
    if (act === 'newArea') areaDialog(null, []);
    else if (act === 'newAreaWith') areaDialog(null, [id]);
    else if (act === 'editArea') areaDialog(S.store.areas.find(a => a.id === id));
    else if (act === 'showArea') { const a = S.store.areas.find(x => x.id === id); S.focus = null; S.blocks = new Set(BLOCKS.map(b => b.hi)); setTab('map'); setTimeout(() => SMap.fitTo(a.panchayats.map(i => S.byId.get(i)).filter(Boolean)), 60); }
    else if (act === 'delArea') { const a = S.store.areas.find(x => x.id === id); if (await ask(`Delete ${a.name}?`, `The ${a.panchayats.length} panchayats in it become unassigned. Sah-sanyojak details are kept. The sanyojak's details for this area will be removed.`, 'Delete area', true)) { S.store.areas = S.store.areas.filter(x => x !== a); commit(); toast(a.name + ' deleted'); } }
    else if (act === 'leaveArea') { removeFromAreas([id]); commit(); }
    else if (act === 'openP') openOnMap(S.byId.get(id));
    else if (act === 'unsel') { S.sel.delete(id); refresh(); }
    else if (act === 'clearSah') { delete S.store.sah[id]; commit(); }
    else if (act === 'wa') { if (!(await window.api.whatsapp(el.dataset.phone))) toast('Enter a valid 10-digit mobile number first'); }
  });
  document.addEventListener('change', e => {
    const cs = e.target.closest('select.csrc'); if (cs) { setCasteSource(cs.value); return; }
    const j = e.target.closest('select[data-act="joinArea"]');
    if (j && j.value) { const a = S.store.areas.find(x => x.id === j.value); removeFromAreas([j.dataset.id]); a.panchayats.push(j.dataset.id); commit(); toast(`Added to ${a.name}`); return; }
    const inp = e.target.closest('input[data-sah]'); if (!inp) return;
    const pid = inp.dataset.pid;
    if (inp.dataset.sah === 'name') setSah(pid, { name: inp.value.trim() });
    else {
      const d = normPhone(inp.value); inp.value = fmtPhone(d);
      setSah(pid, { phone: d });
      inp.classList.toggle('bad', !!d && !validPhone(d));
      if (inp.id === 'sh-phone') { $('#sh-hint').textContent = phoneHint(d, 's:' + pid); $('#sh-wa').disabled = !validPhone(d); $('#sh-wa').dataset.phone = d; }
      else inp.title = phoneHint(d, 's:' + pid);
    }
  });
  document.addEventListener('input', e => {
    const inp = e.target.closest('input[data-sah="phone"]'); if (!inp) return;
    const d = normPhone(inp.value);
    inp.classList.toggle('bad', !!d && d.length >= 10 && !validPhone(d));
    if (inp.id === 'sh-phone') $('#sh-hint').textContent = phoneHint(d, 's:' + inp.dataset.pid);
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#dlg').open && !$('#pmenu').hidden + !$('#menu').hidden + !$('#layers').hidden) { closeMenus(); return; } if (e.key === 'Escape' && !$('#dlg').open) { if (S.sel.size) { S.sel.clear(); refresh(); } else if (S.focus) { S.focus = null; refresh(); } } });

  $('#view-blocks').addEventListener('click', e => {
    const c = e.target.closest('.bcard'); if (!c) return;
    S.blocks = new Set([c.dataset.b]); S.focus = null; setTab('map');
    setTimeout(() => SMap.fitTo(S.P.filter(p => p.block_hi === c.dataset.b)), 60);
  });
  const v = $('#view-reg');
  v.addEventListener('input', e => { if (e.target.id === 'rq') { S.reg.q = e.target.value.trim(); renderReg(false); } });
  v.addEventListener('change', e => {
    if (e.target.id === 'rb') { S.reg.block = e.target.value; S.reg.sort = S.reg.block === 'all' ? { key: 'voters', dir: -1 } : { key: 'en', dir: 1 }; } // one block → A–Z by name
    else if (e.target.id === 'ra') S.reg.area = e.target.value;
    else if (e.target.id === 'rm') S.reg.missing = e.target.checked; else if (e.target.id === 'rc') S.reg.caste = e.target.checked; else if (e.target.id === 'rp') S.reg.pct = e.target.checked; else return;
    renderReg(false);
  });
  v.addEventListener('click', e => {
    const x = e.target.closest('.exp-btn');
    if (x) { const id = x.dataset.x; S.reg.open.has(id) ? S.reg.open.delete(id) : S.reg.open.add(id); renderReg(false); return; }
    const row = e.target.closest('tr.rrow');
    if (row && !e.target.closest('input,button,select')) { openOnMap(S.byId.get(row.dataset.id)); return; }
    const h = e.target.closest('th[data-k]'); if (!h) return;
    const k = h.dataset.k; S.reg.sort = { key: k, dir: S.reg.sort.key === k ? -S.reg.sort.dir : (['en', 'block', 'area', 'sany', 'sah'].includes(k) ? 1 : -1) };
    renderReg(false);
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => refresh());
}

/* ---------- boot ---------- */
(async function boot() {
  const [{ panchayats, basemap, history, region, regions, regionDir }, store] = await Promise.all([window.api.loadData(), window.api.loadStore()]);
  S.P = panchayats; S.B = basemap || {}; S.store = store; S.history = history || {};
  S.regions = regions || []; S.regionDir = regionDir || '';
  if (region && region.id) S.store.region = region.id;
  S.P.forEach(p => { p.id = p.id || p.block_hi + '|' + p.hi; S.byId.set(p.id, p); }); // id kept from the original spelling so saved areas stay linked
  applyRegion(region);
  applyCasteSource();
  S.store.areas.forEach(a => { a.panchayats = a.panchayats.filter(id => S.byId.has(id)); });
  rebuild();
  bindEvents();
  SMap.init($('#map'), S.B, S.P, {
    onPin: (p, e) => {
      if (S.selectMode) { S.sel.has(p.id) ? S.sel.delete(p.id) : S.sel.add(p.id); refresh(); }
      else { S.focus = p; refresh(); }
    },
    onBrush: (ids, additive) => {
      if (!additive) S.sel = new Set();
      ids.map(id => S.byId.get(id)).filter(visible).forEach(p => S.sel.add(p.id));
      refresh();
    }
  });
  if (!S.P.length) setTab('settings'); else refresh();
})();
