const NETWORK = require("../legacy/config/network-config.js");
//const coin = require("./coin/main_logic.js");
const queue = require("../utils/queue.js");
const { generateRandomToken } = require("../utils/general.js");
const logger = require("../utils/logger.js").logger;
const MysqlCon = require("../utils/mysql.js").Mysql;

const express = require("express");
const app = express();

const bodyParser = require("body-parser");
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

const mysql = new MysqlCon();

/* Initialise Kraken API */
const kraken = require("kraken-api-wrapper")(
    NETWORK.config.apiKey,
    NETWORK.config.privateApiKey
);
kraken.setOtp(NETWORK.config.twoFactor);

/* Functions */
const checkDebug = (argv, logger) => {
    // Check for command-line arguments
    if (argv.length > 3) {
        let debug = false;
        let debugSplitArr = argv[2].split("=");

        if (debugSplitArr[0].toLowerCase() === "debug") {
            debug = debugSplitArr[1] === "true";
        }
        /* Turn off console.log */
        if (debug === false) {
            logger.disableLogger();
        }
    }
};

/* Main code proper */

/* Check for debug (logging) */
checkDebug(process.argv, logger);

async function init() {
    //const coinTracker = new coin();

    /*botQueue.enqueue(async () => {
        kraken
            .Time()
            .then((result) => console.log(result))
            .catch((err) => console.error(err));
    });

    botQueue.enqueue(async () => {
        kraken
            .AssetPairs({ pair: "BTCUSD" })
            .then((result) => console.log(result))
            .catch((err) => console.error(err));
    });*/

    //const botQueue = new queue();
    //botQueue.enqueue(async () => {
    kraken
        .Depth({ pair: "USDTZUSD" })
        .then((result) => console.log(result))
        .catch((err) => console.error(err));
    //});

    /*let heartbeatId = setInterval(async () => {
        if (Date.now() % 2) {
            //botQueue.dequeue()();
        } else {
            coinTracker.process();
            coinTracker.queue().dequeue()();
        }
    }, 500);*/
}

/* REST API Endpoints */
app.listen(1408, () => {
    console.log("Server running on port 1408");
});

app.get("/api/advice", async (req, res, next) => {
    // Here we return a json array of coins, probabilities, stance, and advice.

    // 1. Get list of coins
    await mysql.getCoinList(async (coins) => {
        console.log(coins);

        // 2. Get current coin advice for each coin

        let coinsCounter = 1;
        let coinsPromises = Array();
        coins.forEach((el, index) => {
            coinsPromises[index] = new Promise(async (resolve, reject) => {
                await mysql.getCoinAdvice(el.id, function (adviceArr) {
                    // If we found advice for the array
                    if (adviceArr) {
                        resolve([el.coin_name, adviceArr]);
                    } else {
                        resolve();
                    }
                });
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
});

app.get("/api/locked_advice", (req, res, next) => {
    let botId = req.query.botId;
    let token = req.query.token;

    if (botId === undefined || token === undefined) {
        res.json({
            response: 400,
        });
        return;
    }

    res.json({
        response: 200,
    });
});

app.get("/api/assign_bot", async (req, res, next) => {
    /* Here we find a bot that hasn't been assigned, and supply the id, api config, and fees */
    let botIdName = new Promise(async (resolve, reject) => {
        await mysql.assignBot(function (botId, botName) {
            if (botId) {
                resolve({ botId: botId, botName: botName });
            } else {
                resolve();
            }
        });
    });

    await botIdName.then(function (result) {
        botIdName = result;
    });

    if (botIdName == null) {
        /* Major error at this point. We should have been able to assign available bots */
        res.json({
            response: 400,
        });
        return;
    }

    let botConfig = new Promise(async (resolve, reject) => {
        await mysql.getBotConfig(botIdName.botId, function (botConfig) {
            if (botConfig) {
                resolve(botConfig);
            } else {
                resolve();
            }
        });
    });

    await botConfig.then(function (result) {
        botConfig = result;
    });

    let exchangeFees = new Promise(async (resolve, reject) => {
        await mysql.getExchangeFees(botConfig.exchange_id, function (fees) {
            // If we found advice for the array
            if (fees) {
                resolve(fees);
            } else {
                resolve();
            }
        });
    });

    await exchangeFees.then(function (result) {
        exchangeFees = result;
    });

    res.json({
        id: botIdName.botId,
        name: botIdName.botName,
        api_config: botConfig,
        fees: exchangeFees,
        response: 200,
    });
});

app.post("/api/unassign_bot", async (req, res, next) => {
    let botId = req.body.botId;
    /* Here we unassign the bot */
    mysql.unassignBot(botId);

    res.json({
        response: 200,
    });
});

app.post("/api/lock_bot", async (req, res, next) => {
    let botId = req.body.botId;
    let coinId = req.body.coinId;
    let tradeBotToken = generateRandomToken();

    if (botId === undefined || coinId === undefined) {
        res.json({
            response: 400,
        });
        return;
    }

    mysql.checkBotLock(botId, function (isLocked) {
        if (isLocked === false) {
            mysql.addToken(botId, coinId, tradeBotToken);
            res.json({
                token: tradeBotToken,
                response: 200,
            });
        } else {
            res.json({
                token: "",
                // Conflict, already exists
                response: 409,
            });
        }
    });
});

app.post("/api/release_bot", (req, res, next) => {
    let botId = req.body.botId;
    let token = req.body.token;

    if (botId === undefined || token === undefined) {
        res.json({
            response: 400,
        });
        return;
    }

    mysql.checkBotLock(botId, function (isLocked) {
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
});
