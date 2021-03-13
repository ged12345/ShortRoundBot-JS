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
const RSIProcessor = require("../trends-and-signals/RSI-calculations.js");
const StochasticProcessor = require("../trends-and-signals/Stochastic-calculations.js");
const BollingerProcessor = require("../trends-and-signals/BollingerBands-calculations.js");
const API = require("../utils/api.js");
const { rotateArray } = require("../utils/general.js");
const NETWORK = require("../legacy/config/network-config.js");
const Plotly = require("../utils/plotly.js").Plotly;

const fs = require("fs");
const write = require("write");

class MainLogic {
    // Need to "lock" bot when new info comes in.

    constructor(mysqlCon) {
        this.queueSetupComplete = false;
        this.mysqlCon = mysqlCon;

        this.coinConfigArr = Array();

        // For the MACD (EMA-9, EMA-12, EMA-26)
        this.graphPeriod = 32;
        this.OHLCStoreNum = 26; // 26 time periods
        this.RSIStoreNum = 15; // 14 for calculations plus the latest
        this.StochasticStoreNum = 14; // 14 time periods
        this.BollingerStoreNum = 21; // 21 time periods
        this.processLocks = new ProcessLocks([
            "OHLC",
            "RSI",
            "Stochastic",
            "Bollinger",
        ]);
        //this.state = eventConstants.SEEKING_COIN;

        this.RSIProcessor = new RSIProcessor(
            this.mysqlCon,
            this.RSIStoreNum,
            this.graphPeriod,
            this.processLocks.unlock
        );
        this.StochasticProcessor = new StochasticProcessor(
            this.mysqlCon,
            this.StochasticStoreNum,
            this.graphPeriod,
            this.processLocks.unlock
        );
        this.BollingerProcessor = new BollingerProcessor(
            this.mysqlCon,
            this.BollingerStoreNum,
            this.graphPeriod,
            this.processLocks.unlock
        );

        this.init();
    }

    async init() {
        await this.cleanOldData();
        await this.getCoinConfig();
        await this.setupKraken();
        await this.setupQueues();
    }

    async getCoinConfig() {
        this.coinConfigArr = await this.mysqlCon.getCoinList();
    }

    async cleanOldData() {
        await this.mysqlCon.emptyCoinOHLC();
        await this.mysqlCon.emptyProcessRSI();
        await this.mysqlCon.emptyProcessStochastic();
        await this.mysqlCon.emptyProcessBollinger();
    }

    async setupKraken() {
        /* Initialise Kraken API */
        this.kraken = require("kraken-api-wrapper")(
            NETWORK.config.apiKey,
            NETWORK.config.privateApiKey
        );
        this.kraken.setOtp(NETWORK.config.twoFactor);
    }

    async setupQueues() {
        /* Setup the main queuers and queues */
        this.coinDataAcquisitionQueuer = new Queuer();
        this.coinTrendsAndSignalsProcessingQueuer = new Queuer();
        this.coinAdviceGenerationQueuer = new Queuer();
        this.coinTrendsAndSignalsGraphingQueuer = new Queuer();

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
        this.StochasticProcessingQueue = new Queue();
        this.BollingerProcessingQueue = new Queue();
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

        this.coinTrendsAndSignalsProcessingQueuer.enqueueQueue(
            this.StochasticProcessingQueue,
            trendsAndSignalsFrequency /* We only acquire this info once a minute */,
            true,
            true
        );

        this.coinTrendsAndSignalsProcessingQueuer.enqueueQueue(
            this.BollingerProcessingQueue,
            trendsAndSignalsFrequency /* We only acquire this info once a minute */,
            true,
            true
        );

        /* Plotting graphs to compare calculations with online */
        this.PlotlyGraphingQueue = new Queue();
        this.setupTrendsAndSignalsGraphingQueue();

        this.coinTrendsAndSignalsGraphingQueuer.enqueueQueue(
            this.PlotlyGraphingQueue,
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
            this.coinTrendsAndSignalsGraphingQueuer.processQueues();
        }
    }

    setupCoinDataAcquisitionQueue() {
        this.setupOHLCAcquisitionQueue();
    }

    setupTrendsAndSignalsProcessingQueue() {
        /* Here we rotate the array so we can more easily perform the processing of coins outside of the time periods they're locked. We aim to process at the farthest point away from our async API calls etc. in the hopes that ~half a minute is enough for all operations to complete.*/
        rotateArray(this.coinConfigArr, 1);

        this.setupRSIProcessingQueue();
        this.setupStochasticProcessingQueue();
        this.setupBollingerProcessingQueue();
    }

