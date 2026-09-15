# Offline Vault v1 public file format

This is an open container around standard AES-256-GCM. No device/account/software identity is required. All integer sizes below are bytes. Strings are ASCII unless stated otherwise.

## Key file (`.key`)

Exactly 40 bytes:

| Offset | Length | Meaning |
|---|---:|---|
| 0 | 8 | Literal ASCII `PKEY0001` |
| 8 | 32 | Raw 256-bit AES key |

Generate key material using the operating system cryptographic random generator (`crypto.getRandomValues` here). A key file is a plaintext secret credential, not password protected. The UI fingerprint is the first 8 bytes of SHA-256(raw key), displayed as 4 groups of 4 hexadecimal digits; it is informational and not a substitute for cryptographic authentication.

## Encrypted file (`.vault`)

| Offset | Length | Meaning |
|---|---:|---|
| 0 | 8 | Literal ASCII `PVLT0001` |
| 8 | 12 | Fresh random GCM nonce |
| 20 | N | AES-256-GCM ciphertext |
| 20+N | 16 | Full 128-bit GCM authentication tag |

Additional authenticated data (AAD) is exactly the eight header bytes `PVLT0001`. Plaintext is strictly UTF-8 encoded text; this application permits 1 to 1,048,576 plaintext bytes. The envelope length is 36 + N. No salt or password derivation is involved: the key has 256 bits of random material. A fresh 96-bit random nonce is generated for every encryption; users must never deliberately reuse a nonce/key pair. This is intended for personal text backups, not a high-volume encryption service.

Do not decode or output any plaintext until GCM authentication succeeds. Reject unsupported headers, invalid lengths, altered/truncated ciphertext, wrong keys, and invalid UTF-8. There is no “ignore authentication failure” mode.

## Legacy HTML import compatibility

A standalone HTML document embeds the envelope as standard canonical padded Base64, with no whitespace, in exactly one element:

```html
<script id="vault-payload" type="application/octet-stream">BASE64_ENVELOPE</script>
```

Current exports save the raw binary envelope directly as `.vault`, with no executable shell, Base64 wrapper, key, plaintext, or application code. The encryption/decryption tool remains a separate webpage. Opening a raw `.vault` file alone does not decrypt it.

For compatibility, the tool can still import old HTML carriers: it extracts exactly one inert payload marker, validates canonical Base64 and the decoded envelope, and never inserts or executes imported HTML. Raw input files are limited to 4 MiB; binary envelopes remain limited to 1 MiB + 36 bytes. Header and length are checked before enabling decryption; AES-GCM authentication is checked before releasing plaintext.

Saved-file verification compares the whole downloaded `.vault` byte-for-byte with the just-exported envelope and then decrypts it. New edits after export are preserved. No live form or webpage serialization is involved in encryption exports.

The tool's HTML/CSP must be trusted. Content Security Policy permits only hashed bundled scripts/styles and denies remote connections/resources. No browser storage, third-party libraries, network APIs or service workers are used by the app. GitHub Pages serves the public tool; secret processing happens in the browser. A downloaded copy of the tool works offline.

## Independent Node.js example (for developers only)

```js
const {createDecipheriv} = require('node:crypto');
// Validate exact key length/header and envelope length/header first.
const key = keyFile.subarray(8); // 32 bytes, after PKEY0001
const d = createDecipheriv('aes-256-gcm', key, envelope.subarray(8, 20));
d.setAAD(Buffer.from('PVLT0001', 'ascii'));
d.setAuthTag(envelope.subarray(-16));
const pending = d.update(envelope.subarray(20, -16));
const final = d.final(); // Throws on wrong key or altered authenticated data.
const plaintext = Buffer.concat([pending, final]); // Only release after final succeeds.
```

## Build and test

Use Node.js 22+ for development. No installation or build is needed for ordinary users of the delivered HTML.

```sh
node build.cjs ./dist/离线私钥保险箱.html
node --test tests/core.test.cjs
```

The build embeds source files and computes exact SHA-256 CSP hashes. `tests/browser.cjs` uses Playwright and a local Chrome installation, opens `dist/离线私钥保险箱.html` by default, and saves only synthetic test artifacts. Set `NODE_PATH` to an environment containing Playwright. Optionally set `VAULT_HTML` to the absolute delivered HTML path and `CHROME_PATH` to your browser executable. On macOS it defaults to installed Google Chrome; other platforms use Playwright's configured Chromium. These development dependencies are not used by the delivered HTML.
