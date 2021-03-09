/* So for each coin, we need to populate a data structure with the following info.

// Update these every 30 mins.
Price Last 24-hr High
Price Last 24-hr Low

Price Now
Price List of the past 20 intervals of time - this is basically a FILO queue.
Price 10 mins ago
Price 30 mins ago
Price 1 Hr ago

We also need to work out percentages - how far we've risen or fall in the past 5 mins, past 10 mins, past 30 mins, past hour, past 3 hours

// Eventually, we'll do current buy or sell volume.

How do we get 10 mins and 1 hour ago?
*/

/* Ticker is up to the second. I need this. */

//api.kraken.com/0/public/Ticker
/* The OHLC goes back 12 hours.  I can grab that once an hour to process. */
/* Will need these calls time-stamped so we can do a comparison between now and then */

/* If we're going to return general advice */

const Queuer = require("../utils/queuer.js").Queuer;
const Queue = require("../utils/queue.js");
const API = require("../utils/api.js");
const { sleep } = require("../utils/general.js");
const NETWORK = require("../legacy/config/network-config.js");

class MainLogic {
    // Need to "lock" bot when new info comes in.

    constructor(mysqlCon) {
        this.mysqlCon = mysqlCon;

        // For the MACD (EMA-9, EMA-12, EMA-26)
        this.ohlcStoreNum = 26;

        //this.state = eventConstants.SEEKING_COIN;
        this.queueSetupComplete = false;
        this.getCoinConfig();
        this.setupQueues();

        /* Initialise Kraken API */
        this.kraken = require("kraken-api-wrapper")(
            NETWORK.config.apiKey,
            NETWORK.config.privateApiKey
        );
        this.kraken.setOtp(NETWORK.config.twoFactor);
    }

    async getCoinConfig() {}

    setupQueues() {
        /* Setup the main queuers and queues */
        this.coinDataAcquisitionQueuer = new Queuer();
        this.coinAdviceGenerationQueuer = new Queuer();

        /* Do we need separate queues - one to handle calls to grab required api and populate mysql with data, and another to process the info? Yes! */
        this.OHLCAcquisitionQueue = new Queue();
        this.setupCoinDataAcquisitionQueue();

        /* These are the queues to generate coin advice for each coin*/
        /*this.coinAdviceGenerationQueue = new Queue();
        this.setupCoinAdviceGenerationQueue();*/

        let numberOfCoins = 2; /* For testing purposes */
        let OHLCFrequency = 60000 / numberOfCoins;
        this.coinDataAcquisitionQueuer.enqueueQueue(
            this.OHLCAcquisitionQueue,
            OHLCFrequency /* We only acquire this info once a minute */,
            true,
            true
        );

        this.queueSetupComplete = true;
    }

    processQueues() {
        /* Here we process both incoming coin bot advice (locked or not) and monitor bots current trades */

        if (this.queueSetupComplete === true) {
            this.coinDataAcquisitionQueuer.processQueues();
            this.coinAdviceGenerationQueuer.processQueues();
        }
    }

    setupCoinDataAcquisitionQueue() {
        /* 1st. The spread (asks and bids) - generally want low spread as easiest wins */
        /* 2nd. Order book (Price By Volume to work out support and resistance levels) - LATER! - FOCUS ON BOLLINGER BANDS FOR NOW. */
        /* 3rd. Ticker for current pricings */
        /* 4th. Bollinger bands:

        /*
        1. RSI
        2. Stoachastic
        3. The spread
        4. Bollinger bands or 2 EMAs
        */
        /* Need a way to schedule the queue after a certain number of seconds */
        this.setupOHLCAcquisitionQueue();
    }

    setupOHLCAcquisitionQueue() {
        /* We need to get all the coins we're going to focus on here from mysql - for now we'll just use BTCUSD for testing. */

        let coinArr = [
            { name: "XXBTZUSD", id: 1 },
            { name: "XETHZUSD", id: 2 },
        ];

        coinArr.forEach((coin) => {
            this.OHLCAcquisitionQueue.enqueue(async () => {
                this.getOHLC(coin["id"], coin["name"], this.ohlcStoreNum);
            });
        });
    }

    getOHLC(coinId, coinPair, storeNum) {
        this.kraken
            .OHLC({ pair: coinPair, interval: 1 })
            .then((result) => {
                /* Add this to mysql */
                /* We remove all the old OHLC data from mysql and then insert the new data. */

                let ohlcDesc = result[coinPair].reverse();
                //console.log(require("util").inspect(ohlcDesc, true, 10));
                //console.log(result["last"]);

                let limiterIndex = 0;
                for (const ohlcEl of ohlcDesc) {
                    this.mysqlCon.storeCoinOHLC(coinId, ohlcEl, () => {});

                    if (limiterIndex >= storeNum) break;
                    limiterIndex++;
                }
                this.mysqlCon.countCoinOHLC((result) => {
                    let numOfRows = result["count"];
                    console.log(numOfRows);
                    this.mysqlCon.cleanupCoinOHLC(
                        storeNum,
                        numOfRows,
                        () => {}
                    );
                });
            })
            .catch((err) => console.error(err));
    }
}

module.exports = {
    MainLogic,
};
