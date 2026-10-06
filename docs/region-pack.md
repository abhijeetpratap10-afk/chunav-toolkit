# Region packs

A region pack is a folder the app opens (**Settings → Open region folder…**). `app/regions/demo` is an example.

| File | Needed | Made by |
|---|---|---|
| `region.json` | yes | `build_region.py`, then edited by you (or **Settings → Save as region defaults**) |
| `panchayats.json` | yes | `build_region.py` |
| `parts.csv` | for building | you fill it in (one row per part) |
| `history.json` | no | you: past results for the Strategy tab |
| `basemap.json` | no | you: district outline, tehsils, rivers, roads, rail and towns for the map |

## parts.csv

| Column | Meaning |
|---|---|
| part_no | roll part (booth) number |
| section, voters | filled in for you, to help identify the part |
| polling_station, polling_station_en | polling station name (local / English) |
| panchayat, panchayat_en | gram panchayat or city ward (local / English) |
| block, block_en | development block, or the town for urban parts |
| urban | `yes` for town / city parts |
| lat, lon | location (decimal degrees). If left empty, the panchayat is drawn at a placeholder position near its block |
| pin | PIN code (optional) |

## region.json

```jsonc
{
  "id": "sultanpur-188",                 // keeps this seat's saved areas apart from other seats
  "name": "Sultanpur", "local_name": "सुलतानपुर", "number": "188", "state": "Uttar Pradesh",
  "blocks": [ { "hi": "कूरेभार", "en": "Kurebhar", "color": "#2f6db5" },
              { "hi": "सुलतानपुर शहर", "en": "Sultanpur City", "color": "#c0392b", "urban": true } ],
  "castes": { "unclassified": "Unclassified", "colors": { "Brahmin": "#e08a1e" }, "blocs": { "Brahmin": "Upper caste" } },
  "model": {
    "party": "Party A",
    "support_source": "where the default numbers come from, e.g. a post-poll survey",
    "groups": [ { "k": "upper", "label": "Upper castes", "bloc": "Upper caste", "members": ["Brahmin", "Kshatriya / Rajput"] } ],
    "support": { "upper": 80 },                     // expected % support per group
    "calibrate_to": { "share": 0.42, "label": "the 2022 result" },   // or null
    "turnout": 58, "target": 46, "poll_date": "2027-02-20"
  },
  "outreach": { "SC": "your notes for this bloc" },  // optional, shown in the Strategy tab
  "plan": [ { "phase": "Organisation", "when": "Oct–Nov", "items": [["id", "task text"]] } ],  // optional; replaces the default plan
  "risks": ["watch-list items"],                     // optional
  "rules": ["extra rules for workers"],              // optional
  "expense_limit": "₹40 lakh"                         // optional
}
```

`hi` is the block name exactly as it appears in `panchayats.json` (the local-language name). Settings in the app (party name, colours, community groups, support numbers) are saved with the region's own data in `%APPDATA%\chunav_toolkit_data\regions\<id>\store.json`. They override `region.json` until you reset them.

## history.json

```json
{ "elections": [ { "year": 2022, "level": "VS", "electors": 381421, "polled": 218065, "turnout": 57.7,
    "winner": "Name (Party)", "margin": 1009,
    "results": [ { "candidate": "Name", "party": "Party", "votes": 92715, "pct": 42.2 } ] } ],
  "sources": [ { "label": "ECI statistical report 2022" } ] }
```

`level` is `VS` (assembly) or `LS` (Lok Sabha). The most recent `VS` election sets the margin and roll-change figures in the Strategy tab.
