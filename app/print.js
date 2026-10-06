'use strict';
/* Printing: pick any sections, filter by block / area, then print or save as PDF. */

const PRINT_SECTIONS = [
  ['summary', 'Cover summary (totals and blocks)'],
  ['areas', 'Areas: sanyojak and sah-sanyojak names and numbers'],
  ['contacts', 'Contact list (every sanyojak and sah-sanyojak)'],
  ['register', 'Panchayat register'],
  ['cards', 'Panchayat cards with all booths'],
  ['booths', 'Booth list with caste mix'],
  ['blocks', 'Block caste summary'],
  ['strategy', 'Strategy report'],
  ['future', 'Future plan checklist'],
  ['map', 'Map (current view)']
];
const TAB_SECTIONS = { map: ['map', 'cards'], areas: ['areas'], blocks: ['blocks'], reg: ['register'], strategy: ['strategy'], future: ['future'] };

const PRINT_CSS = `
@page { size: A4; margin: 11mm; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font: 10.5px/1.4 "Segoe UI", "Nirmala UI", sans-serif; color: #111; margin: 0; }
h1 { font-size: 20px; margin: 0 0 2px; } h2 { font-size: 15px; margin: 0 0 8px; padding-bottom: 3px; border-bottom: 2px solid #222; }
h3 { font-size: 12px; margin: 8px 0 4px; text-transform: uppercase; letter-spacing: .04em; color: #333; }
section.ps { page-break-before: always; } section.ps.first { page-break-before: auto; }
table { border-collapse: collapse; width: 100%; margin: 4px 0 8px; } th, td { border: 1px solid #bbb; padding: 2px 4px; text-align: left; vertical-align: top; }
th { background: #e8e8e8; font-weight: 600; } tr { page-break-inside: avoid; } thead { display: table-header-group; }
.n, td.n, td.r, th.r, .num { text-align: right; font-variant-numeric: tabular-nums; } .muted { color: #555; } .hi { font-family: "Nirmala UI", sans-serif; }
.card, .pcard, .acard, .bcard, .ocard, .org, .catcard, .kcard, .hbox, .task { border: 1px solid #999; padding: 6px; margin: 4px 0; page-break-inside: avoid; border-radius: 4px; }
.bar { display: flex; height: 8px; border: 1px solid #ccc; } .bar span { display: block; height: 100%; }
.sw { display: inline-block; width: 8px; height: 8px; margin-right: 4px; vertical-align: 0; }
.badge { display: inline-block; padding: 0 6px; border-radius: 8px; color: #fff; font-size: 9.5px; background: #555; }
.kv { display: grid; grid-template-columns: auto 1fr; gap: 1px 10px; } .kv dt { color: #555; } .kv dd { margin: 0; }
.kgrid, .hgrid, .catrow, .orggrid, .ogrid, .fgrid, .grid2c { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.kcard b { font-size: 16px; display: block; } .findings { padding-left: 16px; margin: 0; } .findings li { margin-bottom: 3px; }
.cover { border: 2px solid #222; padding: 14px; margin-bottom: 10px; } .row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.tscroll { overflow: visible !important; max-height: none !important; border: 0; }
button, .btn, select, input[type="checkbox"], .exp-btn, .tnote:placeholder-shown { display: none !important; }
.val { font-weight: 600; } .tnote-text { color: #333; font-style: italic; margin-left: 18px; }
svg.pmap { width: 100%; height: auto; border: 1px solid #999; background: #f6f3ea; }
svg.pmap .land { fill: #ece6d3; stroke: #6f6650; } svg.pmap .teh { fill: none; stroke: #6f6650; stroke-opacity: .5; }
svg.pmap .dist { fill: none; stroke: #555; } svg.pmap .river { fill: none; stroke: #3f7fb5; } svg.pmap .road { fill: none; stroke: #b8442d; }
svg.pmap .rail-base { fill: none; stroke: #2b2b28; } svg.pmap .rail-ties { fill: none; stroke: #ece6d3; } svg.pmap .grid-line { fill: none; stroke: rgba(60,70,60,.16); }
svg.pmap .grid-label, svg.pmap .tname, svg.pmap .dname, svg.pmap .cdist { fill: #555; } svg.pmap .clabel, svg.pmap .pt-label { fill: #111; stroke: #f6f3ea; paint-order: stroke; }
svg.pmap .cmark { fill: #111; } svg.pmap .dot { fill: #fff; stroke: #000; } svg.pmap .pt-label.dim, svg.pmap .pt.dim { display: none; } svg.pmap .hl { paint-order: stroke; stroke: #fff; }
.legend { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 10px; } .legend .k { display: inline-flex; align-items: center; gap: 4px; }
`;

