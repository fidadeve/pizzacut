## Security hardening

- `sessions.cookie_samesite` = `Lax` (default). `Set-Cookie` is never sent with
  `SameSite=none`, so cross-site requests never carry the session cookie.
- `sessions.cookie_secure` = `true` when `NODE_ENV=production` (and `process.env.SESSION_SECURE` is unset).
- `sessions.cookie_httponly` = `true` (AMINAL global default).
- `responses.csp` defaults to `default-src 'self'`; it can be overridden per route.

Empty-value config entries are ignored, so `"cookie_samesite": ""` keeps the
default. Missing config = DB default.
