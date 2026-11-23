require("dotenv").config();
const { ethers } = require("ethers");

const CONTRACT_ADDRESS = "0x72c0fec7154745d5bfd39b186c0ef7857f462e89";

const ABI = [
  "function getCommand(uint256 commandId) view returns (address lockAddress, address submittedByAddress, bytes encryptedPayload, bytes encryptedSessionKey, bytes iv, bytes authTag, uint256 submittedAt, uint256 expiresAt, bytes32 nonce, uint8 status, uint256 executedAt, string executionResult)"
];

function hexToBase64(hexValue) {
  return Buffer.from(hexValue.replace(/^0x/, ""), "hex").toString("base64");
}

function hexToUtf8(hexValue) {
  return Buffer.from(hexValue.replace(/^0x/, ""), "hex").toString("utf8");
}

function unixToIso(value) {
  const num = Number(value);
  if (!num) return "-";
  return new Date(num * 1000).toISOString();
}

async function main() {
  const blockchainCommandId = Number(process.argv[2]);

  if (!blockchainCommandId) {
    console.error("Usage: node scripts/check-command-from-chain.js <blockchainCommandId>");
    process.exit(1);
  }

  const rpcUrl =
    process.env.AMOY_RPC_URL ||
    process.env.POLYGON_AMOY_RPC_URL ||
    process.env.RPC_URL ||
    process.env.ALCHEMY_RPC_URL ||
    "https://rpc-amoy.polygon.technology";

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

  const command = await contract.getCommand(blockchainCommandId);

  const encryptedPayloadHex = ethers.hexlify(command.encryptedPayload);
  const encryptedSessionKeyHex = ethers.hexlify(command.encryptedSessionKey);
  const ivHex = ethers.hexlify(command.iv);
  const authTagHex = ethers.hexlify(command.authTag);

  console.log("COMMAND FROM SMART CONTRACT");
  console.log("blockchainCommandId  :", blockchainCommandId);
  console.log("lockAddress          :", command.lockAddress);
  console.log("submittedByAddress   :", command.submittedByAddress);

  console.log("\n--- HEX FORMAT FROM SMART CONTRACT ---");
  console.log("encryptedPayload     :", encryptedPayloadHex);
  console.log("encryptedSessionKey  :", encryptedSessionKeyHex);
  console.log("iv                   :", ivHex);
  console.log("authTag              :", authTagHex);

  console.log("\n--- BASE64 FORMAT FOR COMPARISON WITH MONGODB ---");
  console.log("encryptedPayload     :", hexToBase64(encryptedPayloadHex));
  console.log("encryptedSessionKey  :", hexToBase64(encryptedSessionKeyHex));
  console.log("encryptedSessionKey text :", hexToUtf8(encryptedSessionKeyHex));
  console.log("iv                   :", hexToBase64(ivHex));
  console.log("authTag              :", hexToBase64(authTagHex));

  console.log("\n--- METADATA ---");
  console.log("submittedAt unix     :", command.submittedAt.toString());
  console.log("submittedAt iso      :", unixToIso(command.submittedAt));
  console.log("expiresAt unix       :", command.expiresAt.toString());
  console.log("expiresAt iso        :", unixToIso(command.expiresAt));
  console.log("nonce                :", command.nonce);
  console.log("status               :", command.status.toString());
  console.log("executedAt unix      :", command.executedAt.toString());
  console.log("executedAt iso       :", unixToIso(command.executedAt));
  console.log("executionResult      :", command.executionResult);
}

main().catch((err) => {
  console.error("ERROR:", err);
  process.exit(1);
});