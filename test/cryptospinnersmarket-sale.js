require('babel-polyfill');

var CryptoSpinnersMarket = artifacts.require("./CryptoSpinnersMarket.sol");

var expectThrow = async function (promise) {
  try {
    await promise;
  } catch (error) {
    // TODO: Check jump destination to destinguish between a throw
    //       and an actual invalid jump.
    const invalidOpcode = error.message.search('invalid opcode') >= 0;
    const invalidJump = error.message.search('invalid JUMP') >= 0;
    // TODO: When we contract A calls contract B, and B throws, instead
    //       of an 'invalid jump', we get an 'out of gas' error. How do
    //       we distinguish this from an actual out of gas event? (The
    //       testrpc log actually show an 'invalid jump' event.)
    const outOfGas = error.message.search('out of gas') >= 0;
    assert(
      invalidOpcode || invalidJump || outOfGas,
      "Expected throw, got '" + error + "' instead",
    );
    return;
  }
  assert.fail('Expected throw not received');
};

var compareBalance = function(previousBalance, currentBalance, amount) {
  var strPrevBalance = String(previousBalance);
  var digitsToCompare = 8;
  var subPrevBalance = strPrevBalance.substr(strPrevBalance.length - digitsToCompare, strPrevBalance.length);
  var strBalance = String(currentBalance);
  var subCurrBalance = strBalance.substr(strBalance.length - digitsToCompare, strBalance.length);
  console.log("Comparing only least significant digits: "+subPrevBalance+" vs. "+subCurrBalance);
  assert.equal(Number(subCurrBalance), Number(subPrevBalance) + amount, "Account 1 balance incorrect after withdrawal.");
};

var NULL_ACCOUNT = "0x0000000000000000000000000000000000000000";

