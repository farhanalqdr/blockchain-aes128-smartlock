# Raspberry Pi Smart Lock Edge

The active entry point is `index.js`, which starts `lockListener.js`. It polls the
backend, fetches on-chain command data, compares command-package hashes, decrypts
verified AES-128-GCM commands, calls `relay_control.py` and reports execution.

## Setup

1. `npm ci` inside `edge/`.
2. `cp .env.example .env` and configure `API_URL`, `LOCK_WALLET_ADDRESS`,
   `PROVIDER_URL`, `CONTRACT_ADDRESS`, `DEVICE_PRIVATE_KEY` and the shared AES key.
3. Compile the Solidity contract once in `../dapp` so that the ABI artifact exists.
4. `npm start` on the Raspberry Pi. The backend must be reachable from the Pi.
5. For physical relay control, install `RPi.GPIO` and verify the hardware wiring.
   Set `HARDWARE_MODE=true` **only after** testing. By default physical actuation
   is blocked, so commands are not falsely marked successful.

The supplied archive did **not** contain the relay script; `relay_control.py` here
is a conservative implementation based on BCM GPIO17, active-LOW, and a 1 s
UNLOCK pulse. It has **not** been tested on your physical device.

The other `blockchainService.js`, `deviceInitializer.js`, and `dataSubmitter.js`
modules are legacy sensor-oriented components and are not invoked by `index.js`.
