
function getLastBlockTimestamp() {
  return web3.eth.getBlock(web3.eth.blockNumber).timestamp;
}

/* sets the clock "time" seconds into the future and triggers mining of a new block.
Supported only by testrpc / ganache.
Returns the timestamp of the newly created block */
function fastForward(time) {
  web3.currentProvider.send({
    jsonrpc: '2.0',
    method: 'evm_increaseTime',
    params: [ time ],
  });

  web3.currentProvider.send({
    jsonrpc: '2.0',
    method: 'evm_mine',
  });

  return getLastBlockTimestamp();
}

exports.getLastBlockTimestamp = getLastBlockTimestamp;
exports.fastForward = fastForward;