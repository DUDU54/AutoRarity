const ethers = require("ethers");
const { NonceManager } = require("@ethersproject/experimental");
const parseArg = require('mri');
const parseBool = (val) => {return val === true || val === 'true'}


const fantomRpcUrl = 'https://rpc.ftm.tools/';
const totalGasLimit = 125000 // 50,000 seems sensible for general xping up and 30,000 seems right for levelling, claim gold is ~100k
const defaultMaxGasPx = 250 // usually 50-100, sometimes this spikes to nearly 200
const xpRetryDelay = 24 * 60 * 60 // 1 day in seconds - try to level up every 24hrs
const gasRetryDelay = 5 * 60 // if gas is too expensive then try again in 5 mins
const xpPendingDelay = 2 * 60 // if you're waiting for xp to be earned before levelling up then try again in 2 mins
const minimumDelay = 60 // don't repeat too often
// Don't set the delays too short or you'll keep trying to XP up and just burn gas for no reason

const classes = ['noClass', 'Barbarian', 'Bard', 'Cleric', 'Druid', 'Fighter', 'Monk', 'Paladin', 'Ranger', 'Rogue', 'Sorcerer', 'Wizard'];

const rawArgs = parseArg(process.argv.slice(2));

const debug = rawArgs.debug === undefined ? false : parseBool(rawArgs.debug);

const batchThreshold = rawArgs.batch === undefined ? 0 : (typeof rawArgs.batch === 'number' ? rawArgs.batch : 10);

const batchMode = batchThreshold > 0;

const secretKey = process.env.SECRETKEY;
const walletAddress = process.env.WALLETADDRESS;
const jsonRpcProvider = new ethers.providers.JsonRpcProvider(fantomRpcUrl, 250);
const wallet = ethers.Wallet.fromMnemonic(secretKey);
const account = wallet.connect(jsonRpcProvider);
const nonceManager = new NonceManager(account);

const liveTradingVar = process.env.LIVETRADING;
const liveTrading = liveTradingVar === undefined ? false : parseBool(liveTradingVar);

let muleGoldAddressVar = process.env.GOLD_MULE_ADDRESS;
let muleRarAddressVar = process.env.RAR_MULE_ADDRESS;
let muleMaterials1AddressVar = process.env.MATERIALS_1_MULE_ADDRESS;

const mule = {
    gold: parseInt(process.env.GOLD_MULE, 10),
    goldAddress: muleGoldAddressVar === undefined ? '' : muleGoldAddressVar,
    rar: parseInt(process.env.RAR_MULE, 10),
    rarAddress: muleRarAddressVar === undefined ? '' : muleRarAddressVar,
    materials1: parseInt(process.env.MATERIALS_1_MULE, 10),
    materials1Address: muleMaterials1AddressVar === undefined ? '' : muleMaterials1AddressVar,
}

const autoDungeonCellarVar = process.env.AUTO_DUNGEON_CELLAR;

const autoDungeon = {
    cellar: autoDungeonCellarVar === undefined ? true : parseBool(autoDungeonCellarVar)
}

const autoLevelUpVar = process.env.AUTO_LEVEL_UP;
const autoLevelUp = autoLevelUpVar === undefined ? true : parseBool(autoLevelUpVar);
const autoTransferToMuleVar = process.env.AUTO_TRANSFER_TO_MULE;
const autoTransferToMule = autoTransferToMuleVar === undefined ? false : parseBool(autoTransferToMuleVar);
const claimGoldVar = process.env.ENABLE_CLAIM_GOLD;
const enableClaimGold = claimGoldVar === undefined ? true : parseBool(claimGoldVar);
const claimRarVar = process.env.ENABLE_CLAIM_RAR;
const enableClaimRar = claimRarVar === undefined ? false : parseBool(claimRarVar);
const cellarThresholdVar = process.env.CELLAR_THRESHOLD;
const cellarThreshold = cellarThresholdVar === undefined || cellarThresholdVar.length === 0 ? 5 : parseInt(cellarThresholdVar, 10);

const goldTransferThresholdVar = process.env.GOLD_TRANSFER_THRESHOLD;
const goldTransferThreshold = goldTransferThresholdVar === undefined ? 1000 : parseInt(goldTransferThresholdVar, 10);

const goldClaimThresholdVar = process.env.GOLD_CLAIM_THRESHOLD;
const goldClaimThreshold = goldClaimThresholdVar === undefined ? 1000 : parseInt(goldClaimThresholdVar, 10);

const rarTransferThresholdVar = process.env.RAR_TRANSFER_THRESHOLD;
const rarTransferThreshold = rarTransferThresholdVar === undefined ? 1000 : parseInt(rarTransferThresholdVar, 10);

const rarClaimThresholdVar = process.env.RAR_CLAIM_THRESHOLD;
const rarClaimThreshold = rarClaimThresholdVar === undefined ? 1000 : parseInt(rarClaimThresholdVar, 10);

const materials1TransferThresholdVar = process.env.MATERIALS_1_TRANSFER_THRESHOLD;
const materials1TransferThreshold = materials1TransferThresholdVar === undefined ? 100 : parseInt(materials1TransferThresholdVar, 10);

const maxGasPxVar = process.env.MAXGAS;
if (maxGasPxVar === undefined){maxGasPx = defaultMaxGasPx} else {maxGasPx = Number(maxGasPxVar)}
const maxGasPrice = ethers.utils.parseUnits(maxGasPx.toString(), 9);

let envFile = '.env';
for (let args of rawArgs['_']){
    let dotenvReg = /dotenv_config_path=(.*)/
    let dotenvRegVal = dotenvReg.exec(args);
    if (dotenvRegVal){
        envFile = dotenvRegVal[1];
        break;
    }
}

const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;

const enableTelegramBotVar = process.env.ENABLE_TELEGRAM_BOT;
const enableTelegramBot = enableTelegramBotVar === undefined ? false : parseBool(enableTelegramBotVar);
const chatIdVar = process.env.TELEGRAM_CHAT_ID;
let chatId = chatIdVar === undefined ? '' : chatIdVar; // you may not want to automatically level up your char

const lowFTMVar = process.env.LOW_FTM;
const lowFTM = lowFTMVar === undefined ? 5 : parseInt(lowFTMVar, 10);

let myTokenIds = [];

const scrapArraySize = 50;

module.exports = {
    scrapArraySize,
    fantomRpcUrl,
    totalGasLimit,
    xpRetryDelay,
    gasRetryDelay,
    xpPendingDelay,
    minimumDelay,
    maxGasPrice,
    jsonRpcProvider,
    walletAddress,
    myTokenIds,
    account,
    nonceManager,
    classes,
    liveTrading,
    mule,
    autoLevelUp,
    autoTransferToMule,
    debug,
    envFile,
    enableTelegramBot,
    telegramBotToken,
    chatId,
    lowFTM,
    enableClaimGold,
    enableClaimRar,
    goldTransferThreshold,
    rarTransferThreshold,
    materials1TransferThreshold,
    cellarThreshold,
    goldClaimThreshold,
    rarClaimThreshold,
    batchThreshold,
    batchMode,
    autoDungeon
}