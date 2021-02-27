const Queuer = require("../utils/queuer.js").Queuer;
const Queue = require("../utils/queue.js");
class MainLogic {
    // Need to "lock" bot when new info comes in.

    constructor(initial_config) {
        this.id = initial_config.id;
        this.trade_api_config = initial_config.api_config;
        this.exchange_fees = initial_config.fees;

        /* Setup the main queues */
        this.mainQueuer = new Queuer();
        /* This is the queue to check coin bot, whether locked or not */
        this.coinAdviceQueue = new Queue();
        this.setupCoinAdviceQueue();

        /* This is the queue to check for the bots current trades, whether they've completed etc. */
        this.tradeOrderQueue = new Queue();
        this.setupTradeOrderQueue();

        this.mainQueuer.enqueueQueue(this.coinAdviceQueue, 500);
        this.mainQueuer.enqueueQueue(this.tradeOrderQueue, 500);
    }

    processQueues() {
        /* Here we process both incoming coin bot advice (locked or not) and monitor bots current trades */
        this.mainQueuer.processQueues();
    }

    /* Here we add the code that checks the coin bot and locks the bot in if the coin bot advice is good and probability high */
    setupCoinAdviceQueue() {}

    setupTradeOrderQueue() {}
}

module.exports = {
    MainLogic,
};
