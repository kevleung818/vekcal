# Vekai Cal

A quiet, local-first I Ching ritual app inspired by the supplied design blueprints. The experience combines a guided pause, six casts using either the Da Yan yarrow-stalk method or the three-coin method, King Wen hexagram mapping, Zhu Xi changing-line guidance, and an optional encrypted personal archive.

## Run locally

Requires Node.js 18 or newer. From this directory:

```sh
npm run dev
```

Open [http://localhost:4173](http://localhost:4173). The app has no package dependencies. Use HTTPS or localhost for Web Crypto and the encrypted archive.

Use the header control to switch between day and night themes. The preference is stored locally in this browser.

## Casting and interpretation

Choose either casting method when entering a reading. The Da Yan method uses the traditional distribution: 6 (old yin) 1/16, 7 (young yang) 5/16, 8 (young yin) 7/16, and 9 (old yang) 3/16. The three-coin method simulates three independent coin faces per line: three tails produce 6 (old yin), one head produces 8 (young yin), two heads produce 7 (young yang), and three heads produce 9 (old yang). Six lines are formed from the bottom upward. Both methods map to the same 64 King Wen hexagrams and Zhu Xi changing-line count rules.

Before casting, optionally select one reading category (fortune, love, illness, lost items, or litigation) and choose Traditional Chinese or Hong Kong Cantonese. Category text is matched against the resulting original hexagram and sourced from the attached interpretation tables. Illness readings are cultural divination text only, not medical advice or a diagnosis; seek qualified medical care for health concerns.

Results include all seven reference fields for both the original and transformed hexagrams. Hong Kong Cantonese is selected by default because its source table includes every field: hexagram form, image, auspiciousness, interpretation, hexagram text, inference, and Great Image. Traditional Chinese remains selectable and displays the fields provided in its source table.

## Private archive

The archive is optional and stored only in this browser's IndexedDB. Readings are encrypted with AES-GCM-256; a PBKDF2/SHA-256 key is derived from the passphrase with a per-archive random salt. The passphrase and derived key are not persisted. The archive locks when the page is hidden and when the page is closed. If the passphrase is lost, the archive cannot be recovered. Clearing browser data also deletes the archive.

## Limitations

This app provides traditional study prompts, not a complete scholarly translation of the Yijing or professional advice. No LLM, account, analytics, or server-side reading storage is connected. The optional sound and vibration depend on browser/device support.

## Tests

```sh
npm test
```
