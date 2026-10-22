import {
  CognitoIdentityProviderClient,
  ConfirmForgotPasswordCommand,
  ConfirmSignUpCommand,
  ForgotPasswordCommand,
  GetUserCommand,
  InitiateAuthCommand,
  ResendConfirmationCodeCommand,
  SignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider';

type StoredSession = {
  accessToken: string;
  idToken?: string;
  refreshToken?: string;
  expiresAt?: number;
};

export type AuthProvider = 'cognito' | 'Google' | 'Facebook' | 'WeChat' | 'Phone';

export type AuthenticatedUser = {
  id: string;
  email?: string;
  phone?: string;
  name?: string;
  picture?: string;
  provider?: AuthProvider;
};

const sessionStorageKey = 'lyrtrip:cognito-session';
const pkceStorageKey = 'lyrtrip:pkce-verifier';
const redirectStorageKey = 'lyrtrip:oauth-redirect';

function getConfig() {
  const region = process.env.NEXT_PUBLIC_COGNITO_REGION;
  const clientId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID;

  if (!region || !clientId) {
    throw new Error('Missing Cognito environment configuration.');
  }

  return { region, clientId };
}

function getClient() {
  return new CognitoIdentityProviderClient({ region: getConfig().region });
}

function getStoredSession(): StoredSession | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const rawSession = window.localStorage.getItem(sessionStorageKey);
    return rawSession ? (JSON.parse(rawSession) as StoredSession) : null;
  } catch {
    return null;
  }
}

function setStoredSession(session: StoredSession) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(sessionStorageKey, JSON.stringify(session));
  }
}

function clearStoredSession() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(sessionStorageKey);
  }
}

