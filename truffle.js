// for rinkeby and mainnet, an env var MNEMONIC needs to be set
const HDWalletProvider = require('truffle-hdwallet-provider');

module.exports = {
  networks: {
    development: {
      host: "localhost",
      port: 8545,
      network_id: "*"
    },
    rinkeby: {
      provider: function () {
        return new HDWalletProvider(process.env.MNEMONIC, "https://rinkeby.infura.io/", 0);
      },
      network_id: "3",
      gas: 200000,
      gasPrice: 1E9
    },
    mainnet: {
      provider: function () {
        return new HDWalletProvider(process.env.MNEMONIC, "https://mainnet.infura.io/", 0);
      },
      network_id: "1",
      gas: 200000,
      gasPrice: 12*1E9
    }
  },
  solc: {
    optimizer: {
      enabled: true,
      runs: 200
    }
  }
};
