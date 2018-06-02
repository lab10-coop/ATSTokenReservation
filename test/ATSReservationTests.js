const utils = require('./utils');
const ATSTokenReservation= artifacts.require('ATSTokenReservation');

const BigNumber = require('bignumber.js');
const should = require('should');

/*
 * This code was not written with maintainability in mind as it's a one-shot affair for a single-purpose contract.
 * The order of events is tightly coupled, even across test cases, which is an anti-pattern to maintainable code.
 * The focus here is on max code coverage and simulation of as many states as possible.
 * gasPrice for transactions is set to 0 in order to facilitate assertion of correct refunding (avoid mix-up with tx fees).
 * This doesn't mean that gas accounting (limits per tx and per block) is disabled.
 */
contract('ATSTokenReservation', (accounts) => {
  console.log(`Accounts: ${accounts}`);

  // initial setup
  const stateController = accounts[0];
  const randomAcc1 = accounts[1];
  const randomAcc2 = accounts[2];
  const randomAcc3 = accounts[3];
  const randomAcc4 = accounts[4];
  const randomAcc5 = accounts[5];
  
  const whitelistController = accounts[8];
  const payoutAddr = accounts[9];

  // using low amounts in order to not run out of funds quickly with ganache
  const acc1Dep1 = web3.toBigNumber(web3.toWei(0.283));
  const acc1Dep2 = web3.toBigNumber(web3.toWei(1.42));
  const acc2Dep1 = web3.toBigNumber(web3.toWei(0.10253));
  const acc2Dep2 = web3.toBigNumber(web3.toWei(1.342));
  const acc3Dep1 = web3.toBigNumber(web3.toWei(0.52));
  const acc3Dep2 = web3.toBigNumber(web3.toWei(0.2422));
  const acc4Dep1 = web3.toBigNumber(web3.toWei(0.18));
  const acc4Dep2 = web3.toBigNumber(web3.toWei(0.477));
  const acc5Dep1 = web3.toBigNumber(web3.toWei(0.64));

  const acc1InitBal = web3.eth.getBalance(randomAcc1).toNumber();
  const acc2InitBal = web3.eth.getBalance(randomAcc2).toNumber();
  const acc3InitBal = web3.eth.getBalance(randomAcc3).toNumber();
  const acc4InitBal = web3.eth.getBalance(randomAcc4).toNumber();
  const acc5InitBal = web3.eth.getBalance(randomAcc5).toNumber();
  const payoutInitBal = web3.eth.getBalance(payoutAddr).toNumber();

  const initMinDeposit = 0.1 * 1E18;
  const initMaxAcceptedDeposits = 1E9 * 1E18;

  // This needs to be manually kept in sync with the corresponding enum in the contract
  const States = {
    Init: 0,
    Open: 1,
    Locked: 2,
    Over: 3
  };

  const contract = ATSTokenReservation.at(ATSTokenReservation.address);
  console.log(`contract address: ${ATSTokenReservation.address}`);

  it('check state "Init"', async () => {
    assert(typeof contract.tryDeposit === "undefined"); // internal function
    assert(typeof contract.tryRefund === "undefined"); // internal function
    assert(typeof contract.setState === "undefined"); // internal function

    assert.equal(await contract.state(), States.Init);
    await contract.sendTransaction({ from: randomAcc1, value: acc1Dep1, gasPrice: 0 }).should.be.rejected(); // wrong state
    await contract.updateMaxAcceptedDeposits(2000*1E18, { from: randomAcc1, gasPrice: 0 }).should.be.rejected(); // no permission
    assert.equal((await contract.maxCumAcceptedDeposits()).toNumber(), initMaxAcceptedDeposits); // still init value
    await contract.updateMaxAcceptedDeposits(2000*1E18, { from: stateController, gasPrice: 0 });
    assert.equal((await contract.maxCumAcceptedDeposits()).toNumber(), 2000*1E18);

    await contract.updateMinDeposit(0.05 * 1E18, { from: randomAcc1, gasPrice: 0 }).should.be.rejected(); // no permission
    await contract.updateMinDeposit(0.05 * 1E18, { from: stateController, gasPrice: 0 });
    assert.equal((await contract.minDeposit()).toNumber(), 0.05 * 1E18);
  });

  it('check state "Open', async () => {
    const minLockingTs = utils.getLastBlockTimestamp() + 3600;
    await contract.stateSetOpen(minLockingTs, { from: randomAcc1, gasPrice: 0 }).should.be.rejected(); // no permission
    await contract.stateSetOpen(minLockingTs, { from: stateController, gasPrice: 0 });

    await contract.sendTransaction({ from: randomAcc1, value: acc1Dep1, gasPrice: 0 });
    assert.equal((await contract.cumAlienDeposits()).toNumber(), acc1Dep1.toNumber());
    assert.equal((await contract.cumAcceptedDeposits()).toNumber(), 0);
    //assert.equal((await contract.acceptedDeposits(randomAcc1)).toNumber(), acc1Dep1.toNumber());

    await contract.addToWhitelist(randomAcc1, { from: randomAcc1, gasPrice: 0}).should.be.rejected(); // no permission
    await contract.addToWhitelist(randomAcc1, { from: whitelistController, gasPrice: 0});
    assert.equal((await contract.cumAlienDeposits()).toNumber(), 0);
    assert.equal((await contract.cumAcceptedDeposits()).toNumber(), acc1Dep1.toNumber());

    await contract.updateMaxAcceptedDeposits(1, { from: stateController }).should.be.rejected(); // below current deposits

    await contract.addToWhitelist(randomAcc2, { from: whitelistController, gasPrice: 0});
    await contract.sendTransaction({ from: randomAcc2, value: acc2Dep1, gasPrice: 0 });
    assert.equal((await contract.cumAcceptedDeposits()).toNumber(), acc1Dep1.plus(acc2Dep1).toNumber());
    await contract.sendTransaction({ from: randomAcc2, value: acc2Dep2, gasPrice: 0 });
    assert.equal((await contract.cumAcceptedDeposits()).toNumber(), acc1Dep1.plus(acc2Dep1).plus(acc2Dep2).toNumber());
    assert.equal(web3.eth.getBalance(contract.address).toNumber(), acc1Dep1.plus(acc2Dep1).plus(acc2Dep2).toNumber());

    //console.log(`contract balance: ${web3.eth.getBalance(contract.address)}`);
    await contract.sendTransaction({ from: randomAcc2, value: 0, gasPrice: 0 }); // refund
    assert.equal((await contract.cumAcceptedDeposits()).toNumber(), acc1Dep1.toNumber());
    assert.equal(web3.eth.getBalance(contract.address).toNumber(), acc1Dep1.toNumber());
    await contract.sendTransaction({ from: randomAcc2, value: 0, gasPrice: 0 }).should.be.rejected(); // refund again
    let acc2CurBal = web3.eth.getBalance(randomAcc2).toNumber();
    assert.equal(acc2InitBal, acc2CurBal); // everything refunded

    await contract.updateMaxAcceptedDeposits(acc1Dep1.plus(1), { from: stateController });
    await contract.sendTransaction({ from: randomAcc2, value: acc2Dep1, gasPrice: 0 }).should.be.rejected(); // exceeds cap

    await contract.updateMaxAcceptedDeposits(1000*1E18, { from: stateController });
    await contract.sendTransaction({ from: randomAcc2, value: acc2Dep1, gasPrice: 0}); // deposit after refund
    assert.equal((await contract.cumAcceptedDeposits()).toNumber(), acc1Dep1.plus(acc2Dep1).toNumber());
    assert.equal(web3.eth.getBalance(contract.address).toNumber(), acc1Dep1.plus(acc2Dep1).toNumber());

    // deposit and refund without whitelisting in between
    await contract.sendTransaction({ from: randomAcc3, value: acc3Dep1, gasPrice: 0 });
    assert.equal((await contract.cumAlienDeposits()).toNumber(), acc3Dep1.toNumber());
    assert.equal((await contract.cumAcceptedDeposits()).toNumber(), acc1Dep1.plus(acc2Dep1).toNumber());
    await contract.sendTransaction({ from: randomAcc3, value: 0, gasPrice: 0 }); // refund
    assert.equal((await contract.cumAlienDeposits()).toNumber(), 0);
    assert.equal((await contract.cumAcceptedDeposits()).toNumber(), acc1Dep1.plus(acc2Dep1).toNumber());
    await contract.sendTransaction({ from: randomAcc3, value: 0, gasPrice: 0 }).should.be.rejected(); // already refunded
    let acc3CurBal = web3.eth.getBalance(randomAcc3).toNumber();
    assert.equal(acc3InitBal, acc3CurBal); // everything refunded

    await contract.sendTransaction({ from: randomAcc3, value: acc3Dep1, gasPrice: 0 });
    assert.equal((await contract.cumAlienDeposits()).toNumber(), acc3Dep1.toNumber());
    assert.equal((await contract.cumAcceptedDeposits()).toNumber(), acc1Dep1.plus(acc2Dep1).toNumber());
    await contract.refundAlienDeposit(randomAcc3, { from: whitelistController, gasPrice: 0}); // forced refund
    assert.equal((await contract.cumAlienDeposits()).toNumber(), 0);
    assert.equal((await contract.cumAcceptedDeposits()).toNumber(), acc1Dep1.plus(acc2Dep1).toNumber());
    acc3CurBal = web3.eth.getBalance(randomAcc3).toNumber();
    assert.equal(acc3InitBal, acc3CurBal); // everything refunded
    await contract.sendTransaction({ from: randomAcc3, value: 0, gasPrice: 0 }).should.be.rejected(); // already refunded

    await contract.setRequireWhitelistingBeforeDeposit(true, { from: stateController, gasPrice: 0});
    await contract.sendTransaction({ from: randomAcc3, value: acc3Dep1, gasPrice: 0 }).should.be.rejected(); // not whitelisted
    await contract.setRequireWhitelistingBeforeDeposit(false, { from: stateController, gasPrice: 0});

    await contract.sendTransaction({ from: randomAcc3, value: web3.toWei(0.001), gasPrice: 0 }).should.be.rejected(); // below min deposit
    await contract.sendTransaction({ from: randomAcc3, value: acc3Dep1, gasPrice: 0 });
    assert.equal((await contract.cumAlienDeposits()).toNumber(), acc3Dep1.toNumber());
    assert.equal((await contract.cumAcceptedDeposits()).toNumber(), acc1Dep1.plus(acc2Dep1).toNumber());
    await contract.addToWhitelist(randomAcc3, { from: whitelistController, gasPrice: 0});
    await contract.sendTransaction({ from: randomAcc3, value: acc3Dep2, gasPrice: 0 });
    assert.equal((await contract.cumAlienDeposits()).toNumber(), 0);
    assert.equal((await contract.cumAcceptedDeposits()).toNumber(), acc1Dep1.plus(acc2Dep1).plus(acc3Dep1).plus(acc3Dep2).toNumber());
    await contract.addToWhitelist(randomAcc3, { from: whitelistController, gasPrice: 0}); // whitelist twice (check idempotence)
    assert.equal((await contract.cumAlienDeposits()).toNumber(), 0);
    assert.equal((await contract.cumAcceptedDeposits()).toNumber(), acc1Dep1.plus(acc2Dep1).plus(acc3Dep1).plus(acc3Dep2).toNumber());
    await contract.sendTransaction({ from: randomAcc3, value: web3.toWei(0.001), gasPrice: 0 }); // don't apply minDeposit to increment (accepted)
    await contract.sendTransaction({ from: randomAcc3, value: 0, gasPrice: 0 }); // refund
    assert.equal((await contract.cumAlienDeposits()).toNumber(), 0);
    assert.equal((await contract.cumAcceptedDeposits()).toNumber(), acc1Dep1.plus(acc2Dep1).toNumber());
    acc3CurBal = web3.eth.getBalance(randomAcc3).toNumber();
    assert.equal(acc3InitBal, acc3CurBal); // everything refunded

    await contract.payout({ from: stateController, gasPrice: 0 }).should.be.rejected(); // wrong state
  });

  it('check state "Locked"', async () => {
    await contract.sendTransaction({ from: randomAcc4, value: acc4Dep1, gasPrice: 0 });
    // initial state: acc1 and acc2 have accepted deposits, acc4 has an alien deposit

    await contract.stateSetLocked( { from: stateController, gasPrice: 0 }).should.be.rejected(); // minLockingTs not reached
    utils.fastForward(3600);
    await contract.stateSetLocked( { from: stateController, gasPrice: 0 });

    await contract.sendTransaction({ from: randomAcc4, value: acc4Dep2, gasPrice: 0 });
    await contract.sendTransaction({ from: randomAcc1, value: acc1Dep2, gasPrice: 0 });
    assert.equal((await contract.cumAlienDeposits()).toNumber(), acc4Dep1.plus(acc4Dep2).toNumber());
    assert.equal((await contract.cumAcceptedDeposits()).toNumber(), acc1Dep1.plus(acc2Dep1).plus(acc1Dep2).toNumber());

    await contract.sendTransaction({ from: randomAcc1, value: 0, gasPrice: 0 }).should.be.rejected(); // locked
    await contract.sendTransaction({ from: randomAcc4, value: web3.toWei(0.001), gasPrice: 0 }); // don't apply minDeposit to increment (alien)
    await contract.sendTransaction({ from: randomAcc4, value: 0, gasPrice: 0 }); // aliens can still refund
    assert.equal((await contract.cumAlienDeposits()).toNumber(), 0);
    assert.equal((await contract.cumAcceptedDeposits()).toNumber(), acc1Dep1.plus(acc2Dep1).plus(acc1Dep2).toNumber());
    assert.equal(web3.eth.getBalance(contract.address).toNumber(), acc1Dep1.plus(acc2Dep1).plus(acc1Dep2).toNumber());

    await contract.sendTransaction({ from: randomAcc4, value: acc4Dep1, gasPrice: 0 });
    await contract.sendTransaction({ from: randomAcc5, value: acc5Dep1, gasPrice: 0 });
  });

  it('check state "Over"', async () => {
    await contract.stateSetOver({ from: stateController, gasPrice: 0 });

    await contract.sendTransaction({ from: randomAcc1, value: acc1Dep1, gasPrice: 0 }).should.be.rejected(); // deposits forbidden (whitelisted)
    await contract.sendTransaction({ from: randomAcc4, value: acc4Dep1, gasPrice: 0 }).should.be.rejected(); // deposits forbidden (alien)

    await contract.sendTransaction({ from: randomAcc1, value: 0, gasPrice: 0 }).should.be.rejected(); // (still) locked

    await contract.payout({ from: randomAcc1, gasPrice: 0 }).should.be.rejected(); // no permission
    await contract.payout({ from: stateController, gasPrice: 0 });
    await contract.payout({ from: stateController, gasPrice: 0 }); // has no effect

    assert.equal(web3.eth.getBalance(contract.address).toNumber(), acc4Dep1.plus(acc5Dep1).toNumber()); // alien deposits still here
    await contract.sendTransaction({ from: randomAcc4, value: 0, gasPrice: 0 }); // refund

    if(utils.getLastBlockTimestamp() < 1538352000) {
      // this test would incorrectly fail after October 2018 (due to the hardcoded timstamp in contract)
      await contract.fallbackPayout({from: whitelistController, gasPrice: 0}).should.be.rejected(); // too early
      utils.fastForward(15000000);
    } else {
      console.log('skipping test of locking period for fallbackPayout() because the chain time is already beyond');
    }

    // expected final state
    assert.equal(web3.eth.getBalance(randomAcc1).toNumber(), web3.toBigNumber(acc1InitBal).minus(acc1Dep1).minus(acc1Dep2).toNumber());
    assert.equal(web3.eth.getBalance(randomAcc2).toNumber(), web3.toBigNumber(acc2InitBal).minus(acc2Dep1).toNumber());
    assert.equal(web3.eth.getBalance(randomAcc3).toNumber(), web3.toBigNumber(acc3InitBal).toNumber());
    assert.equal(web3.eth.getBalance(randomAcc4).toNumber(), web3.toBigNumber(acc4InitBal).toNumber());
    assert.equal(web3.eth.getBalance(randomAcc5).toNumber(), web3.toBigNumber(acc5InitBal).minus(acc5Dep1).toNumber());

    let expectedPayoutBalance = web3.toBigNumber(payoutInitBal).plus(acc1Dep1).plus(acc2Dep1).plus(acc1Dep2);
    assert.equal(web3.eth.getBalance(payoutAddr).toNumber(), expectedPayoutBalance.toNumber());

    await contract.fallbackPayout({ from: whitelistController, gasPrice: 0 });
    assert.equal(web3.eth.getBalance(payoutAddr).toNumber(), expectedPayoutBalance.plus(acc5Dep1).toNumber());

    assert.equal(web3.eth.getBalance(contract.address).toNumber(), 0);
  });
});
