const Queuer = require("../utils/queuer.js").Queuer;
const Queue = require("../utils/queue.js");
const API = require("../utils/api.js");
const { encryptCodeIn, encrypt512 } = require("../utils/general.js");
const eventConstants = require("./constants.js").BOT_EVENT;
const code = require("./constants.js").BOT_CODE["primer"];
const botNames = require("./constants.js").BOT_NAMES;
const { calculateSellUrgencyFactor } = require("../utils/math.js");
class MainLogic {
    // Need to "lock" bot when new info comes in.

    constructor() {
        this.primeCode = encryptCodeIn(code);
        this.lockToken = null;
        this.lockCoinId = 0;
        this.state = eventConstants.SEEKING_COIN;
        this.queueSetupComplete = false;

        /* 1 dollar when testing */
        this.currentFloat = 1.0;

        /* We keep track of how much we've gained or lost here */
        this.totalInitialFloat = this.currentFloat;
        this.totalCurrentFloat = this.currentFloat;
        this.initialTradeTimestamp = null;
        this.initialTradeClosePrice = 0.0;
        /* This factor increased per minute */
        this.minCoinAppreciationPercentPerMin = 0.05;

        /* If our loss count variable >= 3, or the total loss is more than 33% of the float, stop the bot. */
        this.lossCount = 0;
        this.totalLoss = 0.0;

        /* The maximum amount of time we hold onto a trade. If the close price hasn't risen appreciably in this time, best to sell */
        this.maxTradeTime = 60000 * 10;

        this.getBotConfig();
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

    setupQueues() {
        /* Setup the main queues */
        this.mainQueuer = new Queuer();

        /* This is the queue to check coin bot, whether locked or not */
        this.coinAdviceQueue = new Queue();
        this.setupCoinAdviceQueue();

        /* This is the queue to check for the bots current trades, whether they've completed etc. */
        this.tradeOrderQueue = new Queue();
        this.setupTradeOrderQueue();

        this.mainQueuer.enqueueQueue(this.coinAdviceQueue, 500, true);
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
                this.lockCoinId !== 0 &&
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
        /* At this point, we have our play from the advice. Where do we record the play? Don't we check the coin for specific advice? We haven't implemented this yet.

        Locked advice will be more specific: If the coin is currently falling sharply, lots of sell orders (asks) and volume compared to bids in Order Book, the coin bot may put out a SELL_IMMEDIATELY request, if somehow we've missed the boat. */
        if (this.lockToken !== null) {
            if (this.state === eventConstants.TRADE_LOCKED) {
                this.getLockedAdvice();
            } else if (this.state === eventConstants.PREPARING_TRADE) {
                /* Here we perform the actual trade order (can't do bracketed via API */
                console.log("Status: Preparing trade!");
                this.initialTradeClosePrice = this.advice["initialClose"];
                /* We format a kraken trade order */
                prepareOrder(0, 0, 0);
                /* After we prepare the trade order, we go back to being locked */
                this.state = eventConstants.PREPARING_TRADE;
            }
        }
    }

    lockBot() {
        API.lockBot(this.id, this.lockCoinId, (lockToken) => {
            this.lockToken = lockToken;
            this.state = eventConstants.TRADE_LOCKED;
            console.log("Status: Locked bot to a trade!");
        });
    }

    unlockBot() {
        API.releaseBot(this.id, this.lockCoinId, (lockToken) => {
            this.lockToken = null;
            this.state = eventConstants.SEEKING_COIN;
            console.log("Status: Unlocked bot and seeking coin!");
        });
    }

    getAdvice() {
        API.getAdvice(this.primeCode, this.name, (advice) => {
            this.advice = advice;
            /* Here we will calculate the best option from
            the advice supplied, including probability. Hard coded for testing. */
            /* DEBUG: UNCOMMENT THIS AFTER DEBUGGING */
            //this.state = eventConstants.SHAKING_HANDS;
            //this.lockCoinId = 1;

            /* Once we get this advice, we need to determine whether to buy or sell and then move to locked advice */

            console.log("Status: Shaking hands and getting advice!");
            console.log(this.advice);
        });
    }

    getLockedAdvice() {
        API.getLockedAdvice(this.id, this.lockToken, (advice) => {
            this.advice = advice;
            /* Here we will calculate the best option from
            the advice supplied, including probability. Hard coded for testing. */
            if (this.state !== eventConstants.TRADE_LOCKED) {
                this.state = eventConstants.PREPARING_TRADE;
                /* DEBUG: We focus on Bitcoin for now */
                this.lockCoinId = 1;
            }

            /* Here we check the locked advice to see if we sell or not from this advice */
            if (this.checkAdvice()) {
                this.finaliseTrade();
            }

            console.log("Status: Getting locked trading advice!");
        });
    }

    prepareOrder(buyAtPrice, stopLossPrice, sellAtPrice) {
        console.log(
            `Prepare order: ${buyAtPrice} ${stopLossPrice} ${sellAtPrice}`
        );

        this.initialTradeTimestamp = Date.now();
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

        return true;
    }

    finaliseTrade() {
        /* Wipe out current trade timestamp at end of trade */
        this.currentTradeTimestamp = null;

        if (!this.hasLowProfitability()) {
            /* DEBUG: Here we go back to SEEKING_COIN  - Uncomment this out */
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
            console.log("Warning: Too many ids assigned.");
            cb(true);
        }
    }
}

module.exports = {
    MainLogic,
};
