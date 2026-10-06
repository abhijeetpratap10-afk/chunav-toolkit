# -*- coding: utf-8 -*-
"""Add a community column to a voter Excel, using an editable rules file.

    python classify.py voters.xlsx --rules rules/up.json -o voters_classified.xlsx

Two columns are written:
  Community            from surnames only (rules file)          -> "old logic" in the app
  Community (est.)     surnames + first-name statistics + households for voters the
                       surname rules could not place             -> "new logic" in the app

The estimate is a statistical guess for planning totals; it is not a fact about any
single voter. Never publish or share voter-level community data.

Input: the Excel written by ocr/roll2excel.py (sheet "Voters"), or any Excel/CSV with
columns for the voter's name and the relative's name (pick them with --name-col/--rel-col).
"""
import argparse
import csv
import json
import math
import os
import re
import sys
from collections import Counter, defaultdict

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

ZW = re.compile('[​‌‍‎‏﻿]')
PUNCT = re.compile(r'[,;:()\[\]{}"“”‘’|_=]+')


def words(s):
    s = PUNCT.sub(' ', ZW.sub('', str(s or '')))
    return [w.strip('.').lower() if w.isascii() else w.strip('.') for w in s.split() if w.strip('.')] or []


class Rules:
    def __init__(self, path):
        r = json.load(open(path, encoding='utf-8'))
        self.raw = r
        self.groups = r['groups']
        self.by_id = {g['id']: g for g in self.groups}
        self.unclassified = r['unclassified']
        low = lambda ws: {w.lower() if w.isascii() else w for w in ws}
        self.sets = [(g['id'], low(g['words'])) for g in self.groups if g['words']]
        self.generic = low(r.get('generic_words', []))
        self.prefix = [(p['group'], low(p['words'])) for p in r.get('prefix_rules', [])]
        self.any_first = r.get('first_group_any_word')
        self.any_set = dict(self.sets).get(self.any_first, set())
        smin = r.get('substring_min_length', 4)
        self.cmin = r.get('compound_min_length', 8)
        self.subs = [(w, gid) for gid, ws in self.sets for w in ws if len(w) >= smin]
        self.last = [(x['group'], low(x['words'])) for x in r.get('last_resort', [])]
        rs = r.get('relative_surname_rule')
        self.relsur = (rs['group'], low(rs['words'])) if rs else None

    def label(self, gid):
        return (self.by_id.get(gid) or self.unclassified)['label']

    def classify(self, name, rel):
        nw, rw = words(name), words(rel)
        for gid, ws in self.prefix:
            if (nw and nw[0] in ws) or (rw and rw[0] in ws):
                return gid
        if self.any_first and (set(nw) | set(rw)) & self.any_set:
            return self.any_first
        for side in (set(nw), set(rw)):          # own name first, then the relative's
            for gid, ws in self.sets:
                if any(w not in self.generic and w in ws for w in side):
                    return gid
        for w in set(nw) | set(rw):              # caste word hidden inside a joined-up word
            if len(w) >= self.cmin:
                for kw, gid in self.subs:
                    if kw in w:
                        return gid
        for gid, ws in self.last:
            if (set(nw) | set(rw)) & ws:
                return gid
        if self.relsur and rw and rw[-1] in self.relsur[1]:
            return self.relsur[0]
        return None


# ---------- statistical estimate for voters the rules could not place ----------

def features(name, rel, generic):
    nw, rw = words(name), words(rel)
    f = []
    if nw:
        f.append('n:' + nw[0])
    f += ['r:' + w for w in rw if w not in generic]
    return f


def estimate(rows, rules, min_prob=0.6):
    """Naive Bayes on first names and relatives' names, learned from voters the rules
    did classify, then a household vote for whatever is still unknown."""
    known = [(r['_f'], r['group']) for r in rows if r['group']]
    prior = Counter(g for _, g in known)
    feat = defaultdict(Counter)
    for fs, g in known:
        for x in fs:
            feat[g][x] += 1
    tot = {g: sum(c.values()) for g, c in feat.items()}
    vocab = len({x for c in feat.values() for x in c}) or 1
    n = sum(prior.values()) or 1
    for r in rows:
        r['est'], r['how'] = r['group'], 'surname' if r['group'] else ''
        if r['group'] or not r['_f'] or not prior:
            continue
        scores = {}
        for g in prior:
            s = math.log(prior[g] / n)
            for x in r['_f']:
                s += math.log((feat[g][x] + 0.5) / (tot[g] + 0.5 * vocab))
            scores[g] = s
        m = max(scores.values())
        z = sum(math.exp(v - m) for v in scores.values())
        g, p = max(((g, math.exp(v - m) / z) for g, v in scores.items()), key=lambda t: t[1])
        seen = any(feat[g2][x] for g2 in feat for x in r['_f'])
        if seen and p >= min_prob:
            r['est'], r['how'] = g, f'names {p:.0%}'
    house = defaultdict(Counter)
    for r in rows:
        if r['est'] and r.get('house'):
            house[(r['part'], r['house'])][r['est']] += 1
    for r in rows:
        if not r['est'] and r.get('house'):
            c = house.get((r['part'], r['house']))
            if c:
                g, k = c.most_common(1)[0]
                if k / sum(c.values()) >= 0.7:
                    r['est'], r['how'] = g, 'household'


