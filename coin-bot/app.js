const NETWORK = require('../legacy/config/network-config.js');
//const coin = require("./coin/main_logic.js");
const MainLogic = require('./main_logic.js').MainLogic;
const queue = require('../utils/queue.js');
const {
    generateRandomToken,
    encryptCodeOut,
    hash512,
    encryptAES,
} = require('../utils/general.js');
const logger = require('../utils/logger.js').logger;
const MysqlCon = require('../utils/mysql2.js').Mysql;

const express = require('express');
const app = express();

const bodyParser = require('body-parser');
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

const mysql = new MysqlCon();

const exchangeName = 'kraken';
//const exchangeName = 'binance';

/* Initialise Kraken API */
const kraken = require('kraken-api-wrapper')(
    NETWORK.config.apiKey,
    NETWORK.config.privateApiKey
);
kraken.setOtp(NETWORK.config.twoFactor);

/* Functions */
const checkDebug = (argv, logger) => {
    // Check for command-line arguments
    if (argv.length > 3) {
        let debug = false;
        let debugSplitArr = argv[2].split('=');

        if (debugSplitArr[0].toLowerCase() === 'debug') {
            debug = debugSplitArr[1] === 'true';
        }
        /* Turn off console.log */
        if (debug === false) {
            logger.disableLogger();
        }
    }
};

const checkSalt = async (code, name) => {
    /* Here we check if salt in DB is same as code sent by bot */
    let properCode = encryptCodeOut(code);
    let salt = hash512(properCode, name);

    /* Here we check if salt in DB. If so, assign the bot; If not some little hacker is hacking a little too hacking much */

    return await mysql.checkSalt(salt);
};

/* Main code proper */

/* Check for debug (logging) */
checkDebug(process.argv, logger);

const main = new MainLogic(mysql);
init();

async function init() {
    let heartbeatId = setInterval(async () => {
        main.processQueues();
    }, 50);
}

/* REST API Endpoints */
app.listen(1408, () => {
    console.log('Server running on port 1408');
});

app.get('/api/advice', async (req, res, next) => {
    // Here we return a json array of coins, probabilities, stance, and advice.
    let code = req.query.code;
    let name = req.query.name;

    let hasSalt = await checkSalt(code, name);

    if (hasSalt !== true) {
        res.json({
            response: 400,
        });
        return;
    }

    // 1. Get list of coins
    let coins = await mysql.getCoinList();
    //console.log(coins);

    // 2. Get current coin advice for each coin
    let coinsCounter = 1;
    let coinsPromises = Array();
    coins.forEach((el, index) => {
        coinsPromises[index] = new Promise(async (resolve, reject) => {
            let adviceArr = await mysql.getCoinAdvice(el.id);
            // If we found advice for the array
            if (adviceArr) {
                resolve({
                    coin_id: el.id,
                    coin_name: el.coin_name,
                    coin_exchange_id: el[`coin_id_${exchangeName}`],
                    coin_advice: adviceArr,
                });
            } else {
                resolve();
            }
        });
    });

    await Promise.all(coinsPromises).then((coinInnerArr) => {
        /* Remove null */
        coinInnerArr = coinInnerArr.filter(function (el) {
            return el != null;
        });

        // 3. Return json arrays
        res.json({
            coins: coinInnerArr,
            response: 200,
        });
    });
});

