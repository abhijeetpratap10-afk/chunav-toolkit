# -*- coding: utf-8 -*-
"""Build a region pack for the app from classified voters.

Step 1 (first run) writes a parts sheet for you to fill in:

    python build_region.py voters_classified.xlsx --rules rules/up.json --out ../app/regions/my-seat

  -> my-seat/parts.csv   one row per part (booth): fill in panchayat, block, polling
                         station and, if you can, latitude/longitude of the panchayat.

Step 2 (run again after filling parts.csv) writes the pack:

    my-seat/region.json      seat name, blocks, colours, community groups, vote-model settings
    my-seat/panchayats.json  panchayat -> booths -> voters, women/men, age bands, communities

Edit region.json afterwards to rename things, change colours or set the vote model.
Open the folder in the app with Settings -> Open region folder.
"""
import argparse
import csv
import json
import math
import os
import sys
from collections import Counter, defaultdict

import openpyxl

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

HERE = os.path.dirname(os.path.abspath(__file__))
BLOCK_COLORS = ['#2f6db5', '#4e8a3e', '#8a4fa3', '#b4572e', '#c0392b', '#00838f', '#9e7c0c', '#5d4037', '#ad1457', '#37474f']
PARTS_COLS = ['part_no', 'section', 'voters', 'polling_station', 'polling_station_en', 'panchayat', 'panchayat_en',
              'block', 'block_en', 'urban', 'lat', 'lon', 'pin']


def num(v):
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return None


def load_voters(path):
    wb = openpyxl.load_workbook(path, read_only=True)
    ws = wb['Voters']
    it = ws.iter_rows(values_only=True)
    head = [str(h or '') for h in next(it)]
    ix = {h: i for i, h in enumerate(head)}
    need = ['Part No', 'Community']
    miss = [n for n in need if n not in ix]
    if miss:
        sys.exit(f'{path} has no column {miss}. Run classify.py on the roll2excel.py output first.')
    get = lambda r, k: r[ix[k]] if k in ix and ix[k] < len(r) else None
    out = []
    for r in it:
        out.append({'part': num(get(r, 'Part No')), 'age': num(get(r, 'Age')), 'gender': str(get(r, 'Gender') or '')[:1],
                    'section': str(get(r, 'Section') or '').strip(), 'old': get(r, 'Community'),
                    'new': get(r, 'Community (est.)') or get(r, 'Community')})
    return out


