const Queuer = require("../utils/queuer.js").Queuer;
const Queue = require("../utils/queue.js");
const networkCalls = require("../utils/network-calls.js");
const eventConstants = require("./constants.js").BOT_EVENT;
class MainLogic {
    // Need to "lock" bot when new info comes in.

    constructor() {
        this.lockToken = null;
        this.lockCoinId = 0;
        this.state = eventConstants.SEEKING_COIN;
        this.getBotConfig();
        this.setupQueues();
    }

    async getBotConfig() {
        /* We need the bot config information to communicate with the exchange so it can do trades*, the bot ID, and max fees for the exchange */
        let config = new Promise(async (resolve, reject) => {
            networkCalls
                .apiGet("http://localhost:1408/api/assign_bot")
                .then((res) => {
                    console.log(res);
                    resolve(res);
                });
        });

        await config.then(function (result) {
            config = result;
        });

        /* When we contact the coin bot, this is our main 'key' */
        this.id = config.id;
        this.trade_api_config = config.api_config;
        this.exchange_fees = config.fees;
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
    }

    processQueues() {
        /* Here we process both incoming coin bot advice (locked or not) and monitor bots current trades */
        this.mainQueuer.processQueues();
    }

    /* Here we add the code that checks the coin bot and locks the bot in if the coin bot advice is good and probability high */
    setupCoinAdviceQueue() {
        this.coinAdviceQueue.enqueue(async () => {
            mainCoinAdviceLogic();
        });
    }

    mainCoinAdviceLogic() {
        if (
            this.lockToken === null &&
            this.state === eventConstants.SEEKING_COIN
        ) {
            /* We start calling in the advice every half second */
            this.coinAdviceQueue.enqueue(async () => {
                networkCalls
                    .apiGet(`http://localhost:1408/api/advice`)
                    .then((res) => {
                        console.log(res);
                        /* Here we will calculate the best option from
                        the advice supplied, including probability */
                        this.lockCoinId = 1;
                        this.state === eventConstants.SHAKING_HANDS;
                    });
            });
        } else if (
            this.lockCoinId != 0 &&
            this.lockToken === null &&
            this.state === eventConstants.SHAKING_HANDS
        ) {
            this.coinAdviceQueue.enqueue(async () => {
                networkCalls
                    .apiPost(`http://localhost:1408/api/lock_bot`, {
                        botId: this.id,
                        coinId: this.lockCoinId,
                    })
                    .then((res) => {
                        console.log(res);
                        this.lockToken = res.token;
                    });
            });
        }
    }

    setupTradeOrderQueue() {}

    cleanup(cb) {
        if (this.id) {
            networkCalls
                .apiPost(`http://localhost:1408/api/unassign_bot`, {
                    botId: this.id,
                })
                .then((res) => {
                    cb(true);
                    console.log(res);
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
