const { request, gql }  = require ('graphql-request');
const fs = require('fs');
const util = require('util');
const readline = require('readline');
const stream = require('stream');
const constVal = require("../shared/const");
const logUtils = require("../shared/logUtils");
const rename = util.promisify(fs.rename);
const unlink = util.promisify(fs.unlink);
const dataDb = require('../data');

const SUMMONERS = gql`
    query getSummoners($owner: String!, $skip: Int!) {
        summoners(skip: $skip first: 1000, where: { owner: $owner }) {
            id
            owner
            _class
            _level
        }
    }
`

const getTokenList = async function (owner) {
    let tokenList = [];
    let skip = 0;
    let currentResCount = 0;
    do {
        await request('https://api.thegraph.com/subgraphs/name/rarity-adventure/rarity', SUMMONERS, {owner: owner.toLowerCase(), skip:skip})
            .then((data) => {
                data.summoners.forEach((elem) => {
                    let tokenID = parseInt(elem.id, 16);
                    tokenList.push(tokenID);
                })
                currentResCount = data.summoners.length;
            });
        skip += 1000;
    }
    while (currentResCount !== 0)

    return tokenList;
}

const getTokenCount = async (owner) => {
    return (await getTokenList(owner)).length;
}

const updateDotEnvFile = async function (tokens){
    const newTokenLine = `TOKENIDS = '${tokens.join(',')}'`;
    const file = constVal.envFile;
    const readStream = fs.createReadStream(file)
    const tempFile = `${file}.tmp`
    const writeStream = fs.createWriteStream(tempFile)
    const rl = readline.createInterface(readStream, stream)
    await rl.on('line', (originalLine) => {

        // Replace.
        if ((/^TOKENIDS/.exec(originalLine)) !== null) {
            return writeStream.write(`${newTokenLine}\n`)
        }
        // Save original line.
        writeStream.write(`${originalLine}\n`)
    })

    await rl.on('close', () => {
        // Finish writing to temp file and replace files.
        // Replace original file with fixed file (the temp file).
        writeStream.end(async () => {
            try {
                await unlink(file) // Delete original file.

                await rename(tempFile, file) // Rename temp file with original file name.
                logUtils.log(`the [${file}] file has been successfully updated with ${tokens.length} tokens`);
            } catch (e) {
                logUtils.log(`error when updating the [${file}] file with new tokens`);
                if (constVal.debug){
                    logUtils.log(e);
                }
            }
        });
    });
}

module.exports = {
    getTokenList,
    updateDotEnvFile,
    getTokenCount,
};