def castes(counter):
    return [{'en': k, 'n': v} for k, v in counter.most_common() if v]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('voters', help='Excel from classify.py')
    ap.add_argument('--rules', required=True, help='the rules JSON used for classify.py (colours and blocs)')
    ap.add_argument('--out', required=True, help='region folder to write, e.g. ../app/regions/my-seat')
    ap.add_argument('--parts', help='parts CSV (default: <out>/parts.csv)')
    ap.add_argument('--name', help='seat name in English, e.g. "Sultanpur"')
    ap.add_argument('--local-name', help='seat name in the local language')
    ap.add_argument('--number', help='assembly constituency number')
    ap.add_argument('--state', help='state name (default: from the rules file)')
    a = ap.parse_args()

    rules = json.load(open(a.rules, encoding='utf-8'))
    voters = load_voters(a.voters)
    os.makedirs(a.out, exist_ok=True)
    parts_csv = a.parts or os.path.join(a.out, 'parts.csv')

    by_part = defaultdict(list)
    for v in voters:
        by_part[v['part']].append(v)
    if None in by_part:
        print(f'Note: {len(by_part[None])} voters have no part number and are skipped.')
        by_part.pop(None)

    if not os.path.exists(parts_csv):
        with open(parts_csv, 'w', newline='', encoding='utf-8-sig') as f:
            w = csv.writer(f)
            w.writerow(PARTS_COLS)
            for p in sorted(by_part):
                sec = Counter(v['section'] for v in by_part[p] if v['section']).most_common(1)
                w.writerow([p, sec[0][0] if sec else '', len(by_part[p])] + [''] * (len(PARTS_COLS) - 3))
        print(f'Wrote {parts_csv} with {len(by_part)} parts.\n'
              'Fill in panchayat, block (and lat/lon if you have them), then run this command again.')
        return

    with open(parts_csv, encoding='utf-8-sig') as f:
        rows = [r for r in csv.DictReader(f) if num(r.get('part_no')) is not None]
    info = {num(r['part_no']): r for r in rows}
    missing = [p for p in by_part if p not in info or not (info[p].get('panchayat') or '').strip()]
    if missing:
        print(f'Warning: {len(missing)} parts have no panchayat in {parts_csv}; they are grouped as "Unassigned".')

    blocks, panch = {}, {}
    for p, vs in sorted(by_part.items()):
        r = info.get(p, {})
        bl = (r.get('block') or '').strip() or 'Unassigned'
        bl_en = (r.get('block_en') or '').strip() or bl
        pn = (r.get('panchayat') or '').strip() or 'Unassigned'
        pn_en = (r.get('panchayat_en') or '').strip() or pn
        urban = str(r.get('urban') or '').strip().lower() in ('1', 'y', 'yes', 'true')
        if bl not in blocks:
            blocks[bl] = {'hi': bl, 'en': bl_en, 'color': BLOCK_COLORS[len(blocks) % len(BLOCK_COLORS)], 'urban': urban}
        key = (bl, pn)
        P = panch.setdefault(key, {'hi': pn, 'en': pn_en, 'block_hi': bl, 'block_en': bl_en, 'booth_list': [], 'sections': Counter(),
                                   'pts': [], 'pin': (r.get('pin') or '').strip(), 'urban': urban})
        lat, lon = r.get('lat'), r.get('lon')
        try:
            P['pts'].append((float(lat), float(lon)))
        except (TypeError, ValueError):
            pass
        women = sum(1 for v in vs if v['gender'] == 'F')
        men = sum(1 for v in vs if v['gender'] == 'M')
        ages = [v['age'] for v in vs if v['age']]
        for v in vs:
            if v['section']:
                P['sections'][v['section']] += 1
        P['booth_list'].append({
            'no': p, 'name_hi': (r.get('polling_station') or '').strip() or f'Part {p}',
            'name_en': (r.get('polling_station_en') or r.get('polling_station') or '').strip() or f'Part {p}',
            'gram_en': (r.get('section') or '').strip(), 'ward_en': '', 'voters': len(vs), 'women': women, 'men': men,
            'y1825': sum(1 for x in ages if 18 <= x <= 25), 'y1819': sum(1 for x in ages if 18 <= x <= 19),
            'old60': sum(1 for x in ages if x >= 60), 'pages': math.ceil(len(vs) / 30),
            'castes_old': castes(Counter(v['old'] for v in vs)), 'castes_new': castes(Counter(v['new'] for v in vs))})

    # place panchayats without coordinates on a ring around their block, so the map still works
    have = [pt for P in panch.values() for pt in P['pts']]
    c0 = (sum(p[0] for p in have) / len(have), sum(p[1] for p in have) / len(have)) if have else (23.0, 80.0)
    out = []
    bl_list = list(blocks)
    for i, ((bl, pn), P) in enumerate(sorted(panch.items())):
        if P['pts']:
            lat = sum(p[0] for p in P['pts']) / len(P['pts'])
            lon = sum(p[1] for p in P['pts']) / len(P['pts'])
            precision = 'approx'
        else:
            bi = bl_list.index(bl)
            ang = 2 * math.pi * bi / max(1, len(bl_list)) + (i % 12) * 0.12
            rad = 0.06 + 0.012 * (i // 12)
            lat, lon = c0[0] + rad * math.sin(ang), c0[1] + rad * math.cos(ang)
            precision = 'approx'
        old, new = Counter(), Counter()
        for b in P['booth_list']:
            for c in b['castes_old']:
                old[c['en']] += c['n']
            for c in b['castes_new']:
                new[c['en']] += c['n']
        out.append({'hi': P['hi'], 'en': P['en'], 'block_hi': bl, 'block_en': P['block_en'], 'tehsil_en': '',
                    'voters': sum(b['voters'] for b in P['booth_list']), 'booths': len(P['booth_list']),
                    'post_en': '', 'pin': P['pin'], 'precision': 'town' if P['urban'] else precision,
                    'located_by': 'parts.csv' if P['pts'] else 'placeholder position (add lat/lon in parts.csv)',
                    'lat': round(lat, 5), 'lon': round(lon, 5),
                    'villages': [{'hi': s, 'en': s, 'voters': n} for s, n in P['sections'].most_common()],
                    'wards': [], 'booth_list': sorted(P['booth_list'], key=lambda b: b['no']),
                    'castes_old': castes(old), 'castes_new': castes(new)})
    json.dump(out, open(os.path.join(a.out, 'panchayats.json'), 'w', encoding='utf-8'), ensure_ascii=False)

    reg_path = os.path.join(a.out, 'region.json')
    region = json.load(open(reg_path, encoding='utf-8')) if os.path.exists(reg_path) else {}
    region.setdefault('id', os.path.basename(os.path.normpath(a.out)))
    region.setdefault('name', a.name or region['id'])
    region.setdefault('local_name', a.local_name or region['name'])
    region.setdefault('number', a.number or '')
    region.setdefault('state', a.state or rules.get('state', ''))
    region['blocks'] = [{**b, **{k: v for k, v in old.items() if k in ('color', 'en', 'urban')}}
                        for b in blocks.values()
                        for old in [next((x for x in region.get('blocks', []) if x.get('hi') == b['hi']), {})]]
    region['castes'] = {
        'unclassified': rules['unclassified']['label'],
        'colors': {**{g['label']: g['color'] for g in rules['groups']}, rules['unclassified']['label']: rules['unclassified']['color']},
        'blocs': {g['label']: g.get('bloc', '') for g in rules['groups']},
        **{k: v for k, v in region.get('castes', {}).items() if k not in ('colors', 'blocs', 'unclassified')}}
    if 'model' not in region:
        blocs = []
        for g in rules['groups']:
            b = g.get('bloc') or g['label']
            if b not in blocs:
                blocs.append(b)
        region['model'] = {
            'party': 'Our party', 'support_source': 'Your own estimate - replace with survey or past-result numbers',
            'groups': [{'k': b, 'label': b, 'bloc': b, 'members': [g['label'] for g in rules['groups'] if (g.get('bloc') or g['label']) == b]} for b in blocs],
            'support': {b: 40 for b in blocs}, 'calibrate_to': None, 'turnout': 60, 'target': 45, 'poll_date': ''}
    json.dump(region, open(reg_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'Wrote {len(out)} panchayats, {sum(p["booths"] for p in out)} booths, {sum(p["voters"] for p in out)} voters to {a.out}')
    if not have:
        print('No coordinates in parts.csv: panchayats are placed on rings per block. Add lat/lon for a real map.')


if __name__ == '__main__':
    main()
