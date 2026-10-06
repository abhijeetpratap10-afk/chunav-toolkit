'use strict';
/* Settings tab: choose the region (state / seat), party name, block colours, community colours and model groups.
   Changes are saved with this region's data; "Save as region defaults" writes them into region.json. */

function communityTotals() {
  const t = {};
  S.P.forEach(p => p.castes.forEach(c => { t[c.en] = (t[c.en] || 0) + c.n; }));
  return Object.entries(t).sort((a, b) => b[1] - a[1]);
}

function renderSettings() {
  const v = $('#view-settings');
  const st = (S.store.settings = S.store.settings || {});
  const groups = typeof modelGroups === 'function' ? modelGroups() : [];
  const gof = typeof groupOf === 'function' ? groupOf() : {};
  const total = S.P.reduce((s2, p) => s2 + p.voters, 0);
  const builtins = S.regions || [];

  v.innerHTML = `<div class="pagebar"><h2>Settings</h2><span class="muted">Region, names, colours and community groups</span></div>

  <section class="card"><h3>Region (state and seat)</h3>
    ${S.P.length ? `<dl class="kv">
      <dt>Seat</dt><dd><b>${esc(seatName() || '—')}</b> ${REGION.local_name ? `<span class="hi">${esc(REGION.local_name)}</span>` : ''}</dd>
      <dt>State</dt><dd>${esc(REGION.state || '—')}</dd>
      <dt>Size</dt><dd>${fmt(S.P.length)} panchayats · ${fmt(S.P.reduce((s2, p) => s2 + p.booths, 0))} booths · ${fmt(total)} voters · ${BLOCKS.length} blocks</dd>
      <dt>Folder</dt><dd class="muted" style="word-break:break-all">${esc(S.regionDir)}</dd></dl>` : '<p>No region is loaded yet.</p>'}
    <div class="row" style="margin-top:10px;gap:8px">
      <button type="button" class="btn" id="seOpen">Open region folder…</button>
      ${S.regionDir ? '<button type="button" class="btn" id="seShow">Show files</button>' : ''}
      ${builtins.filter(r => r.dir !== S.regionDir).map(r => `<button type="button" class="btn" data-region="${esc(r.dir)}">Use ${esc([r.name, r.number].filter(Boolean).join(' '))}</button>`).join('')}
    </div>
    <p class="muted" style="margin:10px 0 0">Areas, sanyojaks and sah-sanyojaks are saved separately for every region, so switching does not mix them.
      To make a region for another seat or state: read the roll PDFs with <code>ocr/roll2excel.py</code>, add communities with
      <code>analysis/classify.py --rules rules/&lt;state&gt;.json</code>, then build the folder with <code>analysis/build_region.py</code>. See the README.</p>
  </section>

  <section class="card"><h3>Names</h3>
    <label class="row">Party / candidate shown in the Strategy tab <input type="text" id="seParty" value="${esc(st.party || '')}" placeholder="${esc((REGION.model || {}).party || 'our party')}" style="width:260px"></label>
  </section>

  <section class="card"><h3>Block colours</h3>
    <div class="row" style="gap:14px">${BLOCKS.map(b => `<label class="row"><input type="color" data-bcol="${esc(b.hi)}" value="${esc(b.color)}" aria-label="Colour of ${esc(b.en)}"> ${esc(b.en)}</label>`).join('') || '<span class="muted">No blocks</span>'}</div>
  </section>

  <section class="card"><h3>Communities</h3>
    <p class="muted" style="margin:0 0 8px">Colour on the map, and which vote-model group each community counts in (the groups and their default support are set in the Strategy tab and in region.json → model).
      To change how voters are recognised by surname, edit the rules file (analysis/rules/&lt;state&gt;.json) and run classify.py and build_region.py again.</p>
    <div class="tscroll" style="max-height:none"><table class="reg"><thead><tr><th>Community</th><th class="r">Voters</th><th class="r">Share</th><th>Colour</th><th>Model group</th></tr></thead><tbody>
    ${communityTotals().map(([c, n]) => `<tr><td>${esc(c)}</td><td class="r num">${fmt(n)}</td><td class="r num">${total ? (n * 100 / total).toFixed(1) : 0}%</td>
      <td><input type="color" data-ccol="${esc(c)}" value="${esc(/^#[0-9a-f]{6}$/i.test(casteColor(c)) ? casteColor(c) : '#7d8a74')}" aria-label="Colour of ${esc(c)}"></td>
      <td>${c === UNCLASSIFIED() ? '<span class="muted">booth average</span>' : `<select data-cgrp="${esc(c)}" aria-label="Model group of ${esc(c)}"><option value="">(not in model)</option>${groups.map(g => `<option value="${esc(g.k)}" ${gof[c] === g.k ? 'selected' : ''}>${esc(g.label)}</option>`).join('')}</select>`}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="row" style="margin-top:10px;gap:8px">
      <button type="button" class="btn" id="seReset">Reset colours and groups to region defaults</button>
      <button type="button" class="btn" id="seSave" title="Write these settings into region.json so they travel with the region folder">Save as region defaults</button>
    </div>
  </section>`;

  const changed = () => { applyRegion(REGION); MODEL = null; scheduleSave(); renderSettings(); };
  $('#seOpen').onclick = async () => { try { await window.api.openRegion(); } catch (e) { toast(e.message); } };
  if ($('#seShow')) $('#seShow').onclick = () => window.api.openRegionFolder();
  v.querySelectorAll('[data-region]').forEach(b => b.onclick = async () => { try { await window.api.useRegion(b.dataset.region); } catch (e) { toast(e.message); } });
  $('#seParty').onchange = e => { st.party = e.target.value.trim(); scheduleSave(); };
  v.querySelectorAll('[data-bcol]').forEach(i => i.onchange = () => { st.blockColors = { ...(st.blockColors || {}), [i.dataset.bcol]: i.value }; changed(); });
  v.querySelectorAll('[data-ccol]').forEach(i => i.onchange = () => { st.casteColors = { ...(st.casteColors || {}), [i.dataset.ccol]: i.value }; changed(); });
  v.querySelectorAll('[data-cgrp]').forEach(i => i.onchange = () => { st.casteGroup = { ...(st.casteGroup || {}), [i.dataset.cgrp]: i.value || null }; changed(); });
  $('#seReset').onclick = () => { delete st.casteColors; delete st.casteGroup; delete st.blockColors; changed(); toast('Back to the region defaults'); };
  $('#seSave').onclick = async () => {
    const r = JSON.parse(JSON.stringify(REGION));
    r.blocks = BLOCKS.map(({ hi, en, color, urban }) => ({ hi, en, color, ...(urban ? { urban } : {}) }));
    r.castes = { ...(r.castes || {}), colors: { ...CASTE_COL } };
    const gof2 = groupOf();
    r.model = { ...(r.model || {}), groups: modelGroups().map(g => ({ ...g, members: Object.keys(gof2).filter(c => gof2[c] === g.k) })) };
    if (st.party) r.model.party = st.party;
    try { await window.api.saveRegion(r); REGION = r; toast('Saved into region.json'); } catch (e) { toast(e.message); }
  };
}
