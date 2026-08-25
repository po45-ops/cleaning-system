# Security policy and production checklist

## Supported version

Only the latest commit on `main` is supported.

## Important trust boundary

GitHub Pages serves a public static application. Values bundled into the frontend, React state, `localStorage`, and hidden UI controls are visible or changeable by anyone using the browser. They must not be treated as authentication or authorization.

The deployed Google Apps Script data API currently lives outside this repository. This repository therefore cannot independently enforce the permissions for create, update, delete, inspection reads, image reads, or council-schedule writes.

Before using the system for confidential or high-impact data, the owner of that Apps Script project must implement all of the following in `doGet` and `doPost`:

1. Authenticate each request on the server using a real identity/session mechanism. Do not put a shared API secret in Vite environment variables or frontend source because it will be public.
2. Authorize actions by role on the server. Students may submit only their permitted records; only staff may approve, edit, delete, export private data, or publish schedules.
3. Reject requests with missing, expired, replayed, or invalid credentials. Use short-lived sessions and rotate/revoke them when accounts change.
4. Validate every field, action name, date, zone, status, score, image type, image count, and payload size before writing to Sheets or Drive.
5. Return only the fields needed by the caller. Do not expose student names, credential data, or unrestricted Drive image URLs from a public `doGet` response.
6. Add rate limits and an audit log for authentication failures and every privileged write.

The legacy plaintext credential storage has been removed. To preserve the owner's existing student access, the frontend ships salted PBKDF2 verifiers for the nine council accounts; it does not ship the plaintext value. A short shared student code can still be guessed offline from a public verifier, so this remains only a temporary screen lock. Admins choose an initial password of at least eight characters per device and can change it after confirming the current value. Once server sessions are deployed, remove these client-side verifiers and the `cleaning_auth_user` role cache.

## Protections already present in this repository

- Messenger PDF reports include approved records only.
- Report images accept only JPEG, PNG, or WebP, are size-limited, and remote downloads are restricted to exact `googleusercontent.com` hosts.
- Apps Script OAuth credentials are never forwarded while downloading report images.
- Private Google Drive report URLs are not sent as a fallback when attachment upload fails.
- Report queue updates use a script lock to prevent lost concurrent jobs.
- CI blocks TypeScript errors, failed tests, and high/critical production dependency vulnerabilities.
- No plaintext admin or student password is committed in the public source. Student defaults and new local screen-lock values are stored as salted PBKDF2 hashes.
- Admin passwords can be initialized and changed in the password-management screen; no default admin password is embedded in the bundle.
- Student names are no longer hardcoded in the public bundle; an administrator must enter member names in the schedule editor after deployment.

## Reporting a vulnerability

Do not open a public issue containing student data, access tokens, passwords, PSIDs, Drive URLs, or exploit details. Contact the repository owner privately, revoke any exposed token immediately, and include only non-sensitive reproduction steps.
