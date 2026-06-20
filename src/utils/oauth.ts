const OAUTH_TOKEN_KEY = "google_oauth_token";
const OAUTH_TOKEN_EXPIRY_KEY = "google_oauth_token_expiry";
const OAUTH_REFRESH_KEY = "google_oauth_refresh_token";
const SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"];

export interface OAuthToken {
  accessToken: string;
  expiresAt: number;
  refreshToken?: string;
}

export interface TokenStatus {
  valid: boolean;
  expired: boolean;
  expiresIn: number;
}

function getExpiresIn(expiresAt: number): number {
  return Math.max(0, expiresAt - Date.now());
}

export async function getStoredToken(): Promise<OAuthToken | null> {
  const data = await chrome.storage.local.get([
    OAUTH_TOKEN_KEY,
    OAUTH_TOKEN_EXPIRY_KEY,
    OAUTH_REFRESH_KEY,
  ]);
  const accessToken = data[OAUTH_TOKEN_KEY];
  const expiresAt = data[OAUTH_TOKEN_EXPIRY_KEY];
  if (!accessToken || !expiresAt) {
    return null;
  }
  return {
    accessToken,
    expiresAt,
    refreshToken: data[OAUTH_REFRESH_KEY] ?? undefined,
  };
}

export async function storeToken(token: OAuthToken): Promise<void> {
  const data: Record<string, string | number> = {
    [OAUTH_TOKEN_KEY]: token.accessToken,
    [OAUTH_TOKEN_EXPIRY_KEY]: token.expiresAt,
  };
  if (token.refreshToken) {
    data[OAUTH_REFRESH_KEY] = token.refreshToken;
  }
  await chrome.storage.local.set(data);
}

export async function clearToken(): Promise<void> {
  await chrome.storage.local.remove([OAUTH_TOKEN_KEY, OAUTH_TOKEN_EXPIRY_KEY, OAUTH_REFRESH_KEY]);
}

export function checkTokenStatus(token: OAuthToken): TokenStatus {
  const expiresIn = getExpiresIn(token.expiresAt);
  return {
    valid: expiresIn > 0,
    expired: expiresIn <= 0,
    expiresIn,
  };
}

async function refreshTokenViaChromeIdentity(): Promise<OAuthToken | null> {
  return new Promise<OAuthToken | null>((resolve) => {
    chrome.identity.getAuthToken({ interactive: false, scopes: SCOPES }, (token) => {
      if (chrome.runtime.lastError || !token) {
        resolve(null);
        return;
      }
      resolve({
        accessToken: token,
        expiresAt: Date.now() + 3600_000,
      });
    });
  });
}

export async function getValidToken(): Promise<string | null> {
  const stored = await getStoredToken();

  if (stored) {
    const status = checkTokenStatus(stored);
    if (status.valid) {
      if (status.expiresIn < 300_000) {
        const refreshed = await refreshTokenViaChromeIdentity();
        if (refreshed) {
          await storeToken(refreshed);
          return refreshed.accessToken;
        }
      }
      return stored.accessToken;
    }
  }

  const fresh = await refreshTokenViaChromeIdentity();
  if (fresh) {
    await storeToken(fresh);
    return fresh.accessToken;
  }

  return null;
}

export function getTokenExpiryWarning(token: OAuthToken): string | null {
  const status = checkTokenStatus(token);
  if (status.expired) {
    return "Your session has expired. Please sign in again to continue.";
  }
  if (status.expiresIn < 300_000) {
    const seconds = Math.floor(status.expiresIn / 1000);
    return `Your session will expire in ${seconds} seconds.`;
  }
  return null;
}
