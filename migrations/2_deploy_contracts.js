var CryptoSpinnersMarket = artifacts.require("./CryptoSpinnersMarket.sol");

module.exports = function(deployer) {
  deployer.deploy(CryptoSpinnersMarket);
};
