# -*- coding: utf-8 -*-
"""Per-language words used on Election Commission of India (ECI) electoral rolls.

The parser does not depend on these labels to find fields: every voter box prints
its lines in the same order (name, relative, house, age + gender). The words below
are only used to tell *which* relative is named (father / husband / mother / other)
and to normalise gender. If your roll uses a different spelling, add it here.

`tess` is the Tesseract model(s) to load. English is always added, because EPIC
numbers are printed in Latin letters on every roll.
"""

LANGUAGES = {
    'eng': {'name': 'English', 'tess': 'eng',
            'father': ['father'], 'husband': ['husband'], 'mother': ['mother'], 'other': ['other', 'others', 'guru', 'wife'],
            'male': ['male'], 'female': ['female'], 'third': ['third gender', 'third', 'other', 'transgender']},
    'hin': {'name': 'Hindi', 'tess': 'hin',
            'father': ['पिता'], 'husband': ['पति'], 'mother': ['माता', 'मां', 'माँ'], 'other': ['अन्य', 'गुरु'],
            'male': ['पुरुष', 'पु'], 'female': ['महिला', 'स्त्री', 'म'], 'third': ['तृतीय', 'अन्य']},
    'mar': {'name': 'Marathi', 'tess': 'mar',
            'father': ['वडिलांचे', 'वडील', 'पिता'], 'husband': ['पतीचे', 'पती'], 'mother': ['आईचे', 'आई'], 'other': ['इतर'],
            'male': ['पुरुष'], 'female': ['स्त्री', 'महिला'], 'third': ['तृतीयपंथी', 'इतर']},
    'nep': {'name': 'Nepali', 'tess': 'nep',
            'father': ['बुबा', 'बाबु', 'पिता'], 'husband': ['पति', 'श्रीमान'], 'mother': ['आमा', 'माता'], 'other': ['अन्य'],
            'male': ['पुरुष'], 'female': ['महिला', 'स्त्री'], 'third': ['तेस्रो', 'अन्य']},
    'ben': {'name': 'Bengali', 'tess': 'ben',
            'father': ['পিতার', 'পিতা', 'বাবার', 'বাবা'], 'husband': ['স্বামীর', 'স্বামী'], 'mother': ['মাতার', 'মায়ের', 'মা'], 'other': ['অন্যান্য', 'অন্য'],
            'male': ['পুরুষ'], 'female': ['মহিলা', 'স্ত্রী'], 'third': ['তৃতীয়', 'অন্যান্য']},
    'asm': {'name': 'Assamese', 'tess': 'asm',
            'father': ['পিতাৰ', 'দেউতাৰ', 'পিতা'], 'husband': ['স্বামীৰ', 'স্বামী'], 'mother': ['মাতৃৰ', 'মাকৰ', 'মাতৃ'], 'other': ['অন্যান্য', 'অন্য'],
            'male': ['পুৰুষ', 'পুরুষ'], 'female': ['মহিলা', 'স্ত্ৰী'], 'third': ['তৃতীয়', 'অন্যান্য']},
    'guj': {'name': 'Gujarati', 'tess': 'guj',
            'father': ['પિતાનું', 'પિતા'], 'husband': ['પતિનું', 'પતિ'], 'mother': ['માતાનું', 'માતા'], 'other': ['અન્ય'],
            'male': ['પુરુષ'], 'female': ['સ્ત્રી', 'મહિલા'], 'third': ['ત્રીજી', 'અન્ય']},
    'pan': {'name': 'Punjabi (Gurmukhi)', 'tess': 'pan',
            'father': ['ਪਿਤਾ'], 'husband': ['ਪਤੀ'], 'mother': ['ਮਾਤਾ', 'ਮਾਂ'], 'other': ['ਹੋਰ'],
            'male': ['ਪੁਰਸ਼', 'ਮਰਦ'], 'female': ['ਇਸਤਰੀ', 'ਔਰਤ', 'ਮਹਿਲਾ'], 'third': ['ਤੀਜਾ', 'ਹੋਰ']},
    'ori': {'name': 'Odia', 'tess': 'ori',
            'father': ['ପିତାଙ୍କ', 'ପିତା', 'ବାପା'], 'husband': ['ସ୍ୱାମୀଙ୍କ', 'ସ୍ୱାମୀ', 'ସ୍ଵାମୀ'], 'mother': ['ମାତାଙ୍କ', 'ମାତା', 'ମା'], 'other': ['ଅନ୍ୟ'],
            'male': ['ପୁରୁଷ'], 'female': ['ମହିଳା', 'ସ୍ତ୍ରୀ'], 'third': ['ତୃତୀୟ', 'ଅନ୍ୟ']},
    'tam': {'name': 'Tamil', 'tess': 'tam',
            'father': ['தந்தையின்', 'தந்தை'], 'husband': ['கணவரின்', 'கணவர்', 'கணவன்'], 'mother': ['தாயின்', 'தாய்'], 'other': ['மற்றவர்', 'இதரர்'],
            'male': ['ஆண்'], 'female': ['பெண்'], 'third': ['மூன்றாம்', 'திருநங்கை', 'இதரர்']},
    'tel': {'name': 'Telugu', 'tess': 'tel',
            'father': ['తండ్రి'], 'husband': ['భర్త'], 'mother': ['తల్లి'], 'other': ['ఇతరులు', 'ఇతర'],
            'male': ['పురుషుడు', 'పురుష', 'పు'], 'female': ['స్త్రీ', 'మహిళ'], 'third': ['ఇతరులు', 'తృతీయ']},
    'kan': {'name': 'Kannada', 'tess': 'kan',
            'father': ['ತಂದೆಯ', 'ತಂದೆ'], 'husband': ['ಗಂಡನ', 'ಪತಿಯ', 'ಗಂಡ', 'ಪತಿ'], 'mother': ['ತಾಯಿಯ', 'ತಾಯಿ'], 'other': ['ಇತರೆ', 'ಇತರ'],
            'male': ['ಪುರುಷ', 'ಗಂಡು'], 'female': ['ಮಹಿಳೆ', 'ಸ್ತ್ರೀ', 'ಹೆಣ್ಣು'], 'third': ['ಇತರೆ', 'ತೃತೀಯ']},
    'mal': {'name': 'Malayalam', 'tess': 'mal',
            'father': ['അച്ഛന്റെ', 'പിതാവിന്റെ', 'അച്ഛൻ'], 'husband': ['ഭർത്താവിന്റെ', 'ഭര്‍ത്താവിന്റെ', 'ഭർത്താവ്'], 'mother': ['അമ്മയുടെ', 'അമ്മ'], 'other': ['മറ്റുള്ളവ', 'മറ്റുള്ളവർ'],
            'male': ['പുരുഷൻ', 'പുരുഷന്‍'], 'female': ['സ്ത്രീ'], 'third': ['ട്രാൻസ്ജെൻഡർ', 'മറ്റുള്ളവർ']},
    'urd': {'name': 'Urdu (also Kashmiri)', 'tess': 'urd',
            'father': ['والد'], 'husband': ['شوہر', 'خاوند'], 'mother': ['والدہ'], 'other': ['دیگر'],
            'male': ['مرد'], 'female': ['عورت', 'خاتون'], 'third': ['تیسری', 'دیگر']},
    'snd': {'name': 'Sindhi', 'tess': 'snd',
            'father': ['پيءُ', 'والد'], 'husband': ['مڙس', 'شوهر'], 'mother': ['ماءُ', 'والده'], 'other': ['ٻيا'],
            'male': ['مرد'], 'female': ['عورت'], 'third': ['ٽيون']},
    'san': {'name': 'Sanskrit', 'tess': 'san',
            'father': ['पिता'], 'husband': ['पति'], 'mother': ['माता'], 'other': ['अन्य'],
            'male': ['पुरुष'], 'female': ['स्त्री', 'महिला'], 'third': ['तृतीय']},
}

