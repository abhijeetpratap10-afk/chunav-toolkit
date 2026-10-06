# Roll OCR (`ocr/roll2excel.py`)

## Install

| System | Tesseract |
|---|---|
| Windows | Install the [UB Mannheim build](https://github.com/UB-Mannheim/tesseract/wiki). The script finds `C:\Program Files\Tesseract-OCR\tesseract.exe` on its own; otherwise pass `--tesseract`. |
| Ubuntu / Debian | `sudo apt install tesseract-ocr` |
| macOS | `brew install tesseract` |

```bash
pip install -r ocr/requirements.txt
python ocr/get_languages.py hin            # or: --state S22, --all, add --best for the larger models
```

`get_languages.py` saves the language files in `ocr/tessdata`, and `roll2excel.py` uses that folder when it exists. To use another folder, pass `--tessdata` or set `TESSDATA_PREFIX`.

## Languages

| Code | Language | Tesseract model | Notes |
|---|---|---|---|
| eng | English | eng | EPIC numbers on every roll are read with this too |
| hin | Hindi | hin | also Maithili, Dogri, Bodo, Santali (Jharkhand rolls are in Hindi) |
| mar | Marathi | mar | also Konkani |
| nep | Nepali | nep | Sikkim, Darjeeling |
| ben | Bengali | ben | also Manipuri rolls (Bengali script); read line by line |
| asm | Assamese | asm | read line by line |
| guj | Gujarati | guj | |
| pan | Punjabi | pan | |
| ori | Odia | ori | |
| tam | Tamil | tam | |
| tel | Telugu | tel | |
| kan | Kannada | kan | |
| mal | Malayalam | mal | |
| urd | Urdu | urd | also Kashmiri |
| snd | Sindhi | snd | |
| san | Sanskrit | san | |

Ol Chiki (Santali) and Meitei Mayek (Manipuri) have no Tesseract model. Rolls in those scripts cannot be read yet.

Only Hindi and Assamese have been tested on real 2026 rolls. The per-language words in `languages.py` (father / husband / mother, male / female) for the other languages have not been checked against real rolls. If your roll prints a different word, add it to the list and run again. Fields are found by their position, so a missing word only leaves the relation type or gender blank (flagged in **Check**). It does not lose the voter.

## How it reads a page

1. Renders the page at 300 dpi.
2. Finds the 30 voter boxes from their printed borders, then erases the borders.
3. **auto** mode (default): OCRs the whole page once in the roll language and assigns words to boxes by position. Boxes with a missing field are read again line by line.
   **lines** mode (default for Assamese and Bengali, or `--mode lines`): cuts each box into its 4 text lines and reads each line on its own. This is slower but works when lines touch.
4. Runs a second, English pass for EPIC numbers, serial numbers and ages, because Indic models often read the digit 1 as the danda "।".
5. Reads fields by position: name / relative / house / age + gender. The section name comes from the page header, and the part number from the file name.
6. Repairs serial numbers from their neighbours (they run 1, 2, 3 … within a part).

## Output

Sheet **Voters**: S.No, Part No, Serial, EPIC No, Name, Relation (father / husband / mother / other), Relative Name, House No, Age, Gender (M / F / T), Section, Page, PDF, Check.
Sheet **Parts**: one row per PDF with pages, voters read, rows to check and the OCR text of the cover page. The cover page holds the polling station, village, panchayat and block, which you use to fill `parts.csv`.

## Speed

On a 4-core laptop, auto mode takes about 5–10 seconds per page per core, and lines mode about 30 seconds. `--workers` sets how many pages run at once (default: number of cores − 1). Results are cached in `<output>.cache/`, so re-running skips finished PDFs.
