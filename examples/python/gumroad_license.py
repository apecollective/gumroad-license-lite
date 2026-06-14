"""Verify Gumroad license keys from Python — single file, standard library only.

    from gumroad_license import verify_gumroad_license
    r = verify_gumroad_license("YOUR_PRODUCT_ID", license_key)
    if r["valid"]:
        unlock(r["email"])

Like the JS version, this is an *online* check. It does not do offline tamper-proof tokens,
device binding, seat limits, or refund lockout — see KeyGate for those.
"""

import json
import urllib.error
import urllib.parse
import urllib.request

GUMROAD_VERIFY_URL = "https://api.gumroad.com/v2/licenses/verify"


def verify_gumroad_license(product_id, license_key, increment_uses_count=False):
    if not product_id:
        raise ValueError("product_id is required")
    if not license_key:
        raise ValueError("license_key is required")

    data = urllib.parse.urlencode(
        {
            "product_id": product_id,
            "license_key": license_key,
            "increment_uses_count": "true" if increment_uses_count else "false",
        }
    ).encode()

    try:
        with urllib.request.urlopen(
            urllib.request.Request(GUMROAD_VERIFY_URL, data=data), timeout=10
        ) as resp:
            body = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:  # Gumroad returns 404 + JSON for unknown keys
        try:
            body = json.loads(e.read().decode())
        except Exception:
            body = None
    except Exception as e:  # network failure
        return {"valid": False, "success": False, "reason": "network-error", "error": str(e)}

    if not body or not body.get("success"):
        return {"valid": False, "success": False, "reason": "invalid-key"}

    p = body.get("purchase") or {}
    refunded = bool(p.get("refunded"))
    disputed = bool(p.get("disputed") or p.get("chargebacked"))
    sub_ended = bool(
        p.get("subscription_cancelled_at")
        or p.get("subscription_failed_at")
        or p.get("subscription_ended_at")
    )
    valid = not (refunded or disputed or sub_ended)
    reason = None
    if not valid:
        reason = "refunded" if refunded else "disputed" if disputed else "subscription-ended"

    return {
        "valid": valid,
        "success": True,
        "reason": reason,
        "email": p.get("email"),
        "uses": body.get("uses"),
        "refunded": refunded,
        "disputed": disputed,
        "subscription_ended": sub_ended,
        "purchase": p,
    }


if __name__ == "__main__":
    import sys

    if len(sys.argv) != 3:
        print("usage: python gumroad_license.py <product_id> <license_key>")
        sys.exit(1)
    result = verify_gumroad_license(sys.argv[1], sys.argv[2])
    if result["valid"]:
        print(f"✓ valid — licensed to {result['email']} (uses: {result['uses']})")
    else:
        print(f"✗ not valid — {result['reason']}")
