# Changes made to the uploaded `TA POL.rar`

This package is a cleaned, **new copy** of the uploaded archive. The source archive was not modified.

## Preserved

- The active React/Vite frontend, Node.js backend, Solidity/Hardhat contract and Raspberry Pi listener source.
- Deployment scripts, tests, package manifests and lockfiles, and supporting documentation that passed the secret screen.
- The existing AES-128-GCM and off-chain/on-chain verification application logic.

## Excluded

- Actual `.env` files, local Amoy `.env` copies, generated private/public PEM files and other local key material.
- Logs, raw benchmarking outputs, Hardhat cache/artifacts and frontend build output.
- The original `README_MIGRASI_AMOY.md`, which contained copied credentials and full provider endpoint tokens.
- Temporary editor files.

## Changed or added

- Added comprehensive root `.gitignore`, setup `README.md`, upload instructions and safe `.env.example` files for each component.
- Changed `backend/src/scripts/seedAdmin.js` and `backend/src/scripts/seed.js` to **require explicit `ADMIN_EMAIL` and `ADMIN_PASSWORD`**, instead of creating a default password-protected administrator. The seed CLI no longer prints the password.
- Updated legacy Docker Compose password defaults to require explicit values and pass AES/admin settings (the original Compose also references files missing from the original archive, so it remains a partial config).
- Removed an invalid backend `deploy` npm script which referenced a nonexistent file. Use `dapp/npm run deploy:amoy` for deployment instead.
- Removed a checked-in authenticated RPC endpoint fallback from `backend/scripts/check-command-from-chain.js`, replaced by a public Polygon Amoy endpoint.
- Replaced a test-only placeholder transaction hash string which coincided with an original AES shared secret.
- Added `edge/relay_control.py`, missing in the supplied archive. This conservative implementation is **not hardware-tested**; GPIO17/active-LOW/1-second unlock are defaults. It refuses to actuate unless `HARDWARE_MODE=true`.
- Corrected the stale edge README and package description to describe the active lock listener.

## Testing performed

- Archive extraction and file inventory.
- No retained sensitive configuration values from the uploaded environment files were found in the cleaned package (excluding public localhost settings).
- `node --check` syntax review on 48 JavaScript files; `relay_control.py` parsed successfully; all package manifests parsed as JSON.
- Git ignore patterns checked for private env files, PEM private keys, frontend build output, and Hardhat cache.

**Not tested:** `npm ci`, Solidity compilation, TypeScript build, API/database/RPC integration,
blockchain transaction signing, or physical relay operation. These require the user's dependencies,
credentials, actual hardware and/or network. This is a sanitized, upload-ready source package,
not proof of a fully working deployment.
