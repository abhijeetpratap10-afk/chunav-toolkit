# -*- coding: utf-8 -*-
"""Make the made-up "Demo Nagar" seat and run it through the real pipeline.

    python samples/make_demo.py

Every name, place, number and coordinate here is invented. The script writes:
    samples/demo_voters.xlsx          a fake roll in the same format as ocr/roll2excel.py output
    app/regions/demo/                 the region pack the app opens on first start
"""
import csv
import json
import math
import os
import random
import subprocess
import sys

import openpyxl

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, 'app', 'regions', 'demo')
rnd = random.Random(2026)

FIRST_M = ['राम', 'श्याम', 'मोहन', 'सुरेश', 'रमेश', 'दिनेश', 'अजय', 'विजय', 'राजेश', 'संजय', 'अनिल', 'सुनील', 'राकेश', 'मुकेश', 'पवन', 'अमित', 'रवि', 'सोनू', 'मोनू', 'दीपक', 'गोविंद', 'हरि', 'शिव', 'प्रदीप', 'कमलेश']
FIRST_F = ['सीता', 'गीता', 'सुनीता', 'अनीता', 'ममता', 'रेखा', 'पूजा', 'नीलम', 'कुसुम', 'सरोज', 'कमला', 'उर्मिला', 'प्रियंका', 'रीता', 'माया', 'लक्ष्मी', 'सावित्री', 'शांति', 'आरती', 'किरन']
MUS_M = ['मोहम्मद', 'अब्दुल', 'इरफान', 'सलीम', 'शकील', 'जावेद', 'आरिफ', 'रईस', 'नसीम', 'इमरान']
MUS_F = ['शबाना', 'रुखसाना', 'नसरीन', 'फातिमा', 'सलमा', 'रेशमा', 'जरीना', 'शाहीन', 'नाजिया', 'आयशा']
# (surname, weight) - mixes of identifiable and generic surnames, like a real roll
SURNAMES = [('तिवारी', 4), ('शुक्ला', 3), ('मिश्रा', 3), ('पाण्डेय', 3), ('सिंह', 8), ('यादव', 7), ('वर्मा', 4), ('मौर्य', 3), ('गुप्ता', 3),
            ('निषाद', 3), ('पाल', 2), ('प्रजापति', 2), ('विश्वकर्मा', 2), ('सोनकर', 1), ('पासी', 2), ('रावत', 2), ('गौतम', 3), ('कोरी', 1),
            ('श्रीवास्तव', 1), ('', 12), ('कुमार', 6)]
MUS_SUR = [('खान', 4), ('अंसारी', 3), ('अहमद', 3), ('सिद्दीकी', 1), ('कुरैशी', 1), ('', 3)]

BLOCKS = [('पूर्वपुर', 'Purvapur', False), ('पश्चिमगढ़', 'Pashchimgarh', False), ('नदीपार', 'Nadipar', False), ('डेमो नगर शहर', 'Demo Nagar City', True)]
SYL = ['रा', 'म', 'पु', 'र', 'गढ़', 'नग', 'सो', 'हा', 'ली', 'बा', 'दे', 'वी', 'कि', 'शन', 'मा', 'धो', 'खे', 'ड़ा', 'ती', 'ला']
SYL_EN = ['ra', 'm', 'pu', 'r', 'garh', 'nag', 'so', 'ha', 'li', 'ba', 'de', 'vi', 'ki', 'shan', 'ma', 'dho', 'khe', 'ra', 'ti', 'la']
CENTER = (24.80, 80.30)   # arbitrary point; the demo has no basemap


def pick(pairs):
    tot = sum(w for _, w in pairs)
    x = rnd.uniform(0, tot)
    for v, w in pairs:
        x -= w
        if x <= 0:
            return v
    return pairs[-1][0]


def place_name(used):
    while True:
        ix = [rnd.randrange(len(SYL)) for _ in range(rnd.randint(2, 3))]
        suf_hi, suf_en = rnd.choice([('पुर', 'pur'), ('गांव', 'gaon'), ('खेड़ा', 'khera')])
        hi = ''.join(SYL[i] for i in ix) + suf_hi
        if hi not in used:
            used.add(hi)
            en = ''.join(SYL_EN[i] for i in ix) + suf_en
            return hi, en[:1].upper() + en[1:]