function pfilter(o) {
  return S.P.filter(p => (o.block === 'all' || p.block_hi === o.block) &&
    (o.area === 'all' || (o.area === 'none' ? !S.areaOf.has(p.id) : S.areaOf.get(p.id)?.id === o.area)));
}
const pbar = (castes, tot) => `<div class="bar">${castes.map(c => `<span style="width:${c.n * 100 / tot}%;background:${casteColor(c.en)}"></span>`).join('')}</div>`;
const pcaste = (castes, tot, k = 6) => castes.slice(0, k).map(c => `${esc(c.en)} ${(c.n * 100 / tot).toFixed(0)}%`).join(', ');
const today = () => new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
const filterNote = o => [o.block !== 'all' ? (blockOf[o.block]?.en || o.block) : 'All blocks', o.area === 'all' ? 'all areas' : o.area === 'none' ? 'panchayats not in any area' : (S.store.areas.find(a => a.id === o.area)?.name || '')].join(' · ');

function cloneView(renderFn, id) {
  renderFn();
  const src = document.getElementById(id);
  const box = src.cloneNode(true);
  box.querySelectorAll('select.csrc').forEach(x => (x.closest('label') || x).remove());
  box.querySelectorAll('input[type="number"], input[type="text"], input[type="date"], input[type="tel"], input[type="search"]').forEach(inp => {
    const span = document.createElement('span');
    span.className = inp.classList.contains('tnote') ? 'tnote-text' : 'val';
    span.textContent = inp.value + (inp.type === 'number' && inp.classList.contains('supin') ? '' : '');
    if (inp.classList.contains('tnote') && !inp.value) span.textContent = '';
    inp.replaceWith(span);
  });
  box.querySelectorAll('input[type="checkbox"]').forEach(c => { const s2 = document.createElement('span'); s2.textContent = c.checked ? '☑ ' : '☐ '; c.replaceWith(s2); });
  box.querySelectorAll('button, select, .csrc').forEach(b => b.remove());
  return box.innerHTML;
}

