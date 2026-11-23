import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { configVariable, defineConfig } from "hardhat/config";

export default defineConfig({
  plugins: [hardhatToolboxViemPlugin],
  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          viaIR: true,
        },
      },
      production: {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          viaIR: true,
        },
      },
    },
  },
  networks: {
    hardhatOp: {
      type: "edr-simulated",
      chainType: "op",
    },
    localhost: {
      type: "http",
      url: "http://127.0.0.1:8545/",
      chainId: 31337,
      accounts: [configVariable("LOCAL_PRIVATE_KEY")],
    },
    amoy: {
      type: "http",
      chainType: "generic",
      url: configVariable("AMOY_RPC_URL"),
      chainId: 80002,
      accounts: [configVariable("AMOY_PRIVATE_KEY")],
    },
  },
});
