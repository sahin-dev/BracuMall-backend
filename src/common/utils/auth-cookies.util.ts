import type { Response } from 'express';

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

const ACCESS_TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1000; // matches default jwt.expiresIn ('1d')
const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // matches default jwt.refreshExpiresIn ('7d')

function baseCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    // The frontend (Vercel) and backend (a separate host) live on different
    // domains in production — genuinely cross-site, not just cross-port like
    // local dev. A SameSite=Lax cookie is withheld by the browser on every
    // cross-site XHR/fetch, so the session would appear to work on login and
    // then vanish on the very next API call. SameSite=None requires Secure,
    // which requires HTTPS — true in production, and not forced locally
    // where dev typically runs over plain http.
    secure: isProduction,
    sameSite: (isProduction ? 'none' : 'lax') as 'none' | 'lax',
    path: '/',
  };
}

export function setAuthCookies(
  res: Response,
  tokens: { access_token: string; refresh_token: string },
) {
  res.cookie(ACCESS_TOKEN_COOKIE, tokens.access_token, {
    ...baseCookieOptions(),
    maxAge: ACCESS_TOKEN_MAX_AGE_MS,
  });
  res.cookie(REFRESH_TOKEN_COOKIE, tokens.refresh_token, {
    ...baseCookieOptions(),
    maxAge: REFRESH_TOKEN_MAX_AGE_MS,
  });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_TOKEN_COOKIE, baseCookieOptions());
  res.clearCookie(REFRESH_TOKEN_COOKIE, baseCookieOptions());
}
