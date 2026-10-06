# -*- coding: utf-8 -*-
"""Download Tesseract language files into ocr/tessdata.

    python get_languages.py hin eng          # Hindi + English
    python get_languages.py --state S03      # every roll language of Assam (states.json)
    python get_languages.py --all            # all Indian languages + English
    python get_languages.py ben --best       # larger, slower, more accurate models

roll2excel.py uses ocr/tessdata automatically when it exists.
"""
import argparse
import json
import os
import sys
import urllib.request

from languages import LANGUAGES, resolve

HERE = os.path.dirname(os.path.abspath(__file__))
URL = {'fast': 'https://github.com/tesseract-ocr/tessdata_fast/raw/main/{}.traineddata',
       'normal': 'https://github.com/tesseract-ocr/tessdata/raw/main/{}.traineddata',
       'best': 'https://github.com/tesseract-ocr/tessdata_best/raw/main/{}.traineddata'}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('langs', nargs='*', help='language codes, e.g. hin ben tam (see languages.py)')
    ap.add_argument('--state', help='ECI state code, e.g. S24 for Uttar Pradesh')
    ap.add_argument('--all', action='store_true')
    g = ap.add_mutually_exclusive_group()
    g.add_argument('--best', action='store_true', help='tessdata_best models')
    g.add_argument('--fast', action='store_true', help='tessdata_fast models')
    ap.add_argument('--dir', default=os.path.join(HERE, 'tessdata'))
    a = ap.parse_args()

    codes = set(a.langs)
    if a.state:
        states = json.load(open(os.path.join(HERE, 'states.json'), encoding='utf-8'))
        if a.state.upper() not in states:
            sys.exit(f'Unknown state code {a.state}. See states.json.')
        codes |= set(states[a.state.upper()]['languages'])
    if a.all:
        codes |= set(LANGUAGES)
    if not codes:
        ap.error('give language codes, --state or --all')
    tess = sorted({resolve(c)[1]['tess'] for c in codes} | {'eng'})

    kind = 'best' if a.best else 'fast' if a.fast else 'normal'
    os.makedirs(a.dir, exist_ok=True)
    for t in tess:
        dest = os.path.join(a.dir, f'{t}.traineddata')
        if os.path.exists(dest):
            print(f'  {t}: already there')
            continue
        print(f'  {t}: downloading ({kind}) …', flush=True)
        try:
            urllib.request.urlretrieve(URL[kind].format(t), dest + '.part')
            os.replace(dest + '.part', dest)
        except Exception as e:  # noqa: BLE001
            print(f'     failed: {e}')
    print(f'\nLanguage files are in {a.dir}')


if __name__ == '__main__':
    main()
