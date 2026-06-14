export interface GumroadVerifyResult {
  /** True only if the key is real AND not refunded/disputed/subscription-ended. */
  valid: boolean;
  /** True if Gumroad recognized the key at all. */
  success: boolean;
  /** null when valid; otherwise 'invalid-key' | 'refunded' | 'disputed' | 'subscription-ended' | 'network-error'. */
  reason: string | null;
  email?: string;
  /** Gumroad's global activation counter for this key (not per-device). */
  uses?: number;
  refunded?: boolean;
  disputed?: boolean;
  subscriptionEnded?: boolean;
  purchase?: Record<string, unknown>;
  raw?: unknown;
  error?: string;
}

export interface VerifyOptions {
  productId: string;
  licenseKey: string;
  /** Increment Gumroad's uses counter on this check. Default false. */
  incrementUsesCount?: boolean;
  /** Inject a fetch implementation (for testing). */
  fetchImpl?: typeof fetch;
}

export function verifyGumroadLicense(options: VerifyOptions): Promise<GumroadVerifyResult>;

export interface LicenseGateOptions {
  productId: string;
  /** Path to a writable JSON file (e.g. Electron's app.getPath('userData') + '/license.json'). */
  storageFile: string;
  /** Re-check online after this many days. Default 3. */
  recheckEveryDays?: number;
  /** Keep working offline for this many days since the last successful check. Default 14. */
  offlineGraceDays?: number;
  fetchImpl?: typeof fetch;
}

export interface GateResult {
  licensed: boolean;
  email?: string;
  reason?: string;
  fromCache?: boolean;
  offline?: boolean;
}

export class LicenseGate {
  constructor(options: LicenseGateOptions);
  activate(licenseKey: string): Promise<GateResult>;
  check(): Promise<GateResult>;
  deactivate(): GateResult;
}
