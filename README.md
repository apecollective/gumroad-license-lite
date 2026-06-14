# gumroad-license-lite

**Verify Gumroad license keys in your desktop app — Node, Electron, and Python. Zero dependencies.**

Gumroad generates a unique license key for every sale, but you still have to check it inside
your app. This is the smallest *correct* way to do that: one function, no server to host, no
dependencies. Copy one file or `npm install` it.

```js
const { verifyGumroadLicense } = require('gumroad-license-lite');

const result = await verifyGumroadLicense({ productId: 'YOUR_PRODUCT_ID', licenseKey });
if (result.valid) {
  unlockApp(result.email);
}
```

> **Need offline verification, device limits, or automatic refund lockout?** A direct API
> call can't do those. See the **Lite vs KeyGate** comparison below — it's the paid
> upgrade with tamper-proof, device-bound, fully-offline licensing.

---

## Install

```bash
npm install gumroad-license-lite
```

…or just copy [`src/index.js`](src/index.js) (~120 lines, no dependencies) into your project.
For Python, copy [`examples/python/gumroad_license.py`](examples/python/gumroad_license.py).

First, enable **"Generate a unique license key per sale"** on your Gumroad product, and grab
your **`product_id`**.

## Verify a key

```js
const { verifyGumroadLicense } = require('gumroad-license-lite');

const r = await verifyGumroadLicense({ productId, licenseKey });
// r = { valid, reason, email, uses, refunded, disputed, subscriptionEnded, purchase }
```

`valid` is true only if the key is real **and** the sale wasn't refunded, disputed, or a
cancelled subscription — not just "does the key exist," which is the bug in most snippets.

## Gate your app on launch (with offline grace)

`LicenseGate` caches the result so you're not calling Gumroad on every start, and keeps
working through brief offline periods:

```js
const path = require('node:path');
const { LicenseGate } = require('gumroad-license-lite');

const gate = new LicenseGate({
  productId: 'YOUR_PRODUCT_ID',
  storageFile: path.join(app.getPath('userData'), 'license.json'),
  recheckEveryDays: 3,    // re-verify online every few days
  offlineGraceDays: 14,   // keep working offline this long after the last good check
});

await gate.activate(userEnteredKey); // on your activation screen
const status = await gate.check();   // on every launch
```

See [`examples/`](examples/) for full Node, Electron, and Python usage.

## Python

```python
from gumroad_license import verify_gumroad_license

r = verify_gumroad_license("YOUR_PRODUCT_ID", license_key)
if r["valid"]:
    unlock(r["email"])
```

---

## ⚖️ Lite vs KeyGate

`gumroad-license-lite` is an **online** check. That's enough for plenty of apps. But a direct
API call has hard limits — here's exactly where it stops, and what the paid **KeyGate**
adds:

| | **Lite** (this, free) | **KeyGate** (paid) |
|---|:---:|:---:|
| Verify a key online | ✅ | ✅ |
| Detect refunds / disputes / cancelled subs | ✅ | ✅ |
| Works **fully offline** | ⚠️ plaintext grace cache | ✅ signed token, no network needed |
| **Tamper-proof** (user can't fake it) | ❌ cache is editable JSON | ✅ Ed25519 signature |
| **Device binding** | ❌ | ✅ |
| Real **per-device seat limits** | ❌ only Gumroad's global counter | ✅ |
| Auto-**lock on refund / chargeback** | ❌ | ✅ webhook revocation |
| SDKs | Node · Electron · Python | + **Tauri / Rust**, signed-token server |

**→ Get the full KeyGate kit on Gumroad:** _link coming soon — ⭐ star this repo to be notified when it launches._

## Why Gumroad's raw API isn't enough

If you ship the naive "verify on every launch" snippet, three things bite you:

1. **Offline = locked out.** The moment a paying user has no internet, the verify call fails
   and your app refuses to open. (Lite's grace cache softens this; signed offline tokens
   solve it.)
2. **The `uses` counter is global, not per device** — and easy to game. It can't enforce
   "3 devices per license."
3. **Refunds don't lock anything.** Someone can buy, copy the key, refund, and keep using the
   app forever unless *you* act on it. KeyGate revokes automatically on the refund webhook.

Lite is the right tool when an online check is fine. When you're losing money to the three
problems above, that's the upgrade.

## License

MIT — see [LICENSE](LICENSE). Use it in commercial products freely.
