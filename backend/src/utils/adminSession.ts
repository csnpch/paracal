import crypto from 'crypto';

const sessions = new Map<string, number>();
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export function createAdminSession(): string {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, Date.now() + SESSION_TTL_MS);
  return token;
}

export function isValidAdminSession(token: string | undefined | null): boolean {
  if (!token) return false;

  const expiresAt = sessions.get(token);
  if (!expiresAt) return false;

  if (Date.now() > expiresAt) {
    sessions.delete(token);
    return false;
  }

  return true;
}

export function revokeAdminSession(token: string | undefined | null): void {
  if (!token) return;
  sessions.delete(token);
}

export function getBearerToken(authorization: string | undefined): string | undefined {
  if (!authorization) return undefined;
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim();
}

export function assertAdminAuth(authorization: string | undefined): void {
  const token = getBearerToken(authorization);
  if (!isValidAdminSession(token)) {
    throw new Error('Unauthorized');
  }
}
