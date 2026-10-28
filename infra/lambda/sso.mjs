import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// Sign-in between Lyrtrip and Lyrshop. One app vouches for its signed-in user to the other with a short-lived
// handoff token, signed with a key both derive from the partner key they already share (LYRSHOP_PARTNER_KEY).
// The token names the app it's for and the state the other app made when it sent the person over, so it can't
// be replayed elsewhere or slipped into someone else's browser. Same format as Lyrshop's auth_core.issue_handoff.

export const HANDOFF_TTL_SECONDS = 120;
export const STATE_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

const b64 = buffer => Buffer.from(buffer).toString('base64url');
const sign = (key, payload) => b64(createHmac('sha256', key).update(payload).digest());

export function handoffKey(partnerKey) {
  return createHmac('sha256', partnerKey).update('lyr-sso-v1').digest('hex');
}

export function issueHandoff(key, { issuer, audience, state, email = '', phone = '', name = '' }, now = Date.now()) {
  const iat = Math.floor(now / 1000);
  const claims = { iss: issuer, aud: audience, state, email, phone, name, iat, exp: iat + HANDOFF_TTL_SECONDS, jti: b64(randomBytes(16)) };
  const payload = b64(JSON.stringify(claims));
  return `${payload}.${sign(key, payload)}`;
}

const same = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};

// The handoff's claims when it's signed with key, from issuer, for audience and state, and not expired; else null.
// Callers still make sure each jti is used only once.
export function readHandoff(key, token, { issuer, audience, state }, now = Date.now()) {
  const [payload, signature, extra] = String(token ?? '').split('.');
  if (!payload || !signature || extra !== undefined || !same(signature, sign(key, payload))) return null;
  let claims;
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (claims.iss !== issuer || claims.aud !== audience || !state || !same(claims.state ?? '', state)) return null;
  if (!claims.jti || !(Number(claims.exp) > Math.floor(now / 1000))) return null;
  return claims.email || claims.phone ? claims : null;
}
