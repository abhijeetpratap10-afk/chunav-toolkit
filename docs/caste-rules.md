# Community rules (`analysis/rules/*.json`)

A rules file tells `classify.py` how to recognise communities from the words in a voter's name and the relative's name. Copy `template.json` for a new state. `up.json` is the full Uttar Pradesh list, built from the 188 Sultanpur analysis.

```jsonc
{
  "state": "Uttar Pradesh",
  "language": "hin",
  "unclassified": { "id": "unclassified", "label": "Unclassified", "local": "अवर्गीकृत", "color": "#9a9a90" },
  "generic_words": ["कुमार", "देवी", "राम", "लाल"],          // never decide a community on their own
  "prefix_rules": [{ "group": "muslim", "words": ["मो.", "md"] }], // first word of either name
  "first_group_any_word": "muslim",                          // this group is checked in both names before all others
  "compound_min_length": 8,                                  // look for surnames inside joined-up words this long…
  "substring_min_length": 4,                                 // …using surnames at least this long
  "last_resort": [{ "group": "rajput", "words": ["सिंह"] }],    // only when nothing else matched
  "relative_surname_rule": { "group": "sc", "words": ["कुमार"] }, // relative's last word; set to null to switch off
  "groups": [
    { "id": "brahmin", "label": "Brahmin", "local": "ब्राह्मण", "bloc": "Upper caste", "color": "#e08a1e",
      "words": ["तिवारी", "शुक्ला", "मिश्रा"] }
  ]
}
```

## Order of checks

1. Prefix rule (e.g. "मो." before a name).
2. `first_group_any_word`: any word of either name.
3. Each group in file order, against the voter's own name, then against the relative's name. The first group with a matching word wins, so put specific groups before broad ones.
4. Surnames hidden inside long joined-up words (`अजयकुमारतिवारी`).
5. `last_resort` words.
6. `relative_surname_rule`.
7. Otherwise, the voter is *unclassified*.

Matching is on whole words, in the roll's script. For English rolls, write the words in lower-case Latin letters. You can mix scripts in one file.

## The estimate column ("new logic")

For voters the rules could not place, `classify.py` learns from the voters it *did* place. It uses naive Bayes on the voter's first name and the words of the relative's name. A guess is kept only when it is at least 60 % likely (change this with `--min-prob`). Whatever is still unknown takes the majority community of the same house number in the same part, if at least 70 % of that household agrees.

This gives better totals for booths and panchayats. It is a statistical estimate, and wrong for some individuals.

## Labels, colours and blocs

`label` is the name the app shows. `color` is used on the map and in charts. `bloc` (e.g. Upper caste, OBC, SC, ST, Muslim) is the default group for the vote model. You can regroup communities later in the app (**Settings → Communities**) or in `region.json → model.groups`.