    setupTrendsAndSignalsGraphingQueue() {
        rotateArray(this.coinConfigArr, 1);
        this.setupPlotlyGraphingQueue();
    }

    async setupOHLCAcquisitionQueue() {
        /* We need to get all the coins we're going to focus on here from mysql - for now we'll just use BTCUSD for testing. */

        this.coinConfigArr.forEach((coin) => {
            this.OHLCAcquisitionQueue.enqueue(async () => {
                this.processLocks.lock("OHLC", coin["id"]);
                this.getOHLC(
                    coin["id"],
                    coin["coin_id_kraken"],
                    this.graphPeriod
                );
            });
        });
    }

    async getOHLC(coinId, coinPair, storeNum) {
        /* DEBUG FOR RSI: REMOVE THIS LATER */
        if (coinId != 1) return;

        console.log(`Acquiring OHLC: ${coinPair}`);
        this.kraken
            .OHLC({ pair: coinPair, interval: 1 })
            .then(async (result) => {
                /* This gets the result array in the proper order */
                let ohlcDesc = result[coinPair].reverse();

                let limiterIndex = 0;
                for (const ohlcEl of ohlcDesc) {
                    await this.mysqlCon.storeCoinOHLC(coinId, ohlcEl);

                    if (limiterIndex >= storeNum) break;
                    limiterIndex++;
                }
                await this.mysqlCon.cleanupCoinOHLC(coinId, storeNum);
                /* Unlock ohlc here so we can do calculations on this element - do we need this per coin? */
                this.processLocks.unlock("OHLC");
            })
            .catch((err) => console.error(err));
    }

    async setupRSIProcessingQueue() {
        /* We do processing in the same way we did previously, an RSI for each coin. */

        this.coinConfigArr.forEach((coin) => {
            let trend = "RSI";
            this.RSIProcessingQueue.enqueue(async () => {
                console.log(`Processing ${trend}: ${coin["coin_id_kraken"]}`);

                this.processTrendWithLock(this.RSIProcessor, trend, coin["id"]);
            });
        });
    }

    async setupStochasticProcessingQueue() {
        /* We do processing in the same way we did previously, a Stochastic for each coin. */

        this.coinConfigArr.forEach((coin) => {
            let trend = "Stochastic";
            this.StochasticProcessingQueue.enqueue(async () => {
                console.log(`Processing ${trend}: ${coin["coin_id_kraken"]}`);

                this.processTrendWithLock(
                    this.StochasticProcessor,
                    trend,
                    coin["id"]
                );
            });
        });
    }

    async setupBollingerProcessingQueue() {
        /* We do processing in the same way we did previously, a BollingerBand for each coin. */

        this.coinConfigArr.forEach((coin) => {
            let trend = "Bollinger";
            this.BollingerProcessingQueue.enqueue(async () => {
                console.log(`Processing ${trend}: ${coin["coin_id_kraken"]}`);

                this.processTrendWithLock(
                    this.BollingerProcessor,
                    trend,
                    coin["id"]
                );
            });
        });
    }

    /* Generic processor lock and then wait for function to finish to unlock */
    async processTrendWithLock(processor, trend, coinId) {
        this.processLocks.lock(trend, coinId);
        processor.calculate(coinId);
        let unlocked = this.processLocks.awaitLock(trend, coinId);

        if (unlocked === false) {
            console.log(
                `Error: ${trend} lock for ${coinId} is not for the current coin!`
            );
        }
    }

    setupPlotlyGraphingQueue() {
        this.coinConfigArr.forEach((coin) => {
            let trend = "Plotly";
            this.PlotlyGraphingQueue.enqueue(async () => {
                let coinId = coin["id"];
                let coinName = coin["coin_name"];

                /* We only draw this for Bitcoin for now */
                if (coinId === 1) {
                    console.log(`Plotting ${trend}: ${coin["coin_id_kraken"]}`);

                    let resultsOHLC = await this.mysqlCon.getCoinOHLC(coinId);

                    let resultsRSI = await this.mysqlCon.getProcessedRSI(
                        coinId
                    );

                    let resultsStochastics = await this.mysqlCon.getProcessedStochastic(
                        coinId
                    );

                    let resultsBollingerBands = await this.mysqlCon.getProcessedBollinger(
                        coinId
                    );

                    this.plotGraph(
                        coinId,
                        coinName,
                        resultsOHLC,
                        resultsRSI,
                        resultsStochastics,
                        resultsBollingerBands
                    );
                }
            });
        });
    }