const SECTION_HTML = {
  summary(o, ps) {
    const v = ps.reduce((s2, p) => s2 + p.voters, 0), b = ps.reduce((s2, p) => s2 + p.booths, 0);
    const inA = ps.filter(p => S.areaOf.has(p.id)).length, sah = ps.filter(hasSah).length;
    return `<div class="cover"><h1>Sanyojak Map · ${esc(seatName())}</h1><div class="muted">${today()} · ${esc(filterNote(o))} · community data: ${!hasNewLogic() ? 'surname rules' : casteSource() === 'new' ? 'new logic estimates' : 'old surname-only logic'}</div>
      <div class="kgrid" style="margin-top:8px">${[[fmt(v), 'voters'], [ps.length, 'panchayats'], [b, 'booths'], [`${inA}/${ps.length}`, 'panchayats in areas'], [`${sah}/${ps.length}`, 'sah-sanyojaks'], [S.store.areas.length, 'areas']].map(([x, l]) => `<div class="kcard"><b>${x}</b>${l}</div>`).join('')}</div></div>
      <table><thead><tr><th>Block</th><th class="n">Voters</th><th class="n">Panchayats</th><th class="n">Booths</th><th>Largest groups</th></tr></thead><tbody>${BLOCKS.map(bk => {
      const bp = ps.filter(p => p.block_hi === bk.hi); if (!bp.length) return '';
      const t = bp.reduce((s2, p) => s2 + p.voters, 0);
      const cs = Object.entries(bp.flatMap(p => p.castes).reduce((m, c) => { m[c.en] = (m[c.en] || 0) + c.n; return m; }, {})).map(([en, n]) => ({ en, n })).sort((a, c) => c.n - a.n);
      return `<tr><td>${esc(bk.en)}</td><td class="n">${fmt(t)}</td><td class="n">${bp.length}</td><td class="n">${bp.reduce((s2, p) => s2 + p.booths, 0)}</td><td>${pcaste(cs, t, 5)}</td></tr>`;
    }).join('')}</tbody></table>`;
  },
  areas(o) {
    const areas = S.store.areas.filter(a => o.area === 'all' || a.id === o.area);
    if (!areas.length) return '<p class="muted">No areas created yet.</p>';
    return areas.map(a => {
      const st = areaStats(a), ps = st.ps.filter(p => o.block === 'all' || p.block_hi === o.block).sort((x, y) => x.en.localeCompare(y.en));
      return `<div class="acard"><h3 style="color:${a.color}">${esc(a.name)}</h3><div>Sanyojak: <b>${esc(a.sanyojak?.name || '—')}</b> ${a.sanyojak?.phone ? fmtPhone(a.sanyojak.phone) : ''} · ${st.ps.length} panchayats · ${fmt(st.voters)} voters · ${st.booths} booths</div>
        <table><thead><tr><th>Panchayat</th><th>Block</th><th>Sah-sanyojak</th><th>Mobile</th><th class="n">Voters</th><th class="n">Booths</th></tr></thead><tbody>${ps.map(p => { const r = sahOf(p.id) || {}; return `<tr><td>${esc(p.en)} <span class="hi muted">${esc(p.hi.replace(/ \(.*/, ''))}</span></td><td>${esc(p.block_en)}</td><td>${esc(r.name || '—')}</td><td>${r.phone ? fmtPhone(r.phone) : ''}</td><td class="n">${fmt(p.voters)}</td><td class="n">${p.booths}</td></tr>`; }).join('')}</tbody></table></div>`;
    }).join('');
  },
  contacts(o, ps) {
    const rows = [];
    S.store.areas.filter(a => o.area === 'all' || a.id === o.area).forEach(a => { if (a.sanyojak?.name || a.sanyojak?.phone) rows.push(['Sanyojak', a.sanyojak.name || '', a.sanyojak.phone || '', a.name, '', '']); });
    ps.forEach(p => { const r = sahOf(p.id); if (r) rows.push(['Sah-sanyojak', r.name || '', r.phone || '', S.areaOf.get(p.id)?.name || '', p.en, p.block_en]); });
    if (!rows.length) return '<p class="muted">No contacts entered yet.</p>';
    return `<table><thead><tr><th>Role</th><th>Name</th><th>Mobile</th><th>Area</th><th>Panchayat</th><th>Block</th></tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td>${i === 2 && c ? fmtPhone(c) : esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  },
  register(o, ps) {
    const cs = o.caste ? REG_COLS.slice(0, 8) : [];
    return `<table><thead><tr><th>Panchayat</th><th>Block</th><th>Area</th><th>Sanyojak</th><th>Sah-sanyojak</th><th>Mobile</th><th class="n">Voters</th><th class="n">Booths</th>${cs.map(c => `<th class="n">${esc(c)} %</th>`).join('')}</tr></thead><tbody>${[...ps].sort((a, b) => a.block_en.localeCompare(b.block_en) || a.en.localeCompare(b.en)).map(p => {
      const a = S.areaOf.get(p.id), r = sahOf(p.id) || {}, cm = Object.fromEntries(p.castes.map(c => [c.en, c.n]));
      return `<tr><td>${esc(p.en)} <span class="hi muted">${esc(p.hi.replace(/ \(.*/, ''))}</span></td><td>${esc(p.block_en)}</td><td>${a ? esc(a.name) : '—'}</td><td>${esc(a?.sanyojak?.name || '')}</td><td>${esc(r.name || '')}</td><td>${r.phone ? fmtPhone(r.phone) : ''}</td><td class="n">${fmt(p.voters)}</td><td class="n">${p.booths}</td>${cs.map(c => `<td class="n">${cm[c] ? (cm[c] * 100 / p.voters).toFixed(1) : ''}</td>`).join('')}</tr>`;
    }).join('')}</tbody></table>`;
  },
  cards(o, ps) {
    const list = o.cards === 'focus' ? (S.focus ? [S.focus] : []) : ps;
    if (!list.length) return '<p class="muted">No panchayat selected. Click a pin on the map first, or choose "all in the filter".</p>';
    return list.map(p => {
      const a = S.areaOf.get(p.id), r = sahOf(p.id) || {};
      return `<div class="pcard"><h3 style="text-transform:none;font-size:14px">${esc(p.en)} <span class="hi">${esc(p.hi)}</span> <span class="muted">· ${esc(p.block_en)}${p.tehsil_en ? ' · ' + esc(p.tehsil_en) + ' tehsil' : ''}</span></h3>
        <div class="grid2c"><div><b>Area:</b> ${a ? esc(a.name) : 'not in an area'}<br><b>Sanyojak:</b> ${esc(a?.sanyojak?.name || '—')} ${a?.sanyojak?.phone ? fmtPhone(a.sanyojak.phone) : ''}<br><b>Sah-sanyojak:</b> ${esc(r.name || '—')} ${r.phone ? fmtPhone(r.phone) : ''}</div>
        <div><b>Voters:</b> ${fmt(p.voters)} · <b>Booths:</b> ${p.booths} · <b>Post office:</b> ${esc(p.post_en)} ${esc(p.pin || '')}<br><b>Villages:</b> ${p.villages.map(v => esc(v.en)).join(', ')}</div></div>
        ${pbar(p.castes, p.voters)}<div class="muted" style="margin:2px 0 4px">${pcaste(p.castes, p.voters, 8)}</div>
        <table><thead><tr><th>Booth</th><th>Polling station</th><th>Village / ward</th><th class="n">Voters</th><th class="n">Women</th><th class="n">18-25</th><th>Caste mix</th></tr></thead><tbody>${p.booth_list.map(b => `<tr><td class="n">${b.no}</td><td>${esc(b.name_en)}<br><span class="hi muted">${esc(b.name_hi)}</span></td><td>${esc(b.ward_en || b.gram_en)}</td><td class="n">${fmt(b.voters)}</td><td class="n">${b.women != null ? fmt(b.women) : ''}</td><td class="n">${b.y1825 != null ? fmt(b.y1825) : ''}</td><td>${pcaste(b.castes, b.voters, 4)}</td></tr>`).join('')}</tbody></table></div>`;
    }).join('');
  },
  booths(o, ps) {
    const m = typeof runModel === 'function' ? runModel() : null;
    const share = new Map(m ? m.booths.map(r => [r.b.no, r]) : []);
    const rows = ps.flatMap(p => p.booth_list.map(b => ({ p, b }))).sort((x, y) => x.b.no - y.b.no);
    return `<table><thead><tr><th>Booth</th><th>Polling station</th><th>Panchayat</th><th>Block</th><th>Area</th><th class="n">Voters</th><th class="n">Pages</th><th>Model</th><th>Caste mix</th></tr></thead><tbody>${rows.map(({ p, b }) => { const r = share.get(b.no); return `<tr><td class="n">${b.no}</td><td>${esc(b.name_en)}</td><td>${esc(p.en)}</td><td>${esc(p.block_en)}</td><td>${esc(S.areaOf.get(p.id)?.name || '')}</td><td class="n">${fmt(b.voters)}</td><td class="n">${b.pages || ''}</td><td>${r ? `${r.cat.label} ${(r.share * 100).toFixed(0)}%` : ''}</td><td>${pcaste(b.castes, b.voters, 4)}</td></tr>`; }).join('')}</tbody></table>`;
  },
  blocks() { return cloneView(renderBlocks, 'view-blocks'); },
  strategy() { return cloneView(renderStrategy, 'view-strategy'); },
  future() { return cloneView(renderFuture, 'view-future'); },
  map() {
    const svg = document.getElementById('map').cloneNode(true);
    svg.removeAttribute('id');
    svg.setAttribute('class', 'pmap');
    svg.querySelectorAll('.brushg').forEach(g => g.remove());
    return svg.outerHTML + `<div class="legend" style="margin-top:4px">${document.getElementById('legend').innerHTML}</div>`;
  }
};

async function doPrint(sections, o, mode) {
  const ps = pfilter(o);
  const titles = Object.fromEntries(PRINT_SECTIONS);
  const body = sections.map((k, i) => `<section class="ps${i === 0 ? ' first' : ''}"><h2>${esc(titles[k])}</h2>${SECTION_HTML[k](o, ps)}</section>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Sanyojak Map print</title><style>${PRINT_CSS}</style></head><body>${body}</body></html>`;
  if (S.tab !== 'blocks' && S.tab !== 'strategy' && S.tab !== 'future') { /* views re-rendered off-screen are hidden */ }
  try {
    const r = await window.api.printDoc({ html, landscape: o.landscape, mode });
    if (r && r.path) toast('PDF saved: ' + r.path);
    else if (r && r.error) toast('Print failed: ' + r.error);
  } catch (e) { toast('Print failed: ' + e.message); }
}

function printDialog(preset) {
  const st = S.store.settings || {};
  const last = st.printSel || ['summary', 'areas', 'register'];
  const sel = new Set(preset || last);
  const body = `<p class="muted" style="margin:0 0 8px">Tick what you want, set the filter, then print or save a PDF.</p>
    <div class="grid2">${PRINT_SECTIONS.map(([k, l]) => `<label class="chk"><input type="checkbox" data-sec="${k}" ${sel.has(k) ? 'checked' : ''}> ${esc(l)}</label>`).join('')}</div>
    <div class="grid2" style="margin-top:12px">
      <div class="field"><label for="pr-block">Block</label><select id="pr-block"><option value="all">All blocks</option>${BLOCKS.map(b => `<option value="${esc(b.hi)}">${esc(b.en)}</option>`).join('')}</select></div>
      <div class="field"><label for="pr-area">Area</label><select id="pr-area"><option value="all">All areas</option><option value="none">Not in any area</option>${S.store.areas.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select></div>
      <div class="field"><label for="pr-cards">Panchayat cards for</label><select id="pr-cards"><option value="focus">The panchayat selected on the map${S.focus ? ` (${esc(S.focus.en)})` : ''}</option><option value="all">Every panchayat in the filter</option></select></div>
      <div class="field"><label for="pr-orient">Page</label><select id="pr-orient"><option value="portrait">A4 portrait</option><option value="landscape">A4 landscape</option></select></div>
      <label class="chk"><input type="checkbox" id="pr-caste" checked> Caste % columns in the register</label>
    </div>`;
  const collect = () => {
    const secs = PRINT_SECTIONS.map(s2 => s2[0]).filter(k => $(`#dlg [data-sec="${k}"]`).checked);
    const o = { block: $('#pr-block').value, area: $('#pr-area').value, cards: $('#pr-cards').value, landscape: $('#pr-orient').value === 'landscape', caste: $('#pr-caste').checked };
    if (!secs.length) { toast('Tick at least one section'); return null; }
    S.store.settings = S.store.settings || {}; S.store.settings.printSel = secs; scheduleSave();
    return { secs, o };
  };
  modal('Print', body, [
    { label: 'Cancel' },
    { label: 'Save as PDF…', onClick: () => { const c = collect(); if (!c) return false; setTimeout(() => doPrint(c.secs, c.o, 'pdf'), 50); } },
    { label: 'Print…', cls: 'primary', onClick: () => { const c = collect(); if (!c) return false; setTimeout(() => doPrint(c.secs, c.o, 'print'), 50); } }
  ], d => {
    if (S.focus) $('#pr-cards', d).value = 'focus';
    else $('#pr-cards', d).value = 'all';
  });
}

function printCurrentTab() {
  const secs = TAB_SECTIONS[S.tab] || ['summary'];
  const o = { block: 'all', area: 'all', cards: S.focus ? 'focus' : 'all', landscape: S.tab === 'map' || S.tab === 'reg', caste: true };
  if (S.tab === 'map' && !S.focus) secs.splice(secs.indexOf('cards'), 1);
  doPrint(secs, o, 'print');
}