app.get('/api/locked_advice', (req, res, next) => {
    // Here we return a json array of coins, probabilities, stance, and advice.
    let botId = req.query.botId;
    let token = req.query.token;

    // 1. Get list of coins
    let coins = await mysql.getCoinList();
    let lockedAdvice = await mysql.getLockedCoin();

    // 2. Get current coin advice for each coin
    let coinsPromises = Array();
    coins.forEach((el, index) => {
        coinsPromises[index] = new Promise(async (resolve, reject) => {
            if (el['id'] === lockedAdvice['coin_id']) {
                let adviceArr = await mysql.getCoinAdvice(el.id);
                // If we found advice for the array
                if (adviceArr) {
                    resolve({
                        coin_id: el.id,
                        coin_name: el.coin_name,
                        coin_exchange_id: el[`coin_id_${exchangeName}`],
                        coin_advice: adviceArr,
                    });
                }
            } else {
                resolve();
            }
        });
    });

    await Promise.all(coinsPromises).then((coinInnerArr) => {
        /* Remove null */
        coinInnerArr = coinInnerArr.filter(function (el) {
            return el != null;
        });

        // 3. Return json arrays
        res.json({
            coin: coinInnerArr,
            response: 200,
        });
    });
});

app.get('/api/num_assigned_bots', async (req, res, next) => {
    let code = req.query.code;
    /* Here we unassign the bot */
    let numAssignedBots = await mysql.getNumberOfBots();

    res.json({
        numOfBots: numAssignedBots['count'],
        response: 200,
    });
});

app.post('/api/assign_bot', async (req, res, next) => {
    /* Here we find a bot that hasn't been assigned, and supply the id, api config, and fees */
    let code = req.body.code;
    let name = req.body.name;

    let hasSalt = await checkSalt(code, name);

    if (hasSalt !== true) {
        res.json({
            response: 400,
        });
        return;
    }

    const [botId, botName] = await mysql.assignBot();
    let botIdName = null;

    if (botId) {
        botIdName = { botId: botId, botName: botName };
    }

    if (botIdName == null) {
        /* Major error at this point. We should have been able to assign available bots */
        res.json({
            response: 400,
        });
        return;
    }

    let botConfig = await mysql.getBotConfig(botIdName.botId);
    let exchangeFees = await mysql.getExchangeFees(botConfig.exchange_id);

    /* We encrypt the bot config */
    res.json({
        id: botIdName.botId,
        name: botIdName.botName,
        api_config: encryptAES(name + code, JSON.stringify(botConfig)),
        fees: exchangeFees,
        response: 200,
    });

    console.log(`Status: Bot ${name} successfully authenticated and assigned.`);
});

app.post('/api/unassign_bot', async (req, res, next) => {
    let botId = req.body.botId;
    /* Here we unassign the bot */
    await mysql.unassignBot(botId);

    res.json({
        response: 200,
    });
});

app.post('/api/lock_bot', async (req, res, next) => {
    let botId = req.body.botId;
    let coinId = req.body.coinId;
    let tradeBotToken = generateRandomToken();

    if (botId === undefined || coinId === undefined) {
        res.json({
            response: 400,
        });
        return;
    }

    let isLocked = await mysql.checkBotLock(botId);
    if (isLocked === false) {
        await mysql.addToken(botId, coinId, tradeBotToken);
        res.json({
            token: tradeBotToken,
            response: 200,
        });
    } else {
        res.json({
            token: '',
            // Conflict, already exists
            response: 409,
        });
    }
});

app.post('/api/release_bot', async (req, res, next) => {
    let botId = req.body.botId;
    let token = req.body.token;

    if (botId === undefined || token === undefined) {
        res.json({
            response: 400,
        });
        return;
    }

    let isLocked = await mysql.checkBotLock(botId);
    if (isLocked === true) {
        mysql.removeToken(token);
        res.json({
            response: 200,
        });
    } else {
        res.json({
            // Gone
            response: 410,
        });
    }
});

app.get('/api/get_bot_info', async (req, res, next) => {
    let botId = req.query.botId;
    let botInfo = await mysql.getBotInformation(botId);

    res.json({
        botInfo: botInfo,
        response: 200,
    });
});

app.post('/api/set_bot_info', async (req, res, next) => {
    let botId = req.body.botId;
    let botInfo = req.body.botInfo;

    if (botId === undefined || botInfo === undefined) {
        res.json({
            response: 400,
        });
        return;
    }

    mysql.storeBotInformation(botId, botInfo);
});
