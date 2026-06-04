import {
  CognitoIdentityProviderClient,
  ForgotPasswordCommand,
  GetUserCommand,
  InitiateAuthCommand,
  SignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider';

type StoredSession = {
  accessToken: string;
  idToken?: string;
  refreshToken?: string;
  expiresAt?: number;
};

export type AuthenticatedUser = {
  id: string;
  email?: string;
};

const sessionStorageKey = 'lyrtrip:cognito-session';

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

  const rawSession = window.localStorage.getItem(sessionStorageKey);
  return rawSession ? (JSON.parse(rawSession) as StoredSession) : null;
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

function userFromToken(token: string): AuthenticatedUser {
  const [, payload] = token.split('.');
  const claims = JSON.parse(window.atob(payload)) as { sub: string; email?: string };

  return {
    id: claims.sub,
    email: claims.email,
  };
}

/**
 * Get the current user session
 */
export async function getSession() {
  return getStoredSession();
}

/**
 * Get the current authenticated user
 */
export async function getUser(): Promise<AuthenticatedUser | null> {
  const session = getStoredSession();

  if (!session?.accessToken) {
    return null;
  }

  try {
    const response = await getClient().send(
      new GetUserCommand({ AccessToken: session.accessToken })
    );
    const email = response.UserAttributes?.find(attribute => attribute.Name === 'email')?.Value;

    return {
      id: response.Username || userFromToken(session.accessToken).id,
      email,
    };
  } catch {
    clearStoredSession();
    return null;
  }
}

/**
 * Sign up a new user with email and password
 */
export async function signUp(email: string, password: string) {
  try {
    await getClient().send(
      new SignUpCommand({
        ClientId: getConfig().clientId,
        Username: email,
        Password: password,
        UserAttributes: [{ Name: 'email', Value: email }],
      })
    );

    return { data: { user: null }, error: null };
  } catch (error) {
    return { data: { user: null }, error: error as Error };
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

export function getAccessToken() {
  return getStoredSession()?.accessToken || null;
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