# ---------- I/O ----------

def read_rows(path, name_col, rel_col):
    if path.lower().endswith('.csv'):
        with open(path, encoding='utf-8-sig') as f:
            rd = csv.reader(f)
            head = next(rd)
            data = list(rd)
    else:
        import openpyxl
        wb = openpyxl.load_workbook(path, read_only=True)
        ws = wb['Voters'] if 'Voters' in wb.sheetnames else wb.worksheets[0]
        it = ws.iter_rows(values_only=True)
        head = [str(h or '') for h in next(it)]
        data = [list(r) for r in it]
    def col(want, *alts):
        for c in (want, *alts):
            if c is None:
                continue
            if isinstance(c, int):
                return c
            for i, h in enumerate(head):
                if h.strip().lower() == str(c).strip().lower():
                    return i
        return None
    ix = {
        'name': col(name_col, 'Name', 'नाम'),
        'rel': col(rel_col, 'Relative Name', 'पिता/पति का नाम'),
        'part': col(None, 'Part No', 'भाग संख्या'),
        'house': col(None, 'House No', 'मकान संख्या'),
        'age': col(None, 'Age', 'आयु'),
        'gender': col(None, 'Gender', 'लिंग'),
    }
    if ix['name'] is None or ix['rel'] is None:
        sys.exit(f'Could not find the name columns in {path}. Columns are: {head}. Use --name-col / --rel-col.')
    return head, data, ix


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('input', help='voter Excel (from roll2excel.py) or CSV')
    ap.add_argument('--rules', required=True, help='rules JSON, e.g. rules/up.json')
    ap.add_argument('-o', '--out', help='output Excel (default: <input>_classified.xlsx)')
    ap.add_argument('--name-col', help='column name or 0-based number of the voter name')
    ap.add_argument('--rel-col', help='column name or 0-based number of the relative name')
    ap.add_argument('--min-prob', type=float, default=0.6, help='confidence needed for a name-based estimate (default 0.6)')
    a = ap.parse_args()
    to_ix = lambda v: int(v) if v and v.isdigit() else v

    rules = Rules(a.rules)
    head, data, ix = read_rows(a.input, to_ix(a.name_col), to_ix(a.rel_col))
    rows = []
    for d in data:
        g = lambda k: d[ix[k]] if ix[k] is not None and ix[k] < len(d) else None
        r = {'group': rules.classify(g('name'), g('rel')), 'part': g('part'), 'house': str(g('house') or '').strip()}
        r['_f'] = features(g('name'), g('rel'), rules.generic)
        rows.append(r)
    estimate(rows, rules, a.min_prob)

    out = a.out or os.path.splitext(a.input)[0] + '_classified.xlsx'
    write(out, head, data, rows, rules, ix)
    n = len(rows)
    c1 = Counter(r['group'] for r in rows)
    c2 = Counter(r['est'] for r in rows)
    print(f'{n} voters. Unclassified by surname: {c1[None]} ({c1[None] * 100 / max(1, n):.1f}%), after estimate: {c2[None]} ({c2[None] * 100 / max(1, n):.1f}%)')
    for gid, k in c2.most_common():
        print(f'  {rules.label(gid):<30} {k:>8}  {k * 100 / max(1, n):5.1f}%')
    print(f'Saved {out}')


def write(out, head, data, rows, rules, ix):
    import openpyxl
    from openpyxl.styles import Font, PatternFill
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = 'Voters'
    ws.append(list(head) + ['Community', 'Community (est.)', 'Estimated by'])
    for d, r in zip(data, rows):
        ws.append(list(d) + [rules.label(r['group']), rules.label(r['est']), r['how']])
    # summary by part
    sm = wb.create_sheet('Summary by part')
    labels = [g['label'] for g in rules.groups] + [rules.unclassified['label']]
    sm.append(['Part No', 'Voters', 'Women', 'Men', 'Age 18-25', 'Age 60+', 'Logic'] + labels)
    parts = defaultdict(list)
    for d, r in zip(data, rows):
        parts[r['part']].append((d, r))
    def num(v):
        try:
            return int(v)
        except (TypeError, ValueError):
            return None
    for p in sorted(parts, key=lambda v: (num(v) is None, num(v) or 0, str(v))):
        items = parts[p]
        gcol = lambda d: str(d[ix['gender']] or '') if ix['gender'] is not None else ''
        acol = lambda d: num(d[ix['age']]) if ix['age'] is not None else None
        women = sum(1 for d, _ in items if gcol(d)[:1] in ('F', 'म'))
        men = sum(1 for d, _ in items if gcol(d)[:1] in ('M', 'प'))
        young = sum(1 for d, _ in items if (acol(d) or 0) and 18 <= acol(d) <= 25)
        old = sum(1 for d, _ in items if (acol(d) or 0) >= 60)
        for key, lg in (('group', 'surname'), ('est', 'estimate')):
            c = Counter(rules.label(r[key]) for _, r in items)
            sm.append([p, len(items), women, men, young, old, lg] + [c.get(l, 0) for l in labels])
    for sh in (ws, sm):
        for c in sh[1]:
            c.font = Font(bold=True, color='FFFFFF')
            c.fill = PatternFill('solid', fgColor='2C3E50')
        sh.freeze_panes = 'A2'
    wb.save(out)


if __name__ == '__main__':
    main()
