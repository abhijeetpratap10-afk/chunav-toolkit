# How to do a caste-wise analysis of an assembly seat

This guide describes the method behind this toolkit, step by step, so you can repeat it for any seat in any state. The tools automate each step, but the judgement calls are yours: which surnames belong to which community, how far to trust the estimates, and what support to expect from each group.

> **Use it for planning, not for appeals.** Seeking votes on the grounds of caste, religion, community or language is a corrupt practice under Section 123(3) and 123(3A) of the Representation of the People Act 1951. Caste data is for internal decisions, such as where to put workers and whom to invite onto booth committees. Work only with totals. Never publish or share a voter-level list with communities attached.

---

## Step 1: Get the electoral roll

1. Download the roll PDFs for your assembly constituency (one PDF per *part*, i.e. polling booth) from your state's Chief Electoral Officer website or the ECI voter portal. File names look like `2026-EROLLGEN-S24-188-…-HIN-33-WI.pdf`: state S24 (Uttar Pradesh), seat 188, language Hindi, part 33.
2. Use the latest roll (final roll, or the draft roll during a revision). Note which roll you used. Every number later depends on it.

## Step 2: Turn the PDFs into a table

```bash
python ocr/get_languages.py --state S24
python ocr/roll2excel.py <folder of PDFs> -o voters.xlsx
```

Before you go further, check the extraction:

| Check | How | Why |
|---|---|---|
| Voters per part | Compare the **Parts** sheet with the total printed on each roll's cover/summary page | Missing pages or boxes shrink a booth |
| Serial numbers | They should run 1, 2, 3 … in each part; gaps mean missed voters | |
| **Check** column | Filter non-empty rows and correct the important ones by hand | OCR errors in surnames cause misclassification |
| Gender and age | Women per 1,000 men and the age profile should look plausible | Catches a systematic OCR fault |

A few hundred errors in 3 lakh voters do not change booth totals much. But a surname that is always misread (for example, one letter always read wrong) can move a whole community, so look at the most frequent names.

## Step 3: Write the surname rules for your state

Communities are recognised from surnames and other identifying words in the voter's name and the relative's name. The rules live in a JSON file (`analysis/rules/<state>.json`); the format is in [caste-rules.md](caste-rules.md).

**Start small and grow the list from your own data:**

1. Copy `rules/template.json`, or start from `rules/up.json` if your state shares surnames with Uttar Pradesh.
2. Run `classify.py`. Open the **Unknown surnames** sheet: the most frequent last words among voters the rules could not place, with an example name.
3. For each frequent word, decide:
   - **It identifies one community** (e.g. तिवारी → Brahmin): add it to that group's `words`.
   - **It is used by several communities** (e.g. Singh, Kumar, Prasad, Ram): do *not* add it to a group. Add it to `generic_words`, or to `last_resort` if it leans clearly one way when nothing else matches.
   - **It is a first name or a title, not a surname**: add it to `generic_words`.
4. Run again. Repeat until the unknown share stops falling. With a good Hindi-belt list, surname rules alone place about half of all voters.

**Order matters.** The first group with a matching word wins. Put groups whose words are unambiguous first. Put groups with shared words later.

**Local rules are allowed but must be stated.** `up.json` uses two:
- "Singh" counts as Rajput only if nothing else matched, because many communities in UP use it.
- If the relative's last name is "Kumar" and nothing else matched, the voter is counted as SC. This is common in eastern UP, but it is not true everywhere.

Switch off rules that do not hold in your area. Write down every such rule in the `_about` field, so anyone using the results knows the assumptions.

**Ask people who know the area.** For each block, show local workers the 50 most frequent unknown surnames and the communities you assigned. They can correct mistakes in an hour.

## Step 4: Estimate the rest, and measure how good the estimate is

Surname rules leave many voters unknown: generic surnames, no surname, first-name-only entries. `classify.py` adds an estimate for them:

1. **Names model.** It learns which first names and relative-name words go with which community among the voters the rules *did* place (naive Bayes). It then guesses for unknown voters, keeping a guess only when the probability is at least 60 % (`--min-prob`).
2. **Household.** A voter who is still unknown takes the community of the same house number in the same part, if at least 70 % of that household agrees.

