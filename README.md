## About

This contract governs reservations for the ATS token.  
Finalization and deployment of the token contract itself (not included in this repo) was re-scheduled due to legal uncertainties, see https://artis.eco/en/blog/detail/update-ito.  
Details about how the contract works can be found at the beginning of the contract file in `contracts/ATSTokenReservation.sol`.

## Test

In order to run the tests, make sure node and npm are installed (tested with nodejs v9.11, but should also work with v8). Then:
```
npm install -g truffle ganache-cli`
npm install
# now start ganache-cli in another shell, same working directory
truffle test
```

## Deployment

The contract is deployed to the Ethereum mainnet at [0xD1670C55F5e68feDe5Fddd8aCe64A3329F778B89](https://etherscan.io/address/0xd1670c55f5e68fede5fddd8ace64a3329f778b89).  

## Errata

* the event `StateTransition` incorrectly sets the new state as both `oldState` and `newState` parameter. This event exists for logging purposes and doesn't affect the contract state itself (thus wasn't covered by the tests).
