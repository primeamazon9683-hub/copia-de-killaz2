// Shared reference to the in-memory rate limit banned IPs set
// This allows the Telegram webhook to clear bans from memory

let _rateLimitBannedIPs: Set<string> | null = null;

export function setRateLimitBannedIPs(set: Set<string>) {
  _rateLimitBannedIPs = set;
}

export function clearRateLimitBan(ip: string): boolean {
  if (_rateLimitBannedIPs && _rateLimitBannedIPs.has(ip)) {
    _rateLimitBannedIPs.delete(ip);
    return true;
  }
  return false;
}