contract('CryptoSpinnersMarket-buySellRemoveFromSale', function (accounts) {
    it("can offer a spinner", async function () {
      var contract = await CryptoSpinnersMarket.deployed();

    //   await contract.setInitialOwner(accounts[1], 1);
      await contract.getSpinner(0, {from:accounts[1]});
    //   await contract.setInitialOwner(accounts[2], 2);
      await contract.getSpinner(3, {from:accounts[3]});

      await contract.offerSpinnerForSale(0, 1000, {from:accounts[1]});

      var offer = await contract.spinnerAsks.call(0);
      console.log("Offer: " + offer);
      assert.equal(true, offer[0], "Spinner 0 not for sale");
      assert.equal(0, offer[1]);
      assert.equal(accounts[1], offer[2]);
      assert.equal(1000, offer[3]);
      assert.equal(NULL_ACCOUNT, offer[4]);
    }),
    it("can not buy a spinner that is not for sale", async function () {
      var contract = await CryptoSpinnersMarket.deployed();

      await expectThrow(contract.buySpinner(1, 10000000));
    }),
    it("can not buy a spinner for too little money", async function () {
      var contract = await CryptoSpinnersMarket.deployed();

      var ethBalance = await web3.eth.getBalance(accounts[1]);
      console.log("Account 1 has " + ethBalance + " Wei");
      assert(ethBalance > 0);
      await expectThrow(contract.buySpinner(0, {from: accounts[1], value: 10}));
    }),
    it("can not offer a spinner with an invalid index", async function () {
      var contract = await CryptoSpinnersMarket.deployed();
      await expectThrow(contract.offerSpinnerForSale(100000, 1000));
    }),
    it("can not buy a spinner with an invalid index", async function () {
      var contract = await CryptoSpinnersMarket.deployed();
      await expectThrow(contract.buySpinner(100000, {value: 10000000}));
    }),
    it("can buy a spinner that is for sale", async function () {
      var contract = await CryptoSpinnersMarket.deployed();
      await contract.buySpinner(0, {from: accounts[2], value: 1000});

      var offer = await contract.spinnerAsks.call(0);
      console.log("Offer post purchase: " + offer);
      assert.equal(false, offer[0], "Spinner 0 for sale");
      assert.equal(0, offer[1]);
      assert.equal(0, offer[3]);
      assert.equal(NULL_ACCOUNT, offer[4]);

      var balance = await contract.balanceOf.call(accounts[0]);
      // console.log("Balance acc0: " + balance);
      assert.equal(balance.valueOf(), 0, "Spinner balance account 0 incorrect");
      var balance1 = await contract.balanceOf.call(accounts[2]);
      // console.log("Balance acc1: " + balance1);
      assert.equal(balance1.valueOf(), 1, "Spinner balance account 2 incorrect");

      var balanceToWidthdraw = await contract.pendingWithdrawals.call(accounts[1]);
      assert.equal(balanceToWidthdraw.valueOf(), 1000, "Balance not available to withdraw.");

    }),
    it("can withdraw money from sale", async function () {
      var contract = await CryptoSpinnersMarket.deployed();
      var accountBalancePrev = await web3.eth.getBalance(accounts[1]);
      await contract.withdraw({from:accounts[1]});
      var accountBalance = await web3.eth.getBalance(accounts[1]);
      compareBalance(accountBalancePrev, accountBalance, 1000);

      var balanceToWidthdraw = await contract.pendingWithdrawals.call(accounts[1]);
      assert.equal(balanceToWidthdraw.valueOf(), 0);
    }),
    it("can offer for sale then withdraw", async function () {
      var contract = await CryptoSpinnersMarket.deployed();

      await contract.offerSpinnerForSale(3, 1333, {from: accounts[3]});

      var offer = await contract.spinnerAsks.call(3);
      console.log("Offer: " + offer);
      assert.equal(true, offer[0]);
      assert.equal(3, offer[1]);
      assert.equal(accounts[3], offer[2]);
      assert.equal(1333, offer[3]);
      assert.equal(NULL_ACCOUNT, offer[4]);

      await contract.spinnerNoLongerForSale(3, {from: accounts[3]});

      var offerPost = await contract.spinnerAsks.call(3);
      console.log("Offer: " + offer);
      assert.equal(false, offerPost[0]);
      assert.equal(3, offerPost[1]);
      assert.equal(accounts[3], offerPost[2]);
      assert.equal(0, offerPost[3]);
      assert.equal(NULL_ACCOUNT, offerPost[4]);

      // Can't buy it either
      await expectThrow(contract.buySpinner(3, {from: accounts[4], value: 10000000}));

    }),
    it("can offer for sale to specific account", async function () {
      var contract = await CryptoSpinnersMarket.deployed();

      await contract.offerSpinnerForSaleToAddress(0, 1333, accounts[0], {from: accounts[2]});

      var offer = await contract.spinnerAsks.call(0);
      console.log("Offer: " + offer);
      assert.equal(true, offer[0]);
      assert.equal(0, offer[1]);
      assert.equal(accounts[2], offer[2]);
      assert.equal(1333, offer[3]);
      assert.equal(accounts[0], offer[4]);

      // Account 1 can't buy it
      await expectThrow(contract.buySpinner(0, {from: accounts[1], value: 10000000}));

      // Acccount 0 can though
      await contract.buySpinner(0, {from: accounts[0], value: 1333});

      var offerPost = await contract.spinnerAsks.call(0);
      console.log("Offer: " + offer);
      assert.equal(false, offerPost[0]);
      assert.equal(0, offerPost[1]);
      assert.equal(accounts[0], offerPost[2]);
      assert.equal(0, offerPost[3]);
      assert.equal(NULL_ACCOUNT, offerPost[4]);

      var balance = await contract.balanceOf.call(accounts[0]);
      // console.log("Balance acc0: " + balance);
      assert.equal(balance.valueOf(), 1, "Spinner balance account 0 incorrect");
      var balance1 = await contract.balanceOf.call(accounts[2]);
      // console.log("Balance acc1: " + balance1);
      assert.equal(balance1.valueOf(), 0, "Spinner balance account 1 incorrect");

      var balanceToWidthdraw = await contract.pendingWithdrawals.call(accounts[2]);
      assert.equal(balanceToWidthdraw.valueOf(), 1333, "Balance not available to withdraw.");

    }),
    it("can withdraw money from sale to specific account", async function () {
      var contract = await CryptoSpinnersMarket.deployed();
      var accountBalancePrev = await web3.eth.getBalance(accounts[2]);
      await contract.withdraw({from: accounts[2]});
      var accountBalance = await web3.eth.getBalance(accounts[2]);
      compareBalance(accountBalancePrev, accountBalance, 1333);

      var balanceToWidthdraw = await contract.pendingWithdrawals.call(accounts[2]);
      assert.equal(balanceToWidthdraw.valueOf(), 0);

    }),
    it("transfer should cancel offers", async function () {
      var contract = await CryptoSpinnersMarket.deployed();
      await contract.offerSpinnerForSale(0, 2333, {from:accounts[0]});

      var offer = await contract.spinnerAsks.call(0);
      console.log("Offer: " + offer);
      assert.equal(true, offer[0]);
      assert.equal(0, offer[1]);
      assert.equal(accounts[0], offer[2]);
      assert.equal(2333, offer[3]);
      assert.equal(NULL_ACCOUNT, offer[4]);

      await contract.transferSpinner(accounts[0], 0, {from:accounts[0]});

      var offer = await contract.spinnerAsks.call(0);
      console.log("Offer post transfer: " + offer);
      assert.equal(false, offer[0]);
      assert.equal(0, offer[1]);
      assert.equal(accounts[0], offer[2]);
      assert.equal(0, offer[3]);
      assert.equal(NULL_ACCOUNT, offer[4]);

    })


});
