/* Interactive map: basemap, borders, cities, area outlines, panchayat pins, box-select. */
(function () {
  const W = 1000, H = 760;
  const M = {};
  let svg, root, root2, brushG, brush, zoom, proj, path, home;
  let G = {};
  let B = {}, P = [], cb = {}, last = null;
  let k = 1, tr = d3.zoomIdentity, selectMode = false;
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  const line = c => path({ type: 'LineString', coordinates: c });

  M.init = function (svgEl, basemap, panchayats, callbacks) {
    B = basemap; P = panchayats; cb = callbacks;
    svg = d3.select(svgEl).attr('viewBox', `0 0 ${W} ${H}`).attr('preserveAspectRatio', 'xMidYMid meet');
    svg.selectAll('*').remove();

    const outline = { type: 'MultiLineString', coordinates: B.district || [] };
    const pts = { type: 'MultiPoint', coordinates: P.map(p => [p.lon, p.lat]) };
    proj = d3.geoMercator().fitExtent([[30, 26], [W - 20, H - 20]], { type: 'GeometryCollection', geometries: [outline, pts] });
    path = d3.geoPath(proj);
    P.forEach(p => { const [x, y] = proj([p.lon, p.lat]); p.x = x; p.y = y; });

    root = svg.append('g');
    brushG = svg.append('g').attr('class', 'brushg').style('display', 'none');
    root2 = svg.append('g');

    G.land = root.append('g');
    G.tehsil = root.append('g');
    G.district = root.append('g');
    G.grid = root.append('g');
    G.rivers = root.append('g');
    G.roads = root.append('g');
    G.rail = root.append('g');
    G.hulls = root.append('g');
    G.places = root.append('g');
    G.pins = root2.append('g');
    G.dots = root2.append('g').style('pointer-events', 'none');
    G.labels = root2.append('g').style('pointer-events', 'none');

    drawBasemap();
    drawPins();

    brush = d3.brush().extent([[0, 0], [W, H]]).on('end', e => {
      if (!e.selection) return;
      const [[x0, y0], [x1, y1]] = e.selection;
      const ax = (x0 - tr.x) / tr.k, bx = (x1 - tr.x) / tr.k, ay = (y0 - tr.y) / tr.k, by = (y1 - tr.y) / tr.k;
      const ids = P.filter(p => p.x >= ax && p.x <= bx && p.y >= ay && p.y <= by).map(p => p.id);
      brushG.call(brush.move, null);
      cb.onBrush && cb.onBrush(ids, !!(e.sourceEvent && (e.sourceEvent.shiftKey || e.sourceEvent.ctrlKey)));
    });
    brushG.call(brush);

    zoom = d3.zoom().scaleExtent([0.3, 18]).translateExtent([[-W * 1.6, -H * 1.6], [W * 2.6, H * 2.6]])
      .filter(e => (!e.ctrlKey || e.type === 'wheel') && !e.button && (!selectMode || e.type === 'wheel'))
      .on('zoom', e => {
        tr = e.transform; k = tr.k;
        root.attr('transform', tr); root2.attr('transform', tr);
        M.render();
      });
    svg.call(zoom).on('dblclick.zoom', null);

    const xs = P.map(p => p.x), ys = P.map(p => p.y);
    const bx0 = d3.min(xs) - 70, bx1 = d3.max(xs) + 70, by0 = d3.min(ys) - 70, by1 = d3.max(ys) + 70;
    const k0 = Math.max(1, Math.min(W / (bx1 - bx0), H / (by1 - by0), 4));
    home = d3.zoomIdentity.translate(W / 2 - k0 * (bx0 + bx1) / 2, H / 2 - k0 * (by0 + by1) / 2).scale(k0);
    svg.call(zoom.transform, home);
  };

  function drawBasemap() {
    const ringsPath = (B.rings || []).map(r => line(r)).join('');
    G.land.append('path').attr('class', 'land').attr('d', (B.rings || []).length
      ? path({ type: 'MultiPolygon', coordinates: B.rings.map(r => [r]) }) : '');

    G.tehsil.selectAll('path.teh').data(B.tehsils || []).join('path')
      .attr('class', d => 'teh' + (d.home ? ' home' : ''))
      .attr('d', d => d.ways.map(w => line(w)).join(''));
    G.district.selectAll('path.dist').data(B.districts || []).join('path')
      .attr('class', d => 'dist' + (d.home ? ' home' : ''))
      .attr('d', d => d.ways.map(w => line(w)).join(''));

    G.rivers.selectAll('path').data(B.rivers || []).join('path').attr('class', 'river').attr('d', d => line(d.c));
    G.roads.selectAll('path').data(B.roads || []).join('path').attr('class', d => 'road ' + d.k).attr('d', d => line(d.c));
    G.rail.selectAll('path.b').data(B.rail || []).join('path').attr('class', 'rail-base b').attr('d', line);
    G.rail.selectAll('path.t').data(B.rail || []).join('path').attr('class', 'rail-ties t').attr('d', line);

    const [[lon0, lat1], [lon1, lat0]] = [proj.invert([-W * 1.6, -H * 1.6]), proj.invert([W * 2.6, H * 2.6])];
    const dm = v => { const d = Math.floor(v), m = Math.round((v - d) * 60); return `${d}°${String(m).padStart(2, '0')}′`; };
    for (let lat = Math.ceil(lat0 * 5) / 5; lat <= lat1; lat = +(lat + 0.2).toFixed(1)) {
      G.grid.append('path').attr('class', 'grid-line').attr('d', line([[lon0, lat], [lon1, lat]]));
      G.grid.append('text').attr('class', 'grid-label').attr('data-lat', lat).attr('x', 0).attr('y', proj([lon0, lat])[1]).text(dm(lat) + 'N');
    }
    for (let lon = Math.ceil(lon0 * 5) / 5; lon <= lon1; lon = +(lon + 0.2).toFixed(1)) {
      G.grid.append('path').attr('class', 'grid-line').attr('d', line([[lon, lat0], [lon, lat1]]));
      G.grid.append('text').attr('class', 'grid-label').attr('data-lon', lon).attr('y', 0).attr('x', proj([lon, lat1])[0]).text(dm(lon) + 'E');
    }

    const cities = (B.cities || []).map(c => { const [x, y] = proj([c.lon, c.lat]); return { ...c, x, y }; });
    G.places.selectAll('g.city').data(cities).join('g').attr('class', d => 'city ' + d.p)
      .each(function (d) {
        const g = d3.select(this);
        g.append('path').attr('class', 'cmark')
          .attr('d', d.p === 'city' ? d3.symbol(d3.symbolDiamond, 90)() : d3.symbol(d3.symbolCircle, 34)())
          .attr('transform', `translate(${d.x},${d.y})`);
        g.append('text').attr('class', 'clabel').attr('x', d.x).attr('y', d.y)
          .text(d.n).append('tspan').attr('class', 'cdist').attr('x', d.x).attr('dy', '1.15em').text(`${d.km} km ${d.dir}`);
      });
    G.cities = cities;

    G.places.selectAll('text.dname').data((B.districts || []).filter(d => d.c)).join('text')
      .attr('class', d => 'dname' + (d.home ? ' home' : '')).attr('text-anchor', 'middle')
      .attr('x', d => labelPos(d)[0]).attr('y', d => labelPos(d)[1])
      .text(d => d.n.toUpperCase() + (d.home ? ' DISTRICT' : ''));
    G.places.selectAll('text.tname').data((B.tehsils || []).filter(d => d.c)).join('text')
      .attr('class', d => 'tname' + (d.home ? ' home' : '')).attr('text-anchor', 'middle')
      .attr('x', d => proj(d.c)[0]).attr('y', d => proj(d.c)[1])
      .text(d => d.n + ' tehsil');
  }

  function labelPos(d) {
    if (d.home && B.rings && B.rings.length) {
      const all = B.rings.flat();
      const lo = d3.extent(all, p => p[0]), la = d3.extent(all, p => p[1]);
      return proj([(lo[0] + lo[1]) / 2 + 0.12, la[0] + (la[1] - la[0]) * 0.1]);
    }
    return proj(d.c);
  }

  function drawPins() {
    G.pins.selectAll('circle').data([...P].sort((a, b) => b.voters - a.voters), d => d.id).join('circle')
      .attr('class', 'pt').attr('cx', d => d.x).attr('cy', d => d.y)
      .on('click', (e, d) => { e.stopPropagation(); cb.onPin && cb.onPin(d, e); })
      .on('mouseenter', function () { d3.select(this).raise(); })
      .append('title').text(d => `${d.en} · ${d.voters.toLocaleString('en-IN')} voters`);
    G.dots.selectAll('circle').data(P, d => d.id).join('circle').attr('class', 'dot').attr('cx', d => d.x).attr('cy', d => d.y);
    G.labels.selectAll('text').data([...P].sort((a, b) => b.voters - a.voters), d => d.id).join('text')
      .attr('class', 'pt-label').attr('x', d => d.x).attr('text-anchor', 'middle').text(d => d.en);
  }

  const maxV = () => d3.max(P.filter(p => p.precision !== 'town'), p => p.voters) || 1;
  M.radius = p => p.precision === 'town' ? 24 : d3.scaleSqrt().domain([0, maxV()]).range([3, 17])(p.voters);

  /* st: { colorOf, visible, isSel, focus, hasSah, areas:[{id,name,color,pids}], layers } */
  M.render = function (st) {
    if (st) last = st; else st = last;
    if (!st || !G.pins) return;
    const s = 1 / Math.sqrt(k);
    const L = st.layers || {};
    G.tehsil.style('display', L.tehsil === false ? 'none' : null);
    G.district.style('display', L.district === false ? 'none' : null);
    G.rivers.style('display', L.rivers === false ? 'none' : null);
    G.roads.style('display', L.roads === false ? 'none' : null);
    G.rail.style('display', L.rail === false ? 'none' : null);
    G.hulls.style('display', L.areas === false ? 'none' : null);

    const wide = k < 1;
    G.tehsil.selectAll('path').attr('stroke-width', (wide ? 0.9 : 1.1) / k);
    G.district.selectAll('path').attr('stroke-width', (wide ? 1.6 : 2) / k);
    G.rivers.selectAll('path').attr('stroke-width', (wide ? 1.3 : 2.2) / k);
    G.roads.selectAll('path').attr('stroke-width', function (d) { return (d.k === 'primary' ? (wide ? 0.6 : 1.2) : (wide ? 1.0 : 2.3)) / k; })
      .style('display', function (d) { return d.k === 'primary' && k < 0.8 ? 'none' : null; });
    G.rail.selectAll('path.b').attr('stroke-width', (wide ? 1.5 : 2.6) / k);
    G.rail.selectAll('path.t').attr('stroke-width', (wide ? 0.7 : 1.4) / k).attr('stroke-dasharray', `${5 / k} ${5 / k}`);
    G.land.select('path').attr('stroke-width', 1.8 / k).attr('stroke-dasharray', `${7 / k} ${3 / k} ${1.5 / k} ${3 / k}`);
    G.grid.selectAll('path').attr('stroke-width', 0.8 / k);
    const vis = [proj.invert([-tr.x / tr.k, -tr.y / tr.k]), proj.invert([(W - tr.x) / tr.k, (H - tr.y) / tr.k])];
    G.grid.selectAll('text[data-lat]').attr('font-size', 10 / k).attr('x', -tr.x / tr.k + 4 / k).attr('dy', -3 / k);
    G.grid.selectAll('text[data-lon]').attr('font-size', 10 / k).attr('y', -tr.y / tr.k + 12 / k).attr('dx', 3 / k);

    G.places.selectAll('text.dname').attr('font-size', 17 / k).style('display', L.district === false || k > 3 ? 'none' : null);
    G.places.selectAll('text.tname').attr('font-size', 11 / k).style('display', L.tehsil === false || k < 0.7 || k > 7 ? 'none' : null);

    const cityBoxes = [];
    G.places.selectAll('g.city').style('display', function (d) {
      if (L.cities === false) return 'none';
      if (d.p === 'town' && k > 1.7 && d.km > 35) return 'none';
      if (d.p === 'town' && k < 0.5) return 'none';
      const w = d.n.length * 6.5 / k, h = 24 / k;
      const bx = [d.x - w / 2, d.y - h * 0.5, d.x + w / 2, d.y + h];
      if (cityBoxes.some(b => bx[0] < b[2] && bx[2] > b[0] && bx[1] < b[3] && bx[3] > b[1])) return 'none';
      cityBoxes.push(bx);
      return null;
    });
    G.places.selectAll('.cmark').attr('transform', function () { const t = d3.select(this.parentNode).datum(); return `translate(${t.x},${t.y}) scale(${1 / k})`; });
    G.places.selectAll('.clabel').attr('font-size', 12 / k).attr('dy', `${-9 / k}`);
    G.places.selectAll('.cdist').attr('font-size', 10 / k);
    G.places.selectAll('.clabel').style('stroke-width', 3 / k);

    const pointOf = Object.fromEntries(P.map(p => [p.id, p]));
    const hulls = (st.areas || []).map(a => ({ a, pts: a.pids.map(id => pointOf[id]).filter(Boolean).map(p => [p.x, p.y]) })).filter(h => h.pts.length);
    const hsel = G.hulls.selectAll('g.hull').data(hulls, d => d.a.id).join(enter => {
      const g = enter.append('g').attr('class', 'hull');
      g.append('path').attr('class', 'hp');
      g.append('text').attr('class', 'hl').attr('text-anchor', 'middle');
      return g;
    });
    hsel.each(function (h) {
      const g = d3.select(this), pts = h.pts;
      let d;
      if (pts.length >= 3) { const hull = d3.polygonHull(pts); d = hull ? 'M' + hull.join('L') + 'Z' : 'M' + pts.join('L'); }
      else d = 'M' + pts.join('L') + (pts.length === 1 ? 'l0.01,0' : '');
      g.select('path').attr('d', d).attr('fill', h.a.color).attr('fill-opacity', 0.09)
        .attr('stroke', h.a.color).attr('stroke-opacity', 0.3).attr('stroke-width', 14 / Math.sqrt(k))
        .attr('stroke-linejoin', 'round').attr('stroke-linecap', 'round');
      const cx = d3.mean(pts, p => p[0]), cy = d3.min(pts, p => p[1]);
      g.select('text').attr('x', cx).attr('y', cy - 24 / Math.sqrt(k)).attr('fill', h.a.color).attr('font-size', 15 / k).text(h.a.name)
        .attr('stroke-width', 3.5 / k);
    });

    const circ = G.pins.selectAll('circle');
    circ.attr('r', d => M.radius(d) * s)
      .attr('fill', d => st.colorOf(d))
      .attr('fill-opacity', d => (d.precision === 'approx' ? 0.62 : 0.95))
      .attr('stroke-dasharray', d => d.precision === 'approx' ? `${2 / k} ${1.6 / k}` : null)
      .attr('stroke', d => st.isSel(d) ? css('--focus') : st.focus === d ? css('--ink') : css('--paper'))
      .attr('stroke-width', d => (st.isSel(d) ? 3.2 : st.focus === d ? 3 : 1.1) / k)
      .classed('dim', d => !st.visible(d));
    G.dots.selectAll('circle').attr('r', 2.4 * s).style('display', d => st.hasSah(d) && st.visible(d) ? null : 'none');

    const cap = k < 1.8 ? 16 : k < 3 ? 45 : k < 5 ? 95 : 999;
    const shown = new Set(), boxes = [];
    const ranked = [...P].sort((a, b) => b.voters - a.voters);
    for (const d of ranked) {
      if (!st.visible(d)) continue;
      if (shown.size >= cap && d !== st.focus && !st.isSel(d)) continue;
      const w = d.en.length * 6.6 / k, h = 13 / k, cx = d.x, cy = d.y - M.radius(d) * s - 3 / k - h / 2;
      const bx = [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2];
      const force = d === st.focus;
      if (!force && boxes.some(b => bx[0] < b[2] && bx[2] > b[0] && bx[1] < b[3] && bx[3] > b[1])) continue;
      boxes.push(bx); shown.add(d.id);
    }
    G.labels.selectAll('text').classed('dim', d => !shown.has(d.id))
      .attr('font-size', 11.5 / k).attr('stroke-width', 3 / k).attr('y', d => d.y - M.radius(d) * s - 3 / k);
  };

  M.setSelectMode = on => {
    selectMode = on;
    brushG.style('display', on ? null : 'none');
    svg.style('cursor', on ? 'crosshair' : null);
  };
  M.zoomBy = f => svg.transition().duration(250).call(zoom.scaleBy, f);
  M.reset = () => svg.transition().duration(350).call(zoom.transform, home);
  M.focusOn = (p, minK = 4) => {
    const kk = Math.max(k, minK);
    svg.transition().duration(450).call(zoom.transform, d3.zoomIdentity.translate(W / 2 - p.x * kk, H / 2 - p.y * kk).scale(kk));
  };
  M.fitTo = list => {
    if (!list.length) return;
    const xs = list.map(p => p.x), ys = list.map(p => p.y);
    const x0 = d3.min(xs) - 60, x1 = d3.max(xs) + 60, y0 = d3.min(ys) - 60, y1 = d3.max(ys) + 60;
    const kk = Math.max(1, Math.min(W / (x1 - x0), H / (y1 - y0), 6));
    svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity.translate(W / 2 - kk * (x0 + x1) / 2, H / 2 - kk * (y0 + y1) / 2).scale(kk));
  };
  M.wide = () => {
    const all = (B.rings || []).flat();
    if (!all.length) return M.reset();
    const lo = d3.extent(all, p => p[0]), la = d3.extent(all, p => p[1]);
    const a = proj([lo[0] - 0.45, la[1] + 0.4]), b = proj([lo[1] + 0.45, la[0] - 0.4]);
    const kk = Math.min(W / (b[0] - a[0]), H / (b[1] - a[1]));
    svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity.translate(W / 2 - kk * (a[0] + b[0]) / 2, H / 2 - kk * (a[1] + b[1]) / 2).scale(kk));
  };
  M.zoomLevel = () => k;
  window.SMap = M;
})();
