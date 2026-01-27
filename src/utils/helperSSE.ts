import { verifyJwt } from './jwt';

export function getUserIdFromToken(token: string): string | null {
  try {
    const decoded = verifyJwt<{ sub: string }>(token, 'accessTokenPublicKey');
    return decoded?.sub || null;
  } catch {
    return null;
  }
}
