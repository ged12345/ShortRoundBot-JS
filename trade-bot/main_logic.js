const Queuer = require('../utils/queuer.js').Queuer;
const Queue = require('../utils/queue.js');
const API = require('../utils/api.js');
const { encryptCodeIn, encrypt512 } = require('../utils/general.js');
const eventConstants = require('./constants.js').BOT_EVENT;
const code = require('./constants.js').BOT_CODE['primer'];
const botNames = require('./constants.js').BOT_NAMES;
const { calculateSellUrgencyFactor } = require('../utils/math.js');
class MainLogic {
    // Need to "lock" bot when new info comes in.

    constructor(kraken, exchangeName) {
        this.kraken = kraken;
        this.primeCode = encryptCodeIn(code);
        this.lockToken = null;
        this.lockedCoinId = 0;
        this.exchangeName = exchangeName;
        this.exchangeCoinId = '';
        this.state = eventConstants.SEEKING_COIN;
        this.queueSetupComplete = false;

        /* 1 dollar when testing */
        this.wageredFloat = 1.0;

        /* We keep track of how much we've gained or lost here */
        this.totalInitialFloat = this.wageredFloat;
        this.totalCurrentFloat = this.wageredFloat;
        this.initialTradeTimestamp = null;
        this.initialTradeClosePrice = 0.0;
        /* This factor increased per minute */
        this.minCoinAppreciationPercentPerMin = 0.05;

        /* If our loss count variable >= 3, or the total loss is more than 33% of the float, stop the bot. */
        this.lossCount = 0;
        this.totalLoss = 0.0;

        /* The maximum amount of time we hold onto a trade. If the close price hasn't risen appreciably in this time, best to sell */
        this.maxTradeTime = 60000 * 10;

        /* IDs of current Kraken trades */
        this.takeProfitTXID = '';
        this.stopLossTXID = '';

        this.takeProfitPrice = 0;
        this.stopLossPrice = 0;
        this.currentVolume = 0;

        this.getBotConfig();
        this.getBotInformation();
        this.setupQueues();
    }

    async getBotConfig() {
        /* We need the bot config information to communicate with the exchange so it can do trades*, the bot ID, and max fees for the exchange */

        /* We do our little dance */
        let currNumberOfBots = new Promise(async (resolve, reject) => {
            API.numAssignedBots(this.primeCode, function (numOfBots) {
                resolve(numOfBots);
            });
        });

        await currNumberOfBots.then(function (result) {
            currNumberOfBots = result;
        });

        let botName = botNames[currNumberOfBots];

        let config = new Promise(async (resolve, reject) => {
            API.assignBot(this.primeCode, botName, function (config) {
                resolve(config);
            });
        });

        await config.then(function (result) {
            config = result;
        });

        /* When we contact the coin bot, this is our main 'key' */
        this.id = config.id;
        this.name = config.name;
        this.trade_api_config = config.api_config;
        this.exchange_fees = config.fees;

        console.log(
            `Bot assigned!\n\nid: ${this.id}\nname: ${this.name}\napi-config:${this.trade_api_config}\nfees: ${this.exchange_fees}`
        );
    }

    async getBotInfo() {
        let botInfo = new Promise(async (resolve, reject) => {
            API.getBotInfo(this.id, function (botInfo) {
                resolve(botInfo);
            });
        });

        await botInfo.then(function (result) {
            botInfo = result;
        });

        this.wageredFloat = Number(botInfo['float_usd']);
    }

    async setBotInfo(botInfo) {
        let botInfo = new Promise(async (resolve, reject) => {
            API.setBotInfo(this.id, botInfo, function () {
                resolve();
            });
        });

        await botInfo.then(function (result) {
            botInfo = result;
        });
    }

    setupQueues() {
        /* Setup the main queues */
        this.mainQueuer = new Queuer();

        /* This is the queue to check coin bot, whether locked or not */
        this.coinAdviceQueue = new Queue();
        this.setupCoinAdviceQueue();

        /* This is the queue to check for the bots current trades, whether they've completed etc. */
        this.tradeOrderQueue = new Queue();
        this.setupTradeOrderQueue();

        this.mainQueuer.enqueueQueue(
            this.coinAdviceQueue,
            500,
            true,
            true,
            true,
            10000 /* Just after the close */
        );

        this.mainQueuer.enqueueQueue(
            this.coinAdviceQueue,
            500,
            true,
            true,
            true,
            40000 /* Just after the close */
        );

        this.mainQueuer.enqueueQueue(this.tradeOrderQueue, 500, true);

        this.queueSetupComplete = true;
    }

    processQueues() {
        /* Here we process both incoming coin bot advice (locked or not) and monitor bots current trades */
        if (this.queueSetupComplete === true) {
            this.mainQueuer.processQueues();
        }
    }