def main():
    used = set()
    voters, parts = [], []
    part = 0
    for bi, (bhi, ben, urban) in enumerate(BLOCKS):
        n_p = 4 if urban else rnd.randint(9, 12)
        for pi in range(n_p):
            phi, pen = (f'वार्ड {pi + 1}', f'Ward {pi + 1}') if urban else place_name(used)
            ang = 2 * 3.14159 * bi / len(BLOCKS) + rnd.uniform(-0.5, 0.5)
            rad = rnd.uniform(0.02, 0.05) if urban else rnd.uniform(0.07, 0.22)
            lat, lon = CENTER[0] + rad * math.sin(ang), CENTER[1] + rad * math.cos(ang) * 1.1
            muslim_share = rnd.uniform(0.25, 0.5) if urban else rnd.uniform(0.0, 0.25)
            for _ in range(rnd.randint(1, 3) if not urban else rnd.randint(4, 6)):
                part += 1
                parts.append([part, f'1-{phi}', '', f'प्राथमिक विद्यालय {phi}', f'Primary School {pen}', phi, pen, bhi, ben, 'yes' if urban else '', round(lat + rnd.uniform(-0.004, 0.004), 5), round(lon + rnd.uniform(-0.004, 0.004), 5), ''])
                house = 0
                for k in range(rnd.randint(650, 1050)):
                    if k % rnd.randint(3, 6) == 0:
                        house += 1
                        mus = rnd.random() < muslim_share
                        sur = pick(MUS_SUR if mus else SURNAMES)
                        head = rnd.choice(MUS_M if mus else FIRST_M) + (' ' + sur if sur else '')
                    female = rnd.random() < 0.47
                    first = rnd.choice((MUS_F if female else MUS_M) if mus else (FIRST_F if female else FIRST_M))
                    name = first + ('' if female and rnd.random() < 0.5 else (' ' + sur if sur else ''))
                    rel = 'husband' if female and rnd.random() < 0.7 else 'father'
                    age = max(18, min(99, int(rnd.gauss(42, 15))))
                    voters.append([part, k + 1, f'DMO{rnd.randint(1000000, 9999999)}', name, rel, head, str(house), age, 'F' if female else 'M', f'1-{phi}'])
    os.makedirs(OUT, exist_ok=True)
    xl = os.path.join(HERE, 'demo_voters.xlsx')
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = 'Voters'
    ws.append(['S.No', 'Part No', 'Serial', 'EPIC No', 'Name', 'Relation', 'Relative Name', 'House No', 'Age', 'Gender', 'Section', 'Page', 'PDF', 'Check'])
    for i, v in enumerate(voters, 1):
        ws.append([i, v[0], v[1], v[2], v[3], v[4], v[5], v[6], v[7], v[8], v[9], 3 + (v[1] - 1) // 30, f'DEMO-{v[0]}.pdf', ''])
    wb.save(xl)
    with open(os.path.join(OUT, 'parts.csv'), 'w', newline='', encoding='utf-8-sig') as f:
        w = csv.writer(f)
        w.writerow(['part_no', 'section', 'voters', 'polling_station', 'polling_station_en', 'panchayat', 'panchayat_en', 'block', 'block_en', 'urban', 'lat', 'lon', 'pin'])
        w.writerows(parts)
    print(f'{len(voters)} made-up voters in {part} parts')

    py = sys.executable
    an = os.path.join(ROOT, 'analysis')
    subprocess.check_call([py, os.path.join(an, 'classify.py'), xl, '--rules', os.path.join(an, 'rules', 'up.json'), '-o', os.path.join(HERE, 'demo_classified.xlsx')])
    reg = {
        'id': 'demo', 'name': 'Demo Nagar', 'local_name': 'डेमो नगर', 'number': '999', 'state': 'Demo State (made-up data)',
        '_note': 'Everything in this region is invented. It shows how the app works.',
        'model': {
            'party': 'Party A', 'support_source': 'made-up numbers for the demo',
            'groups': [
                {'k': 'upper', 'label': 'Upper castes', 'bloc': 'Upper caste', 'members': ['Brahmin', 'Kshatriya / Rajput', 'Gupta / Vaishya', 'Srivastava / Kayastha']},
                {'k': 'obc', 'label': 'Non-Yadav OBC', 'bloc': 'OBC', 'members': ['Kurmi / Patel / Verma', 'Maurya / Shakya', 'Nishad / Kewat / Kahar', 'Pal', 'Prajapati', 'Vishwakarma', 'Soni / Sonkar', 'Nai', 'Lodhi', 'Rajbhar', 'Mali / Murao']},
                {'k': 'yadav', 'label': 'Yadav', 'bloc': 'OBC', 'members': ['Yadav']},
                {'k': 'sc', 'label': 'Scheduled Castes', 'bloc': 'SC', 'members': ['SC (sub-caste not known)', 'Pasi (SC)', 'Chamar / Jatav (SC)', 'Kori (SC)', 'Dhobi (SC)', 'Valmiki (SC)', 'Khatik (SC)', 'Mehtar / Bhangi (SC)', 'Gond / Dom (SC)']},
                {'k': 'muslim', 'label': 'Muslim', 'bloc': 'Muslim', 'members': ['Muslim']}],
            'support': {'upper': 70, 'obc': 55, 'yadav': 20, 'sc': 35, 'muslim': 10},
            'calibrate_to': {'share': 0.41, 'label': 'the 2022 result (made up)'},
            'turnout': 60, 'target': 45, 'poll_date': ''},
        'outreach': {'SC': 'Example text: welfare-scheme contact, representation in booth committees and respect at every event.'},
        'risks': ['Example watch-list item: a strong rival candidate in the city wards.'],
        'blocks': [{'hi': b[0], 'en': b[1], 'urban': b[2]} for b in BLOCKS]}
    json.dump(reg, open(os.path.join(OUT, 'region.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    subprocess.check_call([py, os.path.join(an, 'build_region.py'), os.path.join(HERE, 'demo_classified.xlsx'),
                           '--rules', os.path.join(an, 'rules', 'up.json'), '--out', OUT])
    hist = {'elections': [
        {'year': 2022, 'level': 'VS', 'electors': 80500, 'polled': 49100, 'turnout': 61.0, 'winner': 'Candidate One (Party A)', 'margin': 1840,
         'results': [{'candidate': 'Candidate One', 'party': 'Party A', 'votes': 20130, 'pct': 41.0}, {'candidate': 'Candidate Two', 'party': 'Party B', 'votes': 18290, 'pct': 37.3},
                     {'candidate': 'Candidate Three', 'party': 'Party C', 'votes': 7400, 'pct': 15.1}, {'candidate': 'Others', 'party': '', 'votes': 3280, 'pct': 6.6}]}],
        'sources': [{'label': 'Invented for the demo'}]}
    json.dump(hist, open(os.path.join(OUT, 'history.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('Demo region written to', OUT)


if __name__ == '__main__':
    main()
