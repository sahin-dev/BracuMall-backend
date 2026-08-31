export type RateLimitRequest = {
  ip?: string;
  ips?: string[];
  socket?: { remoteAddress?: string };
};

export type TrustProxySetting = false | number | string;

export function getRateLimitTracker(request: RateLimitRequest): string {
  const trustedForwardedAddress = request.ips?.find(Boolean);
  return (
    trustedForwardedAddress ||
    request.ip ||
    request.socket?.remoteAddress ||
    'unknown-client'
  );
}

export function parseTrustProxySetting(
  configuredValue?: string,
): TrustProxySetting {
  const value = configuredValue?.trim();
  if (!value || ['false', 'off', 'none', '0'].includes(value.toLowerCase())) {
    return false;
  }
  if (/^[1-9]\d*$/.test(value)) return Number(value);
  return value;
}

export function positiveInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}