**Always read the Estimate check sheet.** It hides the surname of a random 10 % of the voters the rules did place, lets the estimate guess them from the remaining words, and compares the guesses with the real answers:

- **Coverage**: how many of the hidden voters got any guess at all.
- **Right % of guesses**: of the voters of this community that got a guess, how many were guessed correctly.
- **Precision**: of all the voters the estimate *put into* this community, how many really belong there. Low precision means the estimate over-counts the community.

Example from one UP seat (about 3.2 lakh voters):

| Community | Right % of guesses | Precision |
|---|---|---|
| Muslim | 100 % | 99.8 % |
| Kshatriya / Rajput | 57 % | 75 % |
| Brahmin | 57 % | 51 % |
| SC (sub-caste not known) | 99 % | 55 % |
| Yadav | 22 % | 48 % |
| Kurmi, Maurya, Pal, Nai and other OBC | 0 % | — |

So in that seat, the estimate is trustworthy for Muslim voters, usable with care for the large upper-caste groups, over-counts SC, and is of no help for the smaller OBC communities. Report surname-only and estimated totals side by side. Never present estimated sub-caste counts as facts.

## Step 5: Compare with official data

Check your totals against independent sources before using them:

- **Census 2011 Primary Census Abstract**: SC and ST population for every village and town. Compare your SC share per panchayat. If yours is much lower, many SC families use generic surnames; if much higher, a rule (like the Kumar rule) is too broad.
- **SECC 2011**: SC/ST households by block (rural).
- **Religion** (Census 2011, district and town level): checks the Muslim and Christian shares.
- There is no official count of OBC or upper-caste sub-groups. Treat those numbers as the least certain.

When a whole block is off, adjust the rules rather than patching numbers by hand.

## Step 6: Aggregate to booths, panchayats and blocks

`build_region.py` adds up voters by part (booth), then panchayat and block. It uses a `parts.csv` that you fill in once: panchayat, block, polling station and location for each part. You can get these from the roll cover pages (shown in the **Parts** sheet of the OCR output). For each booth you get voters, women and men, age bands (18–19, 18–25, 60+), voter-list pages (one panna pramukh each), and the community mix under both surname-only and estimated logic.

Group communities into **blocs** (e.g. Upper caste, Non-Yadav OBC, Yadav, SC, Muslim) for the vote model. Sub-caste detail is too uncertain for modelling, and blocs match how survey data is published.

## Step 7: From composition to an expected vote (optional)

The app's Strategy tab turns booth composition into an expected vote share for a party:

1. **Support per bloc.** Start from a published post-poll survey for the state (e.g. Lokniti-CSDS), and record the source in `region.json → model.support_source`. These numbers are statewide, so adjust them with what local workers report.
2. **Booth share** = Σ (voters of the bloc × support of the bloc) ÷ voters. Unknown voters get the average of the identified voters in the same booth.
3. **Calibrate.** Shift every booth by the same amount (on the logit scale) until the seat total equals the party's actual share in the last election. This keeps differences between booths but fixes the overall level.
4. **Categorise booths**: Strong ≥55 %, Leaning 47–55 %, Contested 38–47 %, Difficult below 38 %. The tasks differ: turnout in Strong booths, persuasion in Leaning and Contested ones, respectful outreach everywhere.
5. **Validate** with official Form-20 booth-wise results of the last election from the CEO website. If the model's booth ranking does not match the actual booth ranking, revisit the support numbers.

The model is a planning aid. It assumes communities vote alike across booths, which is never fully true, and its accuracy cannot be better than the community estimates underneath it.

## Step 8: Use it

- Put the strongest booth committees and panna pramukhs in booths where turnout gains are largest.
- Send the candidate to the largest Leaning and Contested booths.
- Make booth committees reflect every community in the booth.
- Plan enrolment drives where women or 18–19-year-olds are under-represented.

## Checklist for publishing results

- [ ] Only totals (booth, panchayat, block, seat), never voter-level lists.
- [ ] State which roll, which rules file, and whether numbers are surname-only or estimated.
- [ ] State the local rules (Singh, Kumar, …) and the Estimate check accuracy.
- [ ] Compared with Census / SECC, with differences explained.
- [ ] No language that appeals to voters on caste or religion.