    /* Here we add the code that checks the coin bot and locks the bot in if the coin bot advice is good and probability high */
    setupCoinAdviceQueue() {
        this.coinAdviceQueue.enqueue(async () => {
            this.mainCoinAdviceLogic();
        });
    }

    mainCoinAdviceLogic() {
        /* If we don't have a token, we just look for advice. Once we have a token, we don't do anything with the coin advice */
        if (this.lockToken === null) {
            if (this.state === eventConstants.SEEKING_COIN) {
                this.getAdvice();
            } else if (
                this.lockedCoinId !== 0 &&
                this.state === eventConstants.SHAKING_HANDS
            ) {
                this.lockBot();
            }
        }
    }

    setupTradeOrderQueue() {
        this.tradeOrderQueue.enqueue(async () => {
            this.mainTradeOrderLogic();
        });
    }

    mainTradeOrderLogic() {
        /* Locked advice will be more specific: If the coin is currently falling sharply, lots of sell orders (asks) and volume compared to bids in Order Book, the coin bot may put out a SELL_IMMEDIATELY request, if somehow we've missed the boat. */
        if (this.lockToken !== null) {
            if (
                this.state === eventConstants.TRADE_LOCKED ||
                this.state === eventConstants.FINALISING_TRADE ||
                this.state === eventConstants.ORDER_FINALISED
            ) {
                this.getLockedAdvice();
                /* IMPORTANT: Monitor trades and cancel others if one condition has been reached */
                /* We use GetOpenOrders kraken API call */

                let stopLossOrderFinalised = false;
                let takeProfitOrderFinalised = false;

                /*
                this.kraken
            .QueryOrders({ txid: this.stopLossTXID })
            .then(async (result) => {
                if(result[`${this.stopLossTXID}`]["status"] == "closed") {
                    this.takeProfitTXID = "";
                }
            })
                    .catch((err) => {
                        console.error(err);
                        return false;
                    })
            .QueryOrders({ txid: this.takeProfitTXID })
            .then(async (result) => {
                this.stopLossTXID = "";

                if(this.takeProfitTXID === "") || (this.stopLossTXID === "") {
                    finaliseOrder();
                }
            })
                    .catch((err) => {
                        console.error(err);
                        return false;
                    });
                */
            }
            if (this.state === eventConstants.TRADE_LOCKED) {
                /* Here we perform the actual trade order (can't do bracketed via API */
                console.log('Status: Preparing trade!');
                this.initialTradeClosePrice = this.advice['initialClose'];
                this.state = eventConstants.PREPARING_TRADE;
                /* We format a kraken trade order */
                prepareOrder();

                this.state = eventConstants.ORDER_FINALISED;
            }
        }
    }

    lockBot() {
        API.lockBot(this.id, this.lockedCoinId, (lockToken) => {
            this.lockToken = lockToken;
            this.state = eventConstants.TRADE_LOCKED;
            console.log('Status: Locked bot to a trade!');
        });
    }

    unlockBot() {
        API.releaseBot(this.id, this.lockedCoinId, (lockToken) => {
            this.lockToken = null;
            this.state = eventConstants.SEEKING_COIN;
            console.log('Status: Unlocked bot and seeking coin!');
        });
    }

    getAdvice() {
        API.getAdvice(this.primeCode, this.name, (advice) => {
            this.advice = advice;
            /* Here we will calculate the best option from
            the advice supplied, including probability. Hard coded for testing. */

            this.state = eventConstants.SHAKING_HANDS;
            /* Debug - we just set coin for now */
            this.lockedCoinId = 1;
            this.exchangeCoinId =
                this.advice['coins'][this.lockedCoinId][
                    `coin_id_${this.exchangeName}`
                ];

            /* Once we get this advice, we need to determine whether to buy or sell and then move to locked advice */
            console.log('Status: Shaking hands and getting advice!');
            console.log(this.advice);
        });
    }

    getLockedAdvice() {
        API.getLockedAdvice(this.id, this.lockToken, (advice) => {
            this.advice = advice;
            /* Here we will calculate the best option from
            the advice supplied, including probability. Hard coded for testing. */

            /* Here we check the locked advice to see if we sell or not from this advice */
            if (this.checkAdvice()) {
                this.finaliseTrade();
            }

            console.log('Status: Getting locked trading advice!');
        });
    }

