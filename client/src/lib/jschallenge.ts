/**
 * JavaScript Challenge - DISABLED
 * All bot detection removed to allow all agents and ad networks
 */

export async function runJSChallenge(): Promise<boolean> {
  return true;
}

export function hasUserInteracted(): boolean {
  return true;
}

export function getInteractionTime(): number {
  return Date.now();
}
