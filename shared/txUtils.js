const logUtils = require("../shared/logUtils");
const dataUtils = require('../data');
const utils = require("./utils");
const constVal = require('./const');

let batchPendingWait = [];

const waitForTx = async (tokenID, tx, type) => {
    if (!constVal.batchMode){
        return await processTx(tokenID, tx, type);
    }
    batchPendingWait.push({
        tokenID: tokenID,
        tx: tx,
        type: type
    });
    if (batchPendingWait.length >= constVal.batchThreshold){
        logUtils.log(`Batch threshold reach, starting wait of tx (${batchPendingWait.length}/${constVal.batchThreshold})`);
        let i = 1;
        for (let batchItem of batchPendingWait){
            await processTx(batchItem.tokenID, batchItem.tx, batchItem.type, i++);
        }
        batchPendingWait = [];
    } else {
        logUtils.log(`Tx added to batch pending (${batchPendingWait.length}/${constVal.batchThreshold})`);
    }
    return {status: 1};
}

const processTx = async(tokenID, tx, type, i = 0) => {
    let transactionReceipt
    try {
        transactionReceipt = await tx.wait();
    } catch (e) {
        transactionReceipt = e.receipt;
    }
    let actual_cost = (transactionReceipt.gasUsed * (tx.gasPrice / 10**18));
    let iteratorText = '';
    if (i > 0){
        iteratorText = `(#${i}) `;
    }
    if (transactionReceipt.status === 1){
        logUtils.log(`${iteratorText}${tokenID} => Tx success, cost: ${actual_cost.toFixed(5)} FTM, id: ${tx.hash}`);
    } else {
        logUtils.log(`${iteratorText}${tokenID} => Tx failed, cost: ${actual_cost.toFixed(5)} FTM, id: ${tx.hash}`);
    }

    switch (type) {
        case 'transfer gold':
        case 'transfer rar':
        case 'transfer materials1':
            const regex = /^[^\s>]+/;
            let m;
            if ((m = regex.exec(tokenID)) !== null) {
                dataUtils.insertTokenTx(m[0], tx.hash, actual_cost.toFixed(18), type, transactionReceipt.status);
            }
            break;
        case 'summon':
            if (transactionReceipt.status === 1){
                tokenID = extractTokenIdFromSummon(transactionReceipt);
                dataUtils.insertToken(tokenID);
                dataUtils.insertTokenTx(tokenID, tx.hash, actual_cost.toFixed(18), type, transactionReceipt.status);
            }
            break;
        default:
            dataUtils.insertTokenTx(tokenID, tx.hash, actual_cost.toFixed(18), type, transactionReceipt.status);
    }

    return transactionReceipt;
}

const checkAndProcessLastPending = async () => {
    if (batchPendingWait.length > 0){
        logUtils.log(`${batchPendingWait.length} pending tx, start wait of tx`);
        for (let batchItem of batchPendingWait){
            await processTx(batchItem.tokenID, batchItem.tx, batchItem.type);
        }
        batchPendingWait = [];
    } else {
        logUtils.log(`No pending tx`);
    }
}

const extractTokenIdFromSummon = (txReceipt) => {
    let tokenHex = utils.sliceDataTo32Bytes(txReceipt.logs[1].data, 1);
    return parseInt(tokenHex, 16);
}

module.exports = {
    waitForTx,
    checkAndProcessLastPending
}