---
name: OpenRouter Cyrillic header bug
description: Node.js fetch (Undici) rejects non-ASCII characters in HTTP header values — Cyrillic in X-Title caused fetch to throw a ByteString error.
---

## Rule
HTTP header values sent via Node.js `fetch` (Undici) must be ASCII-only. Non-ASCII characters (e.g. Cyrillic) cause fetch to throw `"Cannot convert argument to a ByteString because the character at index N has a value > 255"` — this surfaces as a generic network error, masking the real cause.

**Why:** Node.js Undici enforces the HTTP/1.1 ByteString constraint on header values. The `X-Title` header had `"РемонтPRO AI-тренер"` which starts with Р (U+0420 = 1056).

**How to apply:** Always use ASCII-only strings in all HTTP header values, including `X-Title`, `X-App-Name`, custom headers, etc. If a display name is needed, use a transliterated ASCII version.
