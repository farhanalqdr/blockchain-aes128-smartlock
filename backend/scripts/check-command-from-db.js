require("dotenv").config();
const mongoose = require("mongoose");

async function main() {
  const blockchainCommandId = Number(process.argv[2]);

  if (!blockchainCommandId) {
    console.error("Usage: node scripts/check-command-from-db.js <blockchainCommandId>");
    process.exit(1);
  }

  const mongoUri =
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    process.env.DATABASE_URL;

  if (!mongoUri) {
    console.error("MongoDB URI tidak ditemukan di .env");
    process.exit(1);
  }

  await mongoose.connect(mongoUri);

  const db = mongoose.connection.db;

  const command = await db.collection("commands").findOne({
    $or: [
      { blockchainCommandId: blockchainCommandId },
      { blockchainCommandId: String(blockchainCommandId) },
      { "blockchain.commandId": blockchainCommandId },
      { "blockchain.commandId": String(blockchainCommandId) },
      { "blockchain.commandId": BigInt(blockchainCommandId).toString() }
    ]
  });

  if (!command) {
    console.log(`Command dengan blockchainCommandId ${blockchainCommandId} tidak ditemukan`);
    console.log("Coba cek nama field dengan script tambahan atau lihat struktur collection commands.");
  } else {
    console.log("COMMAND FROM MONGODB");
    console.log(JSON.stringify(command, null, 2));
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});