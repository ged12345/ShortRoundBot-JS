const Queuer = require('../utils/queuer.js').Queuer;
const Queue = require('../utils/queue.js');
const API = require('../utils/api.js');
const { encryptCodeIn, decryptAES } = require('../utils/general.js');
const eventConstants = require('./constants.js').BOT_EVENT;
const coinAdviceConstants = require('../coin-bot/constants.js').COIN_ADVICE;
const code = require('./constants.js').BOT_CODE['primer'];
const botNames = require('./constants.js').BOT_NAMES;
const {
    calculateSellUrgencyFactor,
    getRandomInt,
} = require('../utils/math.js');
const Exchange = require('../exchanges/exchange.js');

class MainLogic {
    // Need to "lock" bot when new info comes in.

    constructor() {
        this.primeCode = encryptCodeIn(code);
        this.lockToken = null;
        this.lockedCoinId = 0;
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

        this.oldTrackTradeClosePrice = 0.0;
        this.newTrackTradeClosePrice = 0.0;
        /* This factor increased per minute */
        this.minCoinAppreciationPercentPerMin = 0.05;

        /* If our loss count variable >= 3, or the total loss is more than 33% of the float, stop the bot. */
        this.lossCount = 0;
        this.totalLoss = 0.0;

        /* The maximum amount of time we hold onto a trade. If the close price hasn't risen appreciably in this time, best to sell */
        this.maxTradeTime = {
            profitable: 60000 * 8,
            nonProfitable: 60000 * 10,
        };

        /* IDs of current Kraken trades */
        this.takeProfitTXID = '';
        this.stopLossTXID = '';

        this.takeProfitPrice = 0;
        this.stopLossPrice = 0;
        this.orderPrice = 0;
        this.orderVolume = 0;

        /* Set when we're in a long running trend upwards, as we should fight against selling */
        this.profitableUptrend = false;

        /* The last five coins are lower probability of making profit - we only allow three instances of these an hour, unless we lose too much money and hold up the bots. */
        this.unprofitableCoins = {
            coinIdArray: [4, 5, 6, 7, 8],
            avoidUnprofitableCoins: true,
            unprofitableCoinsAllowedCount: 0,
            unprofitableCoinsAllowedMax: 3,
            resetUnprofitableCoins: () => {
                this.avoidUnprofitableCoins = false;
                this.unprofitableCoinsAllowedCount = 0;
                this.unprofitableCoinsAllowedMax = 3;
            },
            checkCoinId: (coinId) => {
                let foundCoinId = this.unprofitableCoins.coinIdArray.filter(
                    (el) => {
                        /* NOTE: Type coercion to check for empty array (false-y) */
                        return el === coinId;
                    }
                );

                return !(foundCoinId == false);
            },
            updateUnprofitableCoins: () => {
                this.unprofitableCoinsAllowedCount++;

                if (
                    this.unprofitableCoinsAllowedCount >
                    this.unprofitableCoinsAllowedMax
                ) {
                    avoidUnprofitableCoins = true;
                }
            },
            canChooseUnprofitableCoin: () => {
                return avoidUnprofitableCoins;
            },
        };

        /* Init the Exchange object */
        this.exchange = new Exchange();
        this.exchange.setCurrent('kraken');

        this.init();
    }

    async init() {
        await this.getBotConfig();
        await this.getBotInfo();
        await this.setupExchange();
        await this.setupQueues();
        await this.setupUnprofitableCoins();
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
        /* We decrypt the config from DB. Much safer. */
        this.trade_api_config = JSON.parse(
            decryptAES(botName + this.primeCode, config.api_config)
        );
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
        let botInfoResults = new Promise(async (resolve, reject) => {
            API.setBotInfo(this.id, botInfo, function () {
                resolve();
            });
        });

        await botInfoResults.then(function (result) {
            botInfoResults = result;
        });
    }

    async setupExchange() {
        this.exchange.curr.initApi(
            this.trade_api_config['api_key'],
            this.trade_api_config['priv_api_key'],
            this.trade_api_config['2fa_pass']
        );
    }

    async setupQueues() {
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
            1000,
            true /* Just after the close */
            /*true,
            true,
            10000*/
        );

        /*this.mainQueuer.enqueueQueue(
            this.coinAdviceQueue,
            500,
            true,
            true,
            true,
            40000 /* Just after the close */
        /*);*/