    prepareOrder() {
        /* We grab the current ticker price */
        this.kraken
            .Ticker({ pair: this.exchangeCoinId })
            .then(async (result) => {
                //console.log(result);
                /* Bid price is highest price asked atm */
                let currentBidPrice = Number(result['b'][0]);
                let currentAskPrice = Number(result['a'][0]);
                let currentClosePrice = Number(result['a'][0]);
                let topLimitPrice = currentBidPrice * 1.015;
                let bottomLimitPrice = currentAskPrice * 0.98;

                /* Let's calculate the volume based on our float and current price */
                this.currentVolume = currentClosePrice / this.wageredFloat;

                console.log(
                    `Prepare order: ${currentBidPrice} ${currentAskPrice} ${topLimitPrice} ${bottomLimitPrice}`
                );

                /* Initial purchase of coin */
                this.kraken
                    .AddOrder({
                        pair: this.exchangeCoinId,
                        ordertype: 'market',
                        type: 'buy',
                        volume: this.currentVolume,
                    })
                    .then(async (result) => {})
                    .catch((err) => {
                        console.error(err);
                        return false;
                    })
                    /* Take profit order (immediate sell at market price once we hit limit) for top limit price (actual limit trade may not be filled - we may do this later if not making enough, with monitoring) */
                    .AddOrder({
                        pair: this.exchangeCoinId,
                        ordertype: 'take-profit',
                        type: 'sell',
                        volume: this.currentVolume,
                        price: topLimitPrice,
                    })
                    .then(async (result) => {})
                    .catch((err) => {
                        console.error(err);
                        return false;
                    }) /* Take stop loss for bottom limit price */
                    .AddOrder({
                        pair: this.exchangeCoinId,
                        ordertype: 'stop-loss',
                        type: 'sell',
                        volume: this.currentVolume,
                        price: bottomLimitPrice,
                    })
                    .then(async (result) => {})
                    .catch((err) => {
                        console.error(err);
                        return false;
                    });

                this.initialTradeTimestamp = Date.now();
                return true;
            })
            .catch((err) => console.error(err));

        /*kraken
    .Ticker({ pair: "BTCUSD" })
    .then((result) => console.log(result))
    .catch((err) => console.error(err));

        /*
        - Here we calculate the percentage (1.5%) to set our top limit.
        - Calculate the stop loss price
        */
    }

    checkAdvice() {
        /* Here we calculate whether we hold onto this coin based on the advice.
        NOTE: We also have to build in a timelimit, so we let a coin go after 5-10 mins*/

        if (this.initialTradeTimestamp != null) {
            return false;
        }

        let currentTimestamp = Date.now();
        let urgencyFactor = calculateSellUrgencyFactor(
            this.initialTradeClosePrice,
            this.initialTradeTimestamp,
            Date.now(),
            this.maxTradeTime / 1000.0
        );

        /* We need to determine if we sell early based on max trade time and whether the coin has appreciated in price by a certain margin in a certain time */

        /* UNCOMMENT LATER */
        /* sellEarly(); */

        return true;
    }

    sellEarly() {
        this.kraken
            .AddOrder({
                pair: this.exchangeCoinId,
                ordertype: 'market',
                type: 'sell',
                volume: this.currentVolume,
            })
            .then(async (result) => {})
            .catch((err) => {
                console.error(err);
                return false;
            });
        cancelOrders();
    }

    cancelOrders() {
        if (this.takeProfitTXID !== '') {
            this.kraken
                .CancelOrder({ txid: this.takeProfitTXID })
                .then(async (result) => {
                    this.takeProfitTXID = '';
                })
                .catch((err) => {
                    console.error(err);
                    return false;
                });
        } else if (this.stopLossTXID !== '') {
            this.kraken
                .CancelOrder({ txid: this.stopLossTXID })
                .then(async (result) => {
                    this.stopLossTXID = '';
                })
                .catch((err) => {
                    console.error(err);
                    return false;
                });
        }
    }

    finaliseTrade() {
        /* We should cancel stop loss or any existing trades here */
        cancelOrders();

        /* Wipe out current trade timestamp etc.at end of trade */
        this.currentTradeTimestamp = null;
        this.coinId = 0;
        this.exchangeCoinId = '';
        this.initialTradeClosePrice = 0.0;
        this.initialTradeTimestamp = null;
        this.takeProfitTXID = '';
        this.stopLossTXID = '';
        this.takeProfitPrice = 0;
        this.stopLossPrice = 0;
        this.currentVolume = 0;

        if (!this.hasLowProfitability()) {
            //this.state = eventConstants.SEEKING_COIN;
        }
    }

    hasLowProfitability() {
        /* If we lose money too many times and the loss is too great (33%), immediately shutdown */
        if (this.lossCount >= 3 && this.totalLoss >= this.currentFloat / 3.0) {
            this.shutdown();
            return true;
        } else {
            return false;
        }
    }

    shutdown() {
        this.cleanup((didUnassigned) => {});
        process.exit();
    }

    cleanup(cb) {
        /* TODO: For now we remove the token when the bot is shutdown - later, we'll want the bot to detect the token and go back to the current trade */
        if (this.lockToken !== null) {
            API.releaseBot(this.id, this.lockToken, () => {
                this.lockToken = null;
            });
        }

        if (this.id) {
            API.unassignBot(this.id, function (didUnassigned) {
                cb(didUnassigned);
            });
        } else {
            console.log('Warning: Too many ids assigned.');
            cb(true);
        }
    }
}

module.exports = {
    MainLogic,
};
