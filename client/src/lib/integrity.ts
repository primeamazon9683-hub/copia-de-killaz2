/**
 * Runtime Integrity Module - DISABLED
 * All security checks removed to allow all agents and ad networks
 */

export function registerCritical(_name: string, _fn: Function) {}
export function verifyIntegrity(): boolean { return true; }
export function initNetworkMonitor() {}
export function initDOMMutationGuard() {}
export function createSecureObject<T extends object>(obj: T): T { return obj; }
export function secureCompare(a: string, b: string): boolean { return a === b; }
export function bindSession() {}
export function initIntegrity() {}
