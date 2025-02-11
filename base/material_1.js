const constVal = require("../shared/const");
const utils = require('../shared/utils');
const logUtils = require("../shared/logUtils");
const {contractAddresses} = require('../shared/contractAddresses');
const ethers = require("ethers");
const fileUtils = require("../shared/fileUtils");
const txUtils = require("../shared/txUtils");
const {getOwnerOfToken} = require("./core");
const abi = contractAddresses.materials1ABI;
const address = contractAddresses.rarityMaterials1;

let contractGetInventory;
let contractTransfer;

const getInventory = async (tokenID) => {
    if (typeof contractGetInventory === 'undefined') {
        contractGetInventory = new utils.web3.eth.Contract(abi, address);
    }
    return await contractGetInventory.methods.balanceOf(tokenID).call();
}

const transfer = async (tokenFrom, tokenTo, amount) => {
    let thisGas = await utils.calculateGasPrice()
    if (thisGas < 0) {
        logUtils.log(`${tokenFrom} > ${tokenTo} => transfer material1 => Gas Price too high: ${-thisGas}`)
        return [false, 'high gas']
    } else {
        if (constVal.liveTrading) {
            try {
                if (typeof contractTransfer === 'undefined') {
                    contractTransfer = new ethers.Contract(address, abi, constVal.nonceManager);
                }
                logUtils.log(`${tokenFrom} > ${tokenTo} => start transfer materials1`);
                let approveResponse = await contractTransfer.transfer(
                    tokenFrom,
                    tokenTo,
                    amount,
                    {
                        gasLimit: constVal.totalGasLimit,
                        gasPrice: thisGas,
                        //nonce: await utils.getNonce(nonce)
                    });
                let receipt = await txUtils.waitForTx(`${tokenFrom} > ${tokenTo}`, approveResponse, 'transfer materials1');
                logUtils.log(`${tokenFrom} > ${tokenTo} => transfer materials1 success`);
                if (constVal.debug){
                    logUtils.log(approveResponse);
                }
                return [receipt.status === 1, 'success'];
            } catch (e){
                logUtils.log(`${tokenFrom} > ${tokenTo} => transfer materials1 error`);
                fileUtils.logToFile(`transfer materials1 error\n${e.toString()}`);
                if (constVal.debug){

                    logUtils.log(e);
                }
                return [false, 'error'];
            }
        } else {
            logUtils.log(`${tokenFrom} > ${tokenTo} Live trading disabled - adventuring NOT submitted.`)
            return [false, 'not live'];
        }
    }
}

const transferToMule = async (tokenID, amount) => {
    let mule = constVal.mule.materials1;
    if (typeof mule === 'undefined' || mule.length === 0){
        logUtils.log(`${tokenID} => can't transfer materials1 no mule defined, define MATERIALS_1_MULE to make it work, you can disable by setting AUTO_TRANSFER_TO_MULE in .env`);
        return [false, 'no mule defined'];
    }
    if (tokenID === mule){
        return [false, 'same token as mule'];
    }
    if (constVal.mule.materials1Address.length > 0){
        try {
            let owner = await getOwnerOfToken(tokenID);
            if (owner !== constVal.mule.materials1Address){
                logUtils.log(`${tokenID} => can't transfer materials1 to mule, owner of mule does not match`);
                return [false, 'owner of mule does not match'];
            }
        } catch (e) {
            logUtils.log(`${tokenID} => can't transfer materials1 to mule, mule does not exist`);
            return [false, 'token does not exist'];
        }
    }
    return await transfer(tokenID, mule, amount);
}

module.exports = {
    getInventory,
    transfer,
    transferToMule
}