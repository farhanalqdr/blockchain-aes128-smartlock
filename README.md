# Blockchain and AES-128-GCM Smart Lock

Research prototype with a React web dApp, Node.js API, MongoDB off-chain command storage,
Solidity smart contract on **Polygon Amoy (chain ID 80002)**, and a Raspberry Pi controlling a GPIO relay.

## Project layout

| Folder | Contents |
| --- | --- |
| `frontend/` | React/Vite web dashboard; device registration, approval and LOCK/UNLOCK commands |
| `backend/` | Express API, AES-128-GCM encryption, MongoDB models and smart-contract interaction |
| `dapp/` | Solidity smart contract (`contracts/GydPlatform.sol`), Hardhat deployment and test scripts |
| `edge/` | Raspberry Pi command polling, off-chain/on-chain comparison, relay execution and feedback |

## Security and prerequisites

- **No production credentials are included.** Copy the `.env.example` inside each component to `.env` and fill it **locally**; do not commit `.env` or any `.pem`/`.key` file.
- Existing wallets, AES keys, Alchemy endpoints, JWT secrets and any RSA private key from the supplied research archive should be treated as exposed to recipients of that archive. Rotate them **before publishing or deploying**; changing wallet keys may require updating device registration and contract authorization.
- Use Node.js 22 (the original test environment uses Node.js 22); a running MongoDB instance, Polygon Amoy RPC endpoint, and funded testnet signing accounts are necessary for blockchain operations.
- Backend and edge must share the **same** randomly generated 16-byte AES key. Prefer `AES_SHARED_KEY_HEX` containing 32 hex digits. Generate a fresh key locally with `python3 -c "import secrets; print(secrets.token_hex(16))"`.
- The edge's `DEVICE_PRIVATE_KEY` must correspond to `LOCK_WALLET_ADDRESS` and be authorized by the deployed contract.
- All blockchain fees use testnet currency; the system has not been validated for production physical access use.

## Setup

From the repository root:

1. Create `backend/.env`, `dapp/.env`, `edge/.env`, and `frontend/.env` by copying the respective `.env.example` files. Set private values only in these local files.
2. Install the project dependencies and compile the contract:

   ```sh
   cd dapp
   npm ci
   npx hardhat compile --force
   ```

   This creates the **required ABI artifact** under `dapp/artifacts/`; the backend and edge load it from this location, so compile before starting either service.
3. Deploy the contract if needed using `npm run deploy:amoy` from `dapp/` after configuring the signing keys. Set the resulting contract address consistently in `backend/.env` and `edge/.env`. Existing deployment metadata under `dapp/deployments/` is for reference only.
4. Run MongoDB. Configure `DATABASE_URL`, `ADMIN_EMAIL` and a unique `ADMIN_PASSWORD` in `backend/.env`. Start the backend:

   ```sh
   cd backend
   npm ci
   npm start
   ```

5. Start the frontend in a separate terminal:

   ```sh
   cd frontend
   npm ci
   npm run dev
   ```

   `VITE_API_URL` must point to the backend API base URL (for example `http://localhost:3000/api`).
6. On the Raspberry Pi, edit `edge/.env` with the reachable backend IP, authorized device wallet, RPC URL, and the matching AES key, then:

   ```sh
   cd edge
   npm ci
   npm start
   ```

   `edge/lockListener.js` calls `edge/relay_control.py` for physical actuation. The helper was **missing in the supplied archive** and has been provided as a conservative GPIO17/active-LOW implementation, intended for hardware validation. Install `RPi.GPIO` on the Pi, check the relay's electrical behavior, and set `HARDWARE_MODE=true` **only after** validating the wiring and fail-safe operation. With hardware mode disabled, the helper rejects actuation rather than reporting a false success.

## Command security flow

1. An approved user issues `LOCK` or `UNLOCK` in the web UI.
2. The backend encrypts the command JSON using AES-128-GCM and records command data in MongoDB and the smart contract (`submitEncryptedCommand()`).
3. Raspberry Pi polls the backend, retrieves corresponding blockchain data (`getCommand()`), and compares computed command-package hashes.
4. Matching hashes permit authenticated decryption and relay execution; mismatches reject the command without relay activation.
5. Execution results are reported off-chain and on-chain (`markCommandExecuted()`).

## Important limitations

- MongoDB stores `rawPayload` in this research implementation. This is **not appropriate for production** without removing or restricting plaintext command data.
- GPIO hardware and end-to-end integration are **not automatically validated** by this cleaned archive. Confirm operation on the actual Pi and physical lock before deployment.
- The `backend/docker-compose.yml` is a **legacy/partial configuration**: it references supporting MongoDB init and nginx files that were not included in the original archive. Use the local setup above unless those components are supplied.
- Generated Hardhat artifacts, logs, performance output and machine-local credentials were intentionally excluded from the upload-ready archive. Rebuild artifacts with Hardhat before running backend/edge.
- No measured non-blockchain baseline is included; do not infer or publish one by subtracting mean confirmation times from click-to-relay latency.

See [`GITHUB_UPLOAD.md`](GITHUB_UPLOAD.md) for safe upload steps.