function decodeJwt(token: string): Record<string, unknown> {
  const [, payload] = token.split('.');
  return JSON.parse(window.atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as Record<string, unknown>;
}

function providerFromIdentities(claims: Record<string, unknown>): AuthProvider {
  const identities = claims.identities;

  if (typeof identities === 'string') {
    try {
      const parsed = JSON.parse(identities) as Array<{ providerName?: string }>;
      const providerName = parsed[0]?.providerName;
      if (providerName === 'Google' || providerName === 'Facebook') {
        return providerName;
      }
    } catch {
      // ignore malformed identities claim
    }
  }

  if (typeof claims['custom:wechat_openid'] === 'string') {
    return 'WeChat';
  }

  return 'cognito';
}

// Mobile-number accounts sign in with a stand-in address made from the number
// (the user pool only takes emails as usernames). It is never mailed, so the
// site shows and pre-fills the phone number instead.
const phoneLoginDomain = 'phone.lyrtrip.com';
export const phoneLoginEmail = (phone: string) => `${phone.replace(/^\+/, '')}@${phoneLoginDomain}`;
const isPhoneLoginEmail = (email?: string) => !!email?.toLowerCase().endsWith(`@${phoneLoginDomain}`);

function userFromToken(token: string): AuthenticatedUser {
  const claims = decodeJwt(token);
  const email = typeof claims.email === 'string' ? claims.email : undefined;
  const isPhone = isPhoneLoginEmail(email);

  return {
    id: String(claims.sub),
    email: isPhone ? undefined : email,
    phone: typeof claims.phone_number === 'string' ? claims.phone_number : undefined,
    name: typeof claims.name === 'string' ? claims.name : undefined,
    picture: typeof claims.picture === 'string' ? claims.picture : undefined,
    provider: isPhone ? 'Phone' : providerFromIdentities(claims),
  };
}

// When the saved tokens stop working: expiresAt, or the ID token's own exp claim
function sessionExpiry(session: StoredSession): number {
  if (session.expiresAt) return session.expiresAt;
  try {
    const exp = Number(decodeJwt(session.idToken || session.accessToken).exp);
    return exp ? exp * 1000 : 0;
  } catch {
    return 0;
  }
}

let refreshing: Promise<StoredSession | null> | null = null;

// Cognito tokens last an hour; a saved session older than that is renewed with its refresh token.
// Without this, API calls from a tab or browser kept open went out with an expired token and failed.
async function freshSession(): Promise<StoredSession | null> {
  const session = getStoredSession();
  if (!session?.accessToken) return null;
  if (sessionExpiry(session) - Date.now() > 120_000) return session;
  if (!session.refreshToken) {
    clearStoredSession();
    return null;
  }
  refreshing ??= (async () => {
    try {
      const response = await getClient().send(
        new InitiateAuthCommand({
          AuthFlow: 'REFRESH_TOKEN_AUTH',
          ClientId: getConfig().clientId,
          AuthParameters: { REFRESH_TOKEN: session.refreshToken! },
        })
      );
      const result = response.AuthenticationResult;
      if (!result?.AccessToken) throw Object.assign(new Error('No token'), { name: 'NotAuthorizedException' });
      const renewed: StoredSession = {
        accessToken: result.AccessToken,
        idToken: result.IdToken ?? session.idToken,
        refreshToken: result.RefreshToken ?? session.refreshToken,
        expiresAt: result.ExpiresIn ? Date.now() + result.ExpiresIn * 1000 : undefined,
      };
      setStoredSession(renewed);
      return renewed;
    } catch (error) {
      // A refused refresh token means signed out; a network failure keeps the session for the next try
      if ((error as Error)?.name === 'NotAuthorizedException') {
        clearStoredSession();
        return null;
      }
      return session;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/**
 * Get the current user session, renewing expired tokens first
 */
export async function getSession() {
  return freshSession();
}

/**
 * Get the current authenticated user. Prefers locally decoded ID-token
 * claims (name/picture/provider) and falls back to/merges with a live
 * Cognito GetUser call for the canonical email and username.
 */
export async function getUser(): Promise<AuthenticatedUser | null> {
  const session = await freshSession();

  if (!session?.accessToken) {
    return null;
  }

  const fromIdToken = session.idToken ? userFromToken(session.idToken) : null;

  try {
    const response = await getClient().send(
      new GetUserCommand({ AccessToken: session.accessToken })
    );
    const attribute = (name: string) => response.UserAttributes?.find(a => a.Name === name)?.Value;
    const email = attribute('email');

    return {
      id: response.Username || fromIdToken?.id || userFromToken(session.accessToken).id,
      email: isPhoneLoginEmail(email) ? undefined : email || fromIdToken?.email,
      phone: attribute('phone_number') || fromIdToken?.phone,
      name: fromIdToken?.name,
      picture: fromIdToken?.picture,
      provider: fromIdToken?.provider,
    };
  } catch {
    if (fromIdToken) {
      return fromIdToken;
    }
    clearStoredSession();
    return null;
  }
}

/**
 * Sign up a new user with email and password. Cognito requires the
 * returned confirmation code to be submitted via confirmSignUp before
 * the account can sign in.
 */
export async function signUp(email: string, password: string, name?: string) {
  try {
    const result = await getClient().send(
      new SignUpCommand({
        ClientId: getConfig().clientId,
        Username: email,
        Password: password,
        UserAttributes: [
          { Name: 'email', Value: email },
          ...(name ? [{ Name: 'name', Value: name }] : []),
        ],
      })
    );

    return {
      data: { user: null, confirmed: result.UserConfirmed ?? false },
      error: null,
    };
  } catch (error) {
    return { data: { user: null, confirmed: false }, error: error as Error };
  }
}

/**
 * Confirm a newly created account with the code emailed by Cognito.
 */
export async function confirmSignUp(email: string, code: string) {
  try {
    await getClient().send(
      new ConfirmSignUpCommand({
        ClientId: getConfig().clientId,
        Username: email,
        ConfirmationCode: code,
      })
    );

    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
}

/**
 * Resend the email confirmation code for an unconfirmed account.
 */
export async function resendConfirmationCode(email: string) {
  try {
    await getClient().send(
      new ResendConfirmationCodeCommand({
        ClientId: getConfig().clientId,
        Username: email,
      })
    );

    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
}

/**
 * Sign in a user with email and password
 */
export async function signIn(email: string, password: string) {
  try {
    const response = await getClient().send(
      new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: getConfig().clientId,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
        },
      })
    );

    const result = response.AuthenticationResult;

    if (!result?.AccessToken) {
      throw new Error('Cognito did not return an access token.');
    }

    const expiresAt = result.ExpiresIn
      ? Date.now() + result.ExpiresIn * 1000
      : undefined;

    setStoredSession({
      accessToken: result.AccessToken,
      idToken: result.IdToken,
      refreshToken: result.RefreshToken,
      expiresAt,
    });

    return { data: { user: userFromToken(result.AccessToken) }, error: null };
  } catch (error) {
    return { data: { user: null }, error: error as Error };
  }
}

// Mobile sign-up and password resets: the Lambda texts and checks the code
// (Twilio Verify) and sets the password, then the site signs in normally.
async function postPhoneAuth(action: 'send' | 'register' | 'reset', body: Record<string, string>) {
  try {
    const baseUrl = (process.env.NEXT_PUBLIC_SEARCH_LAMBDA_URL ?? '').replace(/\/$/, '');
    const response = await fetch(`${baseUrl}/api/auth/phone/${action}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Mobile sign-in is unavailable right now.');
    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
}

export const sendPhoneCode = (phone: string, purpose: 'signup' | 'reset') =>
  postPhoneAuth('send', { phone, purpose });

export const signUpWithPhone = (phone: string, code: string, password: string, name?: string) =>
  postPhoneAuth('register', { phone, code, password, name: name ?? '' });

export const resetPasswordWithPhone = (phone: string, code: string, password: string) =>
  postPhoneAuth('reset', { phone, code, password });

/**
 * Sign out the current user
 */
export async function signOut() {
  clearStoredSession();
  return { error: null };
}

/**
 * Reset password for a user
 */
export async function resetPassword(email: string) {
  try {
    await getClient().send(
      new ForgotPasswordCommand({
        ClientId: getConfig().clientId,
        Username: email,
      })
    );

    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
}

/**
 * Finish a password reset with the code emailed by resetPassword.
 */
export async function confirmResetPassword(email: string, code: string, newPassword: string) {
  try {
    await getClient().send(
      new ConfirmForgotPasswordCommand({
        ClientId: getConfig().clientId,
        Username: email,
        ConfirmationCode: code,
        Password: newPassword,
      })
    );

    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
}

export function getAccessToken() {
  return getStoredSession()?.accessToken || null;
}

// ---------------------------------------------------------------------------
// Federated sign-in (Google / Facebook via Cognito Hosted UI, WeChat via a
// custom Lambda bridge). These flows are full-page redirects rather than SDK
// calls, since the static-exported frontend has no server runtime to host
// confidential OAuth callbacks.
// ---------------------------------------------------------------------------

function getRedirectUri(path: string) {
  return `${window.location.origin}${path}`;
}

// Inside the Android app, Google refuses to sign in within the WebView
// (403 disallowed_useragent), so the Hosted UI opens in a Chrome Custom Tab
// and redirects to the app's own scheme. MainActivity catches that and loads
// /auth/callback in the WebView, where the PKCE verifier is waiting.
const appRedirectUri = 'com.lyrtrip.app://auth/callback';

type CapacitorBrowser = { open(options: { url: string }): Promise<void> };

function getNativeBrowser(): CapacitorBrowser | null {
  const capacitor = (window as unknown as {
    Capacitor?: { isNativePlatform?: () => boolean; Plugins?: { Browser?: CapacitorBrowser } };
  }).Capacitor;
  return capacitor?.isNativePlatform?.() ? capacitor.Plugins?.Browser ?? null : null;
}

function base64UrlEncode(bytes: ArrayBuffer | Uint8Array) {
  const buffer = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  buffer.forEach(byte => {
    binary += String.fromCharCode(byte);
  });

  return window
    .btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function generateRandomString(length = 64) {
  const bytes = new Uint8Array(length);
  window.crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function generatePkcePair() {
  const verifier = generateRandomString(64);
  const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: base64UrlEncode(digest) };
}

function getHostedUiDomain() {
  const domain = process.env.NEXT_PUBLIC_COGNITO_DOMAIN;

  if (!domain) {
    throw new Error('Missing NEXT_PUBLIC_COGNITO_DOMAIN environment configuration.');
  }

  return domain;
}

/**
 * Redirect to the Cognito Hosted UI for a federated identity provider
 * ("Google" or "Facebook") that has been configured on the User Pool.
 */
export async function signInWithFederatedProvider(provider: 'Google' | 'Facebook') {
  const { clientId } = getConfig();
  const domain = getHostedUiDomain();
  const { verifier, challenge } = await generatePkcePair();
  const nativeBrowser = getNativeBrowser();
  const redirectUri = nativeBrowser ? appRedirectUri : getRedirectUri('/auth/callback');

  // localStorage, not sessionStorage: the app may recreate the WebView while
  // the Custom Tab is open.
  window.localStorage.setItem(pkceStorageKey, verifier);
  window.localStorage.setItem(redirectStorageKey, redirectUri);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    identity_provider: provider,
    scope: 'openid email profile',
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });

  const authorizeUrl = `https://${domain}/oauth2/authorize?${params.toString()}`;
  if (nativeBrowser) {
    await nativeBrowser.open({ url: authorizeUrl });
    return { openedInTab: true };
  }
  window.location.href = authorizeUrl;
  return { openedInTab: false };
}

export const signInWithGoogle = () => signInWithFederatedProvider('Google');
export const signInWithFacebook = () => signInWithFederatedProvider('Facebook');

/**
 * Exchange an authorization code returned by the Cognito Hosted UI
 * (Google/Facebook sign-in) for a User Pool session.
 */
export async function completeFederatedSignIn(code: string) {
  try {
    const { clientId } = getConfig();
    const domain = getHostedUiDomain();
    const verifier = window.localStorage.getItem(pkceStorageKey) || '';
    const redirectUri = window.localStorage.getItem(redirectStorageKey) || getRedirectUri('/auth/callback');
    window.localStorage.removeItem(pkceStorageKey);
    window.localStorage.removeItem(redirectStorageKey);

    const response = await fetch(`https://${domain}/oauth2/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        code,
        redirect_uri: redirectUri,
        code_verifier: verifier,
      }),
    });

    const body = await response.json();

    if (!response.ok || !body.access_token) {
      throw new Error(body.error_description || body.error || 'Sign-in failed.');
    }

    const expiresAt = body.expires_in ? Date.now() + body.expires_in * 1000 : undefined;

    setStoredSession({
      accessToken: body.access_token,
      idToken: body.id_token,
      refreshToken: body.refresh_token,
      expiresAt,
    });

    return { data: { user: userFromToken(body.id_token || body.access_token) }, error: null };
  } catch (error) {
    return { data: { user: null }, error: error as Error };
  }
}

/**
 * Redirect to WeChat's "Sign in with WeChat" web QR flow. WeChat is not a
 * Cognito-native identity provider, so the returned authorization code is
 * exchanged server-side by our own Lambda (see POST /api/auth/wechat),
 * which bridges into the User Pool via a CUSTOM_AUTH challenge.
 */
export function signInWithWeChat() {
  const appId = process.env.NEXT_PUBLIC_WECHAT_APP_ID;

  if (!appId) {
    throw new Error('Missing NEXT_PUBLIC_WECHAT_APP_ID environment configuration.');
  }

  const state = generateRandomString(16);
  window.sessionStorage.setItem('lyrtrip:wechat-state', state);

  const params = new URLSearchParams({
    appid: appId,
    redirect_uri: getRedirectUri('/auth/wechat/callback'),
    response_type: 'code',
    scope: 'snsapi_login',
    state,
  });

  window.location.href = `https://open.weixin.qq.com/connect/qrconnect?${params.toString()}#wechat_redirect`;
}

/**
 * Exchange a WeChat authorization code (via our Lambda API) for a User
 * Pool session.
 */
export async function completeWeChatSignIn(code: string, state: string) {
  try {
    const expectedState = window.sessionStorage.getItem('lyrtrip:wechat-state');
    window.sessionStorage.removeItem('lyrtrip:wechat-state');

    if (!expectedState || expectedState !== state) {
      throw new Error('Invalid WeChat sign-in state.');
    }

    const response = await fetch('/api/auth/wechat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code }),
    });

    const body = await response.json();

    if (!response.ok || !body.success) {
      throw new Error(body.error || 'WeChat sign-in failed.');
    }

    const { accessToken, idToken, refreshToken, expiresIn } = body.tokens;

    setStoredSession({
      accessToken,
      idToken,
      refreshToken,
      expiresAt: expiresIn ? Date.now() + expiresIn * 1000 : undefined,
    });

    return {
      data: {
        user: {
          ...userFromToken(idToken || accessToken),
          name: body.profile?.nickname || undefined,
          picture: body.profile?.avatar || undefined,
          provider: 'WeChat' as const,
        },
      },
      error: null,
    };
  } catch (error) {
    return { data: { user: null }, error: error as Error };
  }
}

export interface GoogleAutocompleteSuggestion {
    placePrediction?: {
        placeId: string;
    };
    mainText?: {
        text: string;
    } | string;
    secondaryText?: {
        text: string;
    } | string;
    placeId?: string;
    id?: string;
}
