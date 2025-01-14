const ethers = require('ethers');
const {contractAddresses} = require('../shared/contractAddresses');
const utils = require('../shared/utils');
const constVal = require('../shared/const');
const logUtils = require('../shared/logUtils');
const fileUtils = require("../shared/fileUtils");
const txUtils = require("../shared/txUtils");

const abi = contractAddresses.materials1ABI;
const address = contractAddresses.rarityMaterials1;
const dungeonName = 'cellar';

let contractRun;
let contractGetLoot;
let contractGetTimeUntilAvailable;

const run = async (tokenID) => {
    let thisGas = await utils.calculateGasPrice()
    let loot;
    if ((loot = await getLoot(tokenID)) < constVal.cellarThreshold){
        logUtils.log(`${tokenID} => [${dungeonName}] no loot`);
        return [false, 'no loot']
    }
    let time = await getTimeUntilAvailable(tokenID);
    let timeLeft = utils.timeLeft(time);
    if (timeLeft[0] !== -1){
        logUtils.log(`${tokenID} => [${dungeonName}] not available => ${timeLeft[0]}h${timeLeft[1]}m`);
        return [false, 'time', timeLeft[2]]
    }
    if (timeLeft[2] > -30){
        return [false, 'time', timeLeft[2]];
    }
    if (thisGas < 0) {
        logUtils.log(`${tokenID} => Gas Price too high: ${-thisGas}`)
        return [false, 'high gas']
    } else {
        if (constVal.liveTrading) {
            try {
                if (typeof contractRun === 'undefined') {
                    contractRun = new ethers.Contract(address, abi, constVal.nonceManager);
                }
                logUtils.log(`${tokenID} => start [${dungeonName}]`);
                let approveResponse = await contractRun.adventure(
                    tokenID,
                    {
                        gasLimit: constVal.totalGasLimit,
                        gasPrice: thisGas,
                        //nonce: await utils.getNonce(nonce)
                    });
                let receipt = await txUtils.waitForTx(tokenID, approveResponse, 'cellar');
                logUtils.log(`${tokenID} => [${dungeonName}] success, loot => ${loot}`);
                if (constVal.debug){
                    logUtils.log(approveResponse);
                }
                return [receipt.status === 1, `success, loot => ${loot}`];
            } catch (e) {
                logUtils.log(`${tokenID} => [${dungeonName}] error`);
                fileUtils.logToFile(`[${dungeonName}] error\n${e.toString()}`);
                if (constVal.debug){

                    logUtils.log(e);
                }
                return [false, 'error'];
            }
        } else {
            logUtils.log(`Live trading disabled - [${dungeonName}]  dungeoning NOT submitted.`)
            return [false, 'not live'];
        }
    }
}

const scout = async (tokenID) => {
    let loot = await getLoot(tokenID);
    if (loot > 0){
        let time = await getTimeUntilAvailable(tokenID);
        let textTimeleft = utils.timeLeft(time);
        if (textTimeleft[0] !== -1){
            logUtils.log(`${tokenID} => ${loot} => time left ${textTimeleft[0]}h${textTimeleft[1]}m`);
        } else {
            logUtils.log(`${tokenID} => ${loot} => ready`);
        }
    } else {
        logUtils.log(`${tokenID} => ${loot}`);
    }
}

const getLoot = async (tokenID) => {
    if (typeof contractGetLoot === 'undefined') {
        contractGetLoot = new utils.web3.eth.Contract(abi, address);
    }
    return await contractGetLoot.methods.scout(tokenID).call();
}

const getTimeUntilAvailable = async (tokenID) => {
    if (typeof contractGetTimeUntilAvailable === 'undefined') {
        contractGetTimeUntilAvailable = new utils.web3.eth.Contract(abi, address);
    }
    return await contractGetTimeUntilAvailable.methods.adventurers_log(tokenID).call();
}

module.exports = {
    dungeonName,
    run,
    scout,
    getTimeUntilAvailable
}