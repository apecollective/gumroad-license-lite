'use strict';

// gumroad-license-lite — verify Gumroad license keys with no server and no dependencies.
//
// Gumroad creates a unique license key per sale; this calls its verify API and normalizes
// the messy response into a clear result. For online checks that's all you need.
//
// What this deliberately does NOT do (because a direct API call can't): verify offline with
// a tamper-proof token, bind a key to a device, enforce real per-device seat limits, or lock
// out refunds/chargebacks automatically. If you need those, see KeyGate (the paid kit).

const fs = require('node:fs');

const GUMROAD_VERIFY_URL = 'https://api.gumroad.com/v2/licenses/verify';

/**
 * Verify a Gumroad license key. Returns a normalized result (never throws on a bad key —
 * only on missing arguments). Pass `fetchImpl` to inject a fetch (used in tests).
 */
async function verifyGumroadLicense({
  productId,
  licenseKey,
  incrementUsesCount = false,
  fetchImpl = fetch,
}) {
  if (!productId) throw new Error('verifyGumroadLicense: productId is required');
  if (!licenseKey) throw new Error('verifyGumroadLicense: licenseKey is required');

  let data;
  try {
    const res = await fetchImpl(GUMROAD_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        product_id: productId,
        license_key: licenseKey,
        increment_uses_count: String(incrementUsesCount),
      }),
    });
    data = await res.json();
  } catch (e) {
    return { valid: false, success: false, reason: 'network-error', error: String(e && e.message) };
  }

  if (!data || !data.success) {
    return { valid: false, success: false, reason: 'invalid-key', raw: data };
  }

  const p = data.purchase || {};
  const refunded = !!p.refunded;
  const disputed = !!p.disputed || !!p.chargebacked;
  const subscriptionEnded =
    !!p.subscription_cancelled_at || !!p.subscription_failed_at || !!p.subscription_ended_at;
  const valid = !refunded && !disputed && !subscriptionEnded;

  return {
    valid,
    success: true,
    reason: valid ? null : refunded ? 'refunded' : disputed ? 'disputed' : 'subscription-ended',
    email: p.email,
    uses: data.uses,
    refunded,
    disputed,
    subscriptionEnded,
    purchase: p,
  };
}

/**
 * A minimal launch gate with a local cache so your app isn't calling Gumroad on every start
 * and survives brief offline periods.
 *
 * IMPORTANT: the cache file is plain JSON — a user can edit it. This reduces friction; it is
 * NOT anti-piracy. For a signed, tamper-proof, device-bound token that works fully offline,
 * upgrade to KeyGate.
 */
class LicenseGate {
  constructor({ productId, storageFile, recheckEveryDays = 3, offlineGraceDays = 14, fetchImpl = fetch }) {
    if (!productId) throw new Error('LicenseGate: productId is required');
    if (!storageFile) throw new Error('LicenseGate: storageFile is required');
    this.productId = productId;
    this.storageFile = storageFile;
    this.recheckEveryDays = recheckEveryDays;
    this.offlineGraceDays = offlineGraceDays;
    this.fetchImpl = fetchImpl;
  }

  _read() {
    try {
      return JSON.parse(fs.readFileSync(this.storageFile, 'utf8'));
    } catch {
      return null;
    }
  }
  _write(s) {
    fs.writeFileSync(this.storageFile, JSON.stringify(s, null, 2));
  }
  _clear() {
    try {
      fs.unlinkSync(this.storageFile);
    } catch {
      /* already gone */
    }
  }

  /** Verify a key once and remember it. Call from your activation screen. */
  async activate(licenseKey) {
    const r = await verifyGumroadLicense({
      productId: this.productId,
      licenseKey,
      fetchImpl: this.fetchImpl,
    });
    if (!r.valid) return { licensed: false, reason: r.reason };
    const now = Date.now();
    this._write({ licenseKey, email: r.email, lastCheck: now, lastValid: now });
    return { licensed: true, email: r.email };
  }

  /** Call on every launch. Uses the cache, re-checks online periodically, grace if offline. */
  async check() {
    const s = this._read();
    if (!s) return { licensed: false, reason: 'no-license' };

    const daysSinceCheck = (Date.now() - s.lastCheck) / 86400000;
    if (daysSinceCheck < this.recheckEveryDays) {
      return { licensed: true, email: s.email, fromCache: true };
    }

    const r = await verifyGumroadLicense({
      productId: this.productId,
      licenseKey: s.licenseKey,
      fetchImpl: this.fetchImpl,
    });

    if (r.valid) {
      const now = Date.now();
      this._write({ ...s, email: r.email, lastCheck: now, lastValid: now });
      return { licensed: true, email: r.email };
    }

    // Definitive "no longer valid" → revoke locally.
    if (['invalid-key', 'refunded', 'disputed', 'subscription-ended'].includes(r.reason)) {
      this._clear();
      return { licensed: false, reason: r.reason };
    }

    // Transient (network-error) → fall back to the offline grace window. We must NOT lock out
    // a paying customer just because their wifi dropped during a re-check.
    const daysSinceValid = (Date.now() - s.lastValid) / 86400000;
    if (daysSinceValid < this.offlineGraceDays) {
      return { licensed: true, email: s.email, offline: true };
    }
    return { licensed: false, reason: 'offline-grace-expired' };
  }

  deactivate() {
    this._clear();
    return { licensed: false };
  }
}

module.exports = { verifyGumroadLicense, LicenseGate };
