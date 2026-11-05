# Vekai Cal

A quiet, local-first I Ching ritual app inspired by the supplied design blueprints. The experience combines a guided pause, six yarrow-stalk casts, King Wen hexagram mapping, Zhu Xi changing-line guidance, and an optional encrypted personal archive.

## Run locally

Requires Node.js 18 or newer. From this directory:

```sh
npm run dev
```

Open [http://localhost:4173](http://localhost:4173). The app has no package dependencies. Use HTTPS or localhost for Web Crypto and the encrypted archive.

## Casting and interpretation

Each line uses the traditional Da Yan distribution: 6 (old yin) 1/16, 7 (young yang) 5/16, 8 (young yin) 7/16, and 9 (old yang) 3/16. Six lines are formed from the bottom upward. The app maps all 64 King Wen hexagrams and applies the supplied Zhu Xi changing-line count rules.

## Private archive

The archive is optional and stored only in this browser's IndexedDB. Readings are encrypted with AES-GCM-256; a PBKDF2/SHA-256 key is derived from the passphrase with a per-archive random salt. The passphrase and derived key are not persisted. The archive locks when the page is hidden and when the page is closed. If the passphrase is lost, the archive cannot be recovered. Clearing browser data also deletes the archive.

## Limitations

This app provides traditional study prompts, not a complete scholarly translation of the Yijing or professional advice. No LLM, account, analytics, or server-side reading storage is connected. The optional sound and vibration depend on browser/device support.

## Tests

```sh
npm test
```