# Scheduled languages without their own Tesseract model use the model for their script.
ALIASES = {
    'kok': 'mar',   # Konkani (Devanagari)
    'mai': 'hin',   # Maithili
    'doi': 'hin',   # Dogri
    'brx': 'hin',   # Bodo
    'kas': 'urd',   # Kashmiri (Perso-Arabic)
    'mni': 'ben',   # Manipuri rolls are printed in Bengali script
    'sat': 'hin',   # Santali: Ol Chiki has no Tesseract model; Jharkhand rolls are in Hindi
    'odi': 'ori', 'pun': 'pan', 'pnb': 'pan',
}

# Language code printed in ECI roll file names, e.g. ...-HIN-33-WI.pdf, ...-ASM-1-WI.pdf
FILENAME_CODES = {
    'ENG': 'eng', 'HIN': 'hin', 'MAR': 'mar', 'NEP': 'nep', 'BEN': 'ben', 'BNG': 'ben', 'ASM': 'asm',
    'GUJ': 'guj', 'PUN': 'pan', 'PAN': 'pan', 'GUR': 'pan', 'ORI': 'ori', 'ODI': 'ori', 'ORY': 'ori',
    'TAM': 'tam', 'TEL': 'tel', 'KAN': 'kan', 'MAL': 'mal', 'URD': 'urd', 'KOK': 'mar', 'SND': 'snd',
}


def resolve(code):
    """Return (code, spec) for a language code or alias, e.g. 'kok' -> ('mar', {...})."""
    c = (code or 'eng').lower()
    c = ALIASES.get(c, c)
    if c not in LANGUAGES:
        raise SystemExit(f'Unknown language "{code}". Known: {", ".join(sorted(LANGUAGES))} '
                         f'(aliases: {", ".join(sorted(ALIASES))})')
    return c, LANGUAGES[c]