        this.mainQueuer.enqueueQueue(this.tradeOrderQueue, 2000, true);

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
                console.log('Seeking coin...');
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
            if (this.state === eventConstants.ORDER_FINALISED) {
                this.getLockedAdvice();
                /* IMPORTANT: Monitor trades and cancel others if one condition has been reached */

                this.trackOrders();
            } else if (this.state === eventConstants.TRADE_LOCKED) {
                /* Here we perform the actual trade order (can't do bracketed via API */
                console.log('Status: Preparing trade!');
                this.state = eventConstants.PREPARING_TRADE;

                /* We format a kraken trade order */
                this.prepareOrder();

                this.state = eventConstants.ORDER_FINALISED;
            }
        }
    }

    trackOrders() {
        /* Check our current open orders */
        this.exchange.curr.queryOrders(
            this.exchangeCoinId,
            this.stopLossTXID,
            async (result) => {
                if (result[`${this.stopLossTXID}`]['status'] === 'closed') {
                    this.totalCurrentFloat +=
                        Number(result[`${this.stopLossTXID}`]['cost']) -
                        Number(result[`${this.stopLossTXID}`]['fee']);

                    this.totalLoss -=
                        Number(result1[`${this.stopLossTXID}`]['cost']) -
                        Number(result1[`${this.stopLossTXID}`]['fee']) -
                        this.orderPrice;

                    this.stopLossTXID = '';
                }

                this.exchange.curr.queryOrders(
                    this.exchangeCoinId,
                    this.takeProfitTXID,
                    async (result) => {
                        if (
                            result[`${this.takeProfitTXID}`]['status'] ===
                            'closed'
                        ) {
                            this.totalCurrentFloat +=
                                Number(
                                    result[`${this.takeProfitTXID}`]['cost']
                                ) -
                                Number(result[`${this.takeProfitTXID}`]['fee']);

                            this.totalLoss -=
                                Number(
                                    result1[`${this.takeProfitTXID}`]['cost']
                                ) -
                                Number(
                                    result1[`${this.takeProfitTXID}`]['fee']
                                ) -
                                this.orderPrice;

                            this.takeProfitTXID = '';
                        }

                        if (
                            this.takeProfitTXID === '' ||
                            this.stopLossTXID === ''
                        ) {
                            this.cancelOrders();
                            this.finaliseTrade();
                        }
                    }
                );
            }
        );

        /* Check the current ticker and work out percentage change in our locked coin, then compare with the price we bought at. If there's been a reasonable drop, sell immediately */

        /* TO-DO: Ticker - update this to take into account the simulated timestamp I've added */

        this.exchange.curr.ticker(this.exchangeCoinId, async (result) => {
            this.oldTrackTradeClosePrice = this.newTrackTradeClosePrice;
            this.newTrackTradeClosePrice = Number(result['c'][0]);
            this.oldTrackTradeClosePrice = this.orderPrice;

            /* If the price has dropped by 0.5% */
            if (
                (this.newTrackTradeClosePrice - this.oldTrackTradeClosePrice) /
                    this.newTrackTradeClosePrice <
                -0.005
            ) {
                this.sellEarly();
            }

            /* If the price has risen, we bring up the stop-loss */
            if (
                (this.newTrackTradeClosePrice - this.oldTrackTradeClosePrice) /
                    this.newTrackTradeClosePrice >
                0.025
            ) {
                this.exchange.curr.cancelOrder(
                    this.exchangeCoinId,
                    txid,
                    async (result) => {
                        this.stopLossTXID = '';

                        this.exchange.curr.addOrder(
                            {
                                pair: this.exchangeCoinId,
                                ordertype: 'stop-loss',
                                type: 'sell',
                                volume: this.orderVolume,
                                price: this.newTrackTradeClosePrice * 0.9965,
                            },
                            async (result) => {
                                this.stopLossTXID = result['txid'];
                            }
                        );
                    }
                );
                this.sellEarly();
            }
        });
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
            /* Here we will calculate the best option from
            the advice supplied, including probability. Hard coded for testing. */

            //console.log('ADVICE');
            //return;

            let suitableCoins = [];

            /* DEBUG - uncomment later */
            /*advice['coins'].forEach((coinAdvice) => {
                if (
                    coinAdvice['coin_advice'][0]['advice'] === 'definite_buy' ||
                    (coinAdvice['coin_advice'][0]['advice'] ===
                        'possible_buy' &&
                        Number(coinAdvice['coin_advice'][0]['probability']) >=
                            85))
                ) {
                    suitableCoins.push(coinAdvice);
                }
            });*/

            /* DEBUG: First coin for now (BTC) */
            let coinAdvice = advice['coins'][0];
            /* Reverse array */
            coinAdvice['coin_advice'] = coinAdvice['coin_advice'].reverse();
            //return;

            if (
                (coinAdvice['coin_advice'][0]['advice'] === 'definite_buy' &&
                    Number(coinAdvice['coin_advice'][0]['probability']) >=
                        110) ||
                (coinAdvice['coin_advice'][0]['advice'] === 'possible_buy' &&
                    Number(coinAdvice['coin_advice'][0]['probability']) >= 95)
            ) {
                suitableCoins.push(coinAdvice);
            }

            /* If there are no suitable coins, return early */
            if (suitableCoins.length === 0) {
                return;
            }

            /* Sort array by probability and advice type (DEFINITE_BUY being ahead of POSSIBLE_BUY) */

            /* Choose coin */
            let chosenCoin = false;
            let coinChoiceLimiter = 0;
            do {
                /* Choose a random coin */
                let chosenCoin =
                    suitableCoins[getRandomInt(suitableCoins.length - 1)];
                coinChoiceLimiter++;

                if (chosenCoin['coin_advice'].length === 1) break;

                /* If we have a trend, we should have started at the beginning of a trend */
                if (
                    chosenCoin['coin_advice'][0]['advice']['coinAdvice'] ===
                    chosenCoin['coin_advice'][1]['advice']['coinAdvice']
                ) {
                    chosenCoin = false;
                    continue;
                }

                /* If this coin is an unprofitable coin *and* we can choose one, or if it's a profitable coin */
                if (
                    (this.unprofitableCoins.checkCoinId(
                        chosenCoin['coin_id']
                    ) &&
                        this.unprofitableCoins.canChooseUnprofitableCoin) ||
                    !this.unprofitableCoins.checkCoinId(chosenCoin['coin_id'])
                ) {
                    this.lockedCoinId = chosenCoin['coin_id'];
                    this.exchangeCoinId = chosenCoin['coin_exchange_id'];
                    this.advice = chosenCoin['coin_advice'];
                } else {
                    chosenCoin = false;
                }
            } while (chosenCoin === false && coinChoiceLimiter < 20);

            /* Once we get this advice, we need to determine whether to buy or sell and then move to locked advice */
            console.log('Status: Shaking hands and getting advice!');
            console.log(chosenCoin);

            if (chosenCoin !== false) {
                this.state = eventConstants.SHAKING_HANDS;
            }
        });
    }

    getLockedAdvice() {
        API.getLockedAdvice(this.id, this.lockToken, (advice) => {
            this.advice = advice['coin_advice'];
            /* Here we will calculate the best option from the advice supplied, including probability. Hard coded for testing. */

            /* Note: We don't need to check the advice at this point - we just need to check the close price and the max amount of time. We may check for CRASHING later if this doesn't work. */

            /* Here we check the locked advice to see if we sell or not from this advice */
            if (this.checkAdvice()) {
                this.finaliseTrade();
            } else {
                let currSeconds = (Date.now() / 1000.0) % 60;

                if (currSeconds < 2) {
                    /* NOTE: We need to do this for the current low and high when the minute turns over.*/
                    this.raiseStopLossTakeProfit();
                }
            }

            console.log('Status: Getting locked trading advice!');
        });
    }

    raiseStopLossTakeProfit() {
        /* TODO: Here we check and raise stop-loss and take-profit from current close. */
        this.exchange.curr.cancelAllOrders(() => {
            this.exchange.curr.addOrder(
                {
                    pair: this.exchangeCoinId,
                    ordertype: 'take-profit',
                    type: 'sell',
                    volume: this.orderVolume,
                    price: topLimitPrice,
                },
                async (result) => {
                    this.takeProfitTXID = result['txid'];

                    /* Take stop loss for bottom limit price */
                    this.exchange.curr.addOrder(
                        {
                            pair: this.exchangeCoinId,
                            ordertype: 'stop-loss',
                            type: 'sell',
                            volume: this.orderVolume,
                            price: bottomLimitPrice,
                        },
                        async (result) => {
                            this.stopLossTXID = result['txid'];
                        }
                    );
                }
            );
        });
    }

    prepareOrder() {
        /* We grab the current ticker price */

        /* TO-DO: Ticker - update this to take into account the simulated timestamp I've added */
        this.exchange.curr.ticker(this.exchangeCoinId, async (result) => {
            //console.log(result);
            /* Bid price is highest price asked atm */
            let currentBidPrice = Number(result['b']);
            let currentAskPrice = Number(result['a']);
            let currentClosePrice = Number(result['c']);
            let topLimitPrice = currentBidPrice * 1.003; // 0.3%
            let bottomLimitPrice = currentAskPrice * 0.9975; // 0.25%

            this.takeProfitPrice = topLimitPrice;
            this.stopLossPrice = bottomLimitPrice;
            this.orderPrice = currentClosePrice;
            this.newTrackTradeClosePrice = this.orderPrice;

            /* Let's calculate the volume based on our float and current price */
            this.orderVolume = currentClosePrice / this.wageredFloat;

            console.log(
                `Prepare order: ${currentBidPrice} ${currentAskPrice} ${topLimitPrice} ${bottomLimitPrice}`
            );

            /* Initial purchase of coin */
            this.exchange.curr.addOrder(
                {
                    pair: this.exchangeCoinId,
                    ordertype: 'market',
                    type: 'buy',
                    volume: this.orderVolume,
                },
                async (result) => {
                    /* Take profit order (immediate sell at market price once we hit limit) for top limit price (actual limit trade may not be filled - we may do this later if not making enough, with monitoring) */
                    this.exchange.curr.addOrder(
                        {
                            pair: this.exchangeCoinId,
                            ordertype: 'take-profit',
                            type: 'sell',
                            volume: this.orderVolume,
                            price: topLimitPrice,
                        },
                        async (result) => {
                            this.takeProfitTXID = result['txid'];

                            /* Take stop loss for bottom limit price */
                            this.exchange.curr.addOrder(
                                {
                                    pair: this.exchangeCoinId,
                                    ordertype: 'stop-loss',
                                    type: 'sell',
                                    volume: this.orderVolume,
                                    price: bottomLimitPrice,
                                },
                                async (result) => {
                                    this.stopLossTXID = result['txid'];
                                }
                            );
                        }
                    );
                }
            );
            this.initialTradeTimestamp = Date.now();
            return true;
        });
    }

    checkAdvice() {
        /* Here we calculate whether we hold onto this coin based on the advice.
        NOTE: We also have to build in a timelimit, so we let a coin go after 5-10 mins*/

        if (this.initialTradeTimestamp === null) {
            return false;
        }

        let currentTimestamp = Date.now();
        let urgencyFactor = calculateSellUrgencyFactor(
            this.initialTradeClosePrice,
            this.currentClosePrice,
            this.initialTradeTimestamp,
            currentTimestamp,
            this.maxTradeTime / 1000.0,
            this.profitableUptrend
        );

        let urgencyCheck1 = 0.7 + Math.random();
        let urgencyCheck2 = 0.7 + Math.random();
        // let urgencyCheck3 = 0.7 + Math.random();

        if (
            urgencyCheck1 > urgencyFactor ||
            urgencyCheck2 > urgencyFactor /*||
            urgencyCheck3 > urgencyFactor*/
        ) {
            return true;
        } else {
            this.sellEarly();
            return false;
        }
    }

    sellEarly() {
        this.exchange.curr.addOrder(
            {
                pair: this.exchangeCoinId,
                ordertype: 'market',
                type: 'sell',
                volume: this.orderVolume,
            },
            async (result) => {
                /* We cancel the other orders */
                this.cancelOrders();
            }
        );
    }

    cancelOrders() {
        if (this.takeProfitTXID !== '') {
            this.exchange.curr.cancelOrder(
                this.exchangeCoinId,
                this.takeProfitTXID,
                async (result) => {}
            );
        } else if (this.stopLossTXID !== '') {
            this.exchange.curr.cancelOrder(
                this.exchangeCoinId,
                this.stopLossTXID,
                async (result) => {}
            );
        }
    }

    finaliseTrade() {
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
        this.orderVolume = 0;

        /* Update the amount of unprofitable coins we can choose */
        if (unprofitableCoins.checkCoinId(this.lockedCoinId)) {
            unprofitableCoins.updateUnprofitableCoins();
        }

        if (!this.hasLowProfitability()) {
            this.state = eventConstants.SEEKING_COIN;
        }

        /* DEBUG */
        /* We just shudown after we simulate a trade */
        this.shutdown();
    }

    hasLowProfitability() {
        /* If we lose money too many times and the loss is too great (33%), immediately shutdown */
        if (
            this.lossCount >= 3 &&
            this.totalLoss >= this.totalCurrentFloat / 3.0
        ) {
            this.shutdown();
            return true;
        } else {
            return false;
        }
    }

    setupUnprofitableCoins() {
        /* Reset the unproftiable coins ever hour */
        setInterval(this.resetUnprofitableCoins, 1000 * 60 * 60);
    }

    resetUnprofitableCoins() {
        this.unprofitableCoins.resetUnprofitableCoins();
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
