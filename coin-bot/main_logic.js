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
const ProcessLocks = require("../utils/process-locks.js");
const RSIProcesser = require("../trends-and-signals/RSI-calculations.js");
const API = require("../utils/api.js");
const { rotateArray } = require("../utils/general.js");
const NETWORK = require("../legacy/config/network-config.js");

class MainLogic {
    // Need to "lock" bot when new info comes in.

    constructor(mysqlCon) {
        this.queueSetupComplete = false;
        this.mysqlCon = mysqlCon;

        // For the MACD (EMA-9, EMA-12, EMA-26)
        this.ohlcStoreNum = 26; // 26 time periods
        this.RSIStoreNum = 15; // 14 for calculations plus the latest
        this.StochasticStoreNum = 14; // 14 time periods
        this.processLocks = new ProcessLocks(["OHLC", "RSI"]);
        //this.state = eventConstants.SEEKING_COIN;

        this.RSIProcesser = new RSIProcesser(this.mysqlCon, this.RSIStoreNum);

        this.getCoinConfig();
        this.setupQueues();
        this.setupKraken();
    }

    async getCoinConfig() {}

    setupKraken() {
        /* Initialise Kraken API */
        this.kraken = require("kraken-api-wrapper")(
            NETWORK.config.apiKey,
            NETWORK.config.privateApiKey
        );
        this.kraken.setOtp(NETWORK.config.twoFactor);
    }

    setupQueues() {
        /* Setup the main queuers and queues */
        this.coinDataAcquisitionQueuer = new Queuer();
        this.coinTrendsAndSignalsProcessingQueuer = new Queuer();
        this.coinAdviceGenerationQueuer = new Queuer();

        /* Do we need separate queues - one to handle calls to grab required api and populate mysql with data, and another to process the info? Yes! */
        this.OHLCAcquisitionQueue = new Queue();
        this.setupCoinDataAcquisitionQueue();

        /* These are the queues to generate coin advice for each coin*/
        /*this.coinAdviceGenerationQueue = new Queue();
        this.setupCoinAdviceGenerationQueue();*/

        let numberOfCoins = 7; /* For testing purposes */
        let OHLCFrequency = 60000 / numberOfCoins;
        this.coinDataAcquisitionQueuer.enqueueQueue(
            this.OHLCAcquisitionQueue,
            OHLCFrequency /* We only acquire this info once a minute */,
            true,
            true
        );

        this.RSIProcessingQueue = new Queue();
        this.setupTrendsAndSignalsProcessingQueue();

        /* We up this for each trend/signal we calculate, and for each coin */
        let trendsAndSignalsNumber = 1;
        let trendsAndSignalsFrequency =
            60000 / (trendsAndSignalsNumber * numberOfCoins);
        this.coinTrendsAndSignalsProcessingQueuer.enqueueQueue(
            this.RSIProcessingQueue,
            trendsAndSignalsFrequency /* We only acquire this info once a minute */,
            true,
            true
        );

        this.queueSetupComplete = true;
    }

    processQueues() {
        /* Here we process both incoming coin bot advice (locked or not) and monitor bots current trades */

        if (this.queueSetupComplete === true) {
            this.coinDataAcquisitionQueuer.processQueues();
            this.coinTrendsAndSignalsProcessingQueuer.processQueues();
            this.coinAdviceGenerationQueuer.processQueues();
        }
    }

    setupCoinDataAcquisitionQueue() {
        this.setupOHLCAcquisitionQueue();
    }

    setupTrendsAndSignalsProcessingQueue() {
        this.setupRSIProcessingQueue();
    }

    setupOHLCAcquisitionQueue() {
        /* We need to get all the coins we're going to focus on here from mysql - for now we'll just use BTCUSD for testing. */

        this.mysqlCon.getCoinList((coinArr) => {
            coinArr.forEach((coin) => {
                this.OHLCAcquisitionQueue.enqueue(async () => {
                    this.processLocks.lock("OHLC", coin["id"]);
                    this.getOHLC(
                        coin["id"],
                        coin["coin_id_kraken"],
                        this.ohlcStoreNum
                    );
                });
            });
        });
    }

    getOHLC(coinId, coinPair, storeNum) {
        /* DEBUG FOR RSI: REMOVE THIS LATER */
        if (coinId != 1) return;

        console.log(`Processing OHLC: ${coinPair}`);
        this.kraken
            .OHLC({ pair: coinPair, interval: 1 })
            .then((result) => {
                /* This gets the result array in the proper order */
                let ohlcDesc = result[coinPair].reverse();

                let limiterIndex = 0;
                for (const ohlcEl of ohlcDesc) {
                    this.mysqlCon.storeCoinOHLC(coinId, ohlcEl, () => {});

                    if (limiterIndex >= storeNum) break;
                    limiterIndex++;
                }
                this.mysqlCon.cleanupCoinOHLC(coinId, storeNum, () => {
                    /* Unlock ohlc here so we can do calculations on this element - do we need this per coin? */
                    this.processLocks.unlock("OHLC");
                });
            })
            .catch((err) => console.error(err));
    }

    setupRSIProcessingQueue() {
        /* We do processing in the same way we did previously, an RSI for each coin. */

        this.mysqlCon.getCoinList((coinArr) => {
            /* Here we rotate the array so we can more easily perform the processing of coins outside of the time periods they're locked. We aim to process at the farthest point away from our async API calls etc. in the hopes that ~half a minute is enough for all operations to complete.*/
            //rotateArray(coinArr, parseInt(coinArr.length / 2, 10));
            rotateArray(coinArr, 2);

            coinArr.forEach((coin) => {
                this.RSIProcessingQueue.enqueue(async () => {
                    this.processLocks.lock("RSI", coin["id"]);
                    console.log(`Processing RSI: ${coin["coin_id_kraken"]}`);
                    this.RSIProcesser.calculate(coin["id"]);
                    this.processLocks.unlock("RSI");
                });
            });
        });
    }
}

module.exports = {
    MainLogic,
};
