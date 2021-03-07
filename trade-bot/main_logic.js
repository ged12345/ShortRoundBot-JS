const Queuer = require("../utils/queuer.js").Queuer;
const Queue = require("../utils/queue.js");
const API = require("../utils/api.js");
const eventConstants = require("./constants.js").BOT_EVENT;
class MainLogic {
    // Need to "lock" bot when new info comes in.

    constructor() {
        this.lockToken = null;
        this.lockCoinId = 0;
        this.state = eventConstants.SEEKING_COIN;
        this.queueSetupComplete = false;
        this.getBotConfig();
        this.setupQueues();
    }

    async getBotConfig() {
        /* We need the bot config information to communicate with the exchange so it can do trades*, the bot ID, and max fees for the exchange */
        let config = new Promise(async (resolve, reject) => {
            API.assignBot(function (config) {
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
                /* Here we perform the actual trade order: bracketed or otherwise */
                console.log("Preparing trade!");
                /* We format a kraken trade order */
            }
        }
    }

    lockBot() {
        API.lockBot(this.id, this.lockCoinId, (lockToken) => {
            this.lockToken = lockToken;
            this.state = eventConstants.TRADE_LOCKED;
        });
    }

    unlockBot() {
        API.releaseBot(this.id, this.lockCoinId, (lockToken) => {
            this.lockToken = null;
            this.state = eventConstants.SEEKING_COIN;
        });
    }

    getAdvice() {
        API.getAdvice((advice) => {
            this.advice = advice;
            /* Here we will calculate the best option from
            the advice supplied, including probability. Hard coded for testing. */
            this.state = eventConstants.SHAKING_HANDS;
            this.lockCoinId = 1;
        });
    }

    getLockedAdvice() {
        API.getLockedAdvice(this.id, this.lockToken, (advice) => {
            this.advice = advice;
            /* Here we will calculate the best option from
            the advice supplied, including probability. Hard coded for testing. */
            this.state = eventConstants.PREPARING_TRADE;
            this.lockCoinId = 1;
        });
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