    plotGraph(
        coinId,
        coinName,
        resultsOHLC,
        resultsRSI,
        resultsStochastics,
        resultsBollingerBands
    ) {
        /* Coin candle indicators */
        let yOpen = resultsOHLC.map((el) => el["open"]);
        let yClose = resultsOHLC.map((el) => el["close"]);
        let yLow = resultsOHLC.map((el) => el["low"]);
        let yHigh = resultsOHLC.map((el) => el["high"]);

        let highestYOHLC = yHigh.reduce((a, b) => Math.max(a, b));
        let lowestYOHLC = yLow.reduce((a, b) => Math.min(a, b));

        /* RSI lines */
        let xRSI = resultsOHLC.map((el) => {
            let date = new Date(el["date"]);
            date = date.toLocaleDateString("en-AU");
            return `${el["time"]} ${date}`;
        });
        let yRSI = resultsRSI.map((el) => el["RSI"]);

        let unfilledAmount = xRSI.length - yRSI.length;
        for (var i = 0; i < unfilledAmount; i++) {
            yRSI.unshift(0);
        }

        /* Stochastic kFast and dSlow */
        let y1Stochastic = resultsStochastics.map((el) => el["k_fast"]);
        let y2Stochastic = resultsStochastics.map((el) => el["d_slow"]);

        /* We let the size of the RSI drive how many xaxis entries we have */
        unfilledAmount = xRSI.length - y1Stochastic.length;
        for (var i = 0; i < unfilledAmount; i++) {
            y1Stochastic.unshift(0);
            y2Stochastic.unshift(0);
        }

        /*let graph = new Plotly(
                        xRSI,
                        yRSI,
                        xStochastic,
                        y1Stochastic,
                        xStochastic,
                        y2Stochastic
                    );
                    graph.plot();*/

        /* Open template file */
        fs.readFile(
            "../plots/template/plotGenerator.html",
            "utf8",
            function (err, data) {
                let plotString = data;
                plotString = plotString.replace(/%coin_name%/g, `${coinName}`);

                plotString = plotString.replace(
                    "%ohlc_x_range_start%",
                    `${xRSI[0]}`
                );

                plotString = plotString.replace(
                    "%ohlc_x_range_end%",
                    `${xRSI[xRSI.length - 1]}`
                );

                plotString = plotString.replace(
                    "%ohlc_y_range_start%",
                    `${lowestYOHLC}`
                );

                plotString = plotString.replace(
                    "%ohlc_y_range_end%",
                    `${highestYOHLC}`
                );

                let dbDateTimeFormat = xRSI.map((el) => {
                    let changedFormat = el.replace(/\//g, "-");
                    let splitFormat = changedFormat.split(" ");
                    return `${splitFormat[1]} ${splitFormat[0]}`;
                });

                plotString = plotString.replace(
                    "%ohlc_x%",
                    `["${dbDateTimeFormat.join('","')}"]`
                );

                plotString = plotString.replace(
                    "%ohlc_low%",
                    `["${yLow.join('","')}"]`
                );

                plotString = plotString.replace(
                    "%ohlc_high%",
                    `["${yHigh.join('","')}"]`
                );

                plotString = plotString.replace(
                    "%ohlc_open%",
                    `["${yOpen.join('","')}"]`
                );

                plotString = plotString.replace(
                    "%ohlc_close%",
                    `["${yClose.join('","')}"]`
                );

                plotString = plotString.replace(
                    "%rsi_x1%",
                    `["${xRSI.join('","')}"]`
                );

                plotString = plotString.replace(
                    "%rsi_y1%",
                    `["${yRSI.join('","')}"]`
                );

                plotString = plotString.replace(
                    "%sto_x1%",
                    `["${xRSI.join('","')}"]`
                );

                plotString = plotString.replace(
                    "%sto_y1%",
                    `["${y1Stochastic.join('","')}"]`
                );

                plotString = plotString.replace(
                    "%sto_x2%",
                    `["${xRSI.join('","')}"]`
                );

                plotString = plotString.replace(
                    "%sto_y2%",
                    `["${y2Stochastic.join('","')}"]`
                );

                write.sync(`../plots/${coinId}.html`, plotString, {
                    newline: true,
                });
            }
        );
    }
}

module.exports = {
    MainLogic,
};
