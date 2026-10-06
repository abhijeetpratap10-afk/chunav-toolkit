# Chunav Toolkit · चुनाव टूलकिट

Election-analysis tools for any Indian assembly seat, in any Indian language:

1. **Roll OCR** (`ocr/`): turns Election Commission electoral-roll PDFs into an Excel sheet with one row per voter (EPIC no., name, relative, house, age, gender, part, section). It works for English and every Indian language that Tesseract can read.
2. **Community analysis** (`analysis/`): adds a community column using surname rules you can edit per state, then builds booth- and panchayat-level totals.
3. **Sanyojak Map** (`app/`): a Windows desktop app (Electron) with a map of every panchayat and booth. You group panchayats into areas, appoint a sanyojak per area and a sah-sanyojak per panchayat, see the community mix, run a booth-level vote model, plan the campaign and print or export everything.

The app ships with **Demo Nagar 999**, a made-up seat, so you can try it straight away. Real seats are loaded as *region packs* (a folder with `region.json` + `panchayats.json`). You can switch between them in **Settings**, so one install can serve any seat in any state.

```
roll PDFs ──► ocr/roll2excel.py ──► voters.xlsx
                                       │
          analysis/rules/<state>.json ─┤
                                       ▼
                        analysis/classify.py ──► voters_classified.xlsx
                                                         │
                         parts.csv (panchayat, block, ──►┤
                         lat/lon of each part)           ▼
                                        analysis/build_region.py ──► region folder ──► Sanyojak Map
```

---

## 1. Read electoral rolls into Excel

Requirements: Python 3.10+, and [Tesseract OCR](https://github.com/tesseract-ocr/tesseract) 5.x (Windows installer: [UB Mannheim build](https://github.com/UB-Mannheim/tesseract/wiki)).

```bash
cd ocr
pip install -r requirements.txt
python get_languages.py --state S24          # language files for Uttar Pradesh (Hindi, Urdu, English)
python roll2excel.py "C:\rolls\188" -o voters.xlsx
```

- The language is read from the ECI file name (`…-HIN-33-WI.pdf`, `…-ASM-1-WI.pdf`) or the state code in it (`S24`). You can also set it yourself: `--lang ben`.
- Supported: English, Hindi, Marathi, Nepali, Bengali, Assamese, Gujarati, Punjabi, Odia, Tamil, Telugu, Kannada, Malayalam, Urdu, Sindhi and Sanskrit. Konkani, Maithili, Dogri, Bodo, Kashmiri, Manipuri and Santali rolls use the model for their script (see [docs/ocr.md](docs/ocr.md)).
- Progress is cached, so an interrupted run carries on where it stopped. `--pages 2` does a quick test on the first pages.
- The **Check** column flags every voter with a missing or doubtful field. Review those rows before you use the data.

Accuracy depends on the scan. On the 2026 Hindi (UP) rolls, names, relatives, EPIC numbers, ages and genders come out right for almost every voter. Assamese and Bengali rolls are low-resolution with touching lines, so they are read line by line (slower). Names come out mostly right; house numbers often need checking.

## 2. Add communities

```bash
cd analysis
pip install openpyxl
python classify.py ../ocr/voters.xlsx --rules rules/up.json -o voters_classified.xlsx
```

- `rules/up.json` is the Uttar Pradesh surname list (Hindi rolls). For another state, copy `rules/template.json` and fill in the groups, colours and blocs. See [docs/caste-rules.md](docs/caste-rules.md).
- **Community** comes from surname rules only. **Community (est.)** also uses first-name statistics and households for voters the rules could not place. In the app these are "old logic" and "new logic".
- Estimates are for planning totals. They can be wrong for any single voter.

## 3. Build a region pack for the app

```bash
python build_region.py voters_classified.xlsx --rules rules/up.json --out ../my-seat --name "My Seat" --number 123
#  -> writes my-seat/parts.csv: fill in panchayat, block, polling station and lat/lon for each part
python build_region.py voters_classified.xlsx --rules rules/up.json --out ../my-seat
#  -> writes my-seat/region.json and my-seat/panchayats.json
```

Then, in the app, open **Settings → Open region folder…** and choose `my-seat`. In `region.json` you can rename blocks, change colours, set the party name, group communities for the vote model, give default support numbers and a past result to calibrate to, and add your own plan, outreach notes and watch list. See [docs/region-pack.md](docs/region-pack.md). Optional files `history.json` (past results) and `basemap.json` (district outline, roads, rivers) add more context to the map.

## 4. Run the app

```bash
cd app
npm install
npm start            # run
npm run dist         # build a Windows installer in app/dist
```

Tabs: **Map** (select panchayats, colour by area / block / largest group / vote model), **Areas** (sanyojak per area), **Blocks**, **Panchayats** (register with sah-sanyojak names and phones, booth details), **Strategy** (vote model, priority booths, organisation needed, outreach), **Future** (checklist to polling day) and **Settings** (region, party name, colours, community groups).
Your areas and contacts are saved per region in `%APPDATA%\chunav_toolkit_data\regions\<id>\store.json`, with automatic backups.

---

## Privacy and the law

- Electoral rolls contain personal data. **Do not commit roll PDFs, OCR output, classified lists or contact backups to a public repository.** The `.gitignore` blocks PDFs, spreadsheets, CSVs and every region folder except the demo, but check `git status` before you push.
- Community estimates are statistical guesses for internal planning only. Never publish voter-level community data.
- Appealing for votes on the grounds of religion, caste, community or language is a corrupt practice under the Representation of the People Act 1951, Section 123(3) and 123(3A). Follow the Model Code of Conduct and the ECI expenditure rules.

## Repository layout

```
ocr/        roll2excel.py, get_languages.py, languages.py (per-language words), states.json (state → roll languages)
analysis/   classify.py, build_region.py, rules/ (up.json, template.json)
app/        Electron app; regions/demo is the made-up sample seat
samples/    make_demo.py (rebuilds the demo seat through the whole pipeline)
docs/       ocr.md, caste-rules.md, region-pack.md
```

## License

MIT, see [LICENSE](LICENSE).
