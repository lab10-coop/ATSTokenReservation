const ATSTokenReservation = artifacts.require("./ATSTokenReservation.sol");

module.exports = function (deployer, network, accounts) {
    if (network === "development") {
        whitelistController = accounts[8];
        payoutAddr = accounts[9];
        reservationContract = deployer.deploy(ATSTokenReservation, whitelistController, payoutAddr);
    }
};
