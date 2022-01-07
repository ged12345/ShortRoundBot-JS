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

const Queuer = require('../utils/queuer.js').Queuer;
const Queue = require('../utils/queue.js');
const ProcessLocks = require('../utils/process-locks.js');
const RSIProcessor = require('../trends-and-signals/RSI-calculations.js');
const StochasticProcessor = require('../trends-and-signals/Stochastic-calculations.js');
const BollingerProcessor = require('../trends-and-signals/BollingerBands-calculations.js');
const GeneralAdviceProcessor = require('../advice-processing/General-advice.js');
const EMAProcessor = require('../trends-and-signals/EMA-calculations.js');
const MACDProcessor = require('../trends-and-signals/MACD-calculations.js');
const API = require('../utils/api.js');
const { calculateGraphGradientsTrendsPerChange } = require('../utils/math.js');
const { rotateArray, outputError } = require('../utils/general.js');
const TimeNow = require('../utils/timeNow.js');

const util = require('util');
const fs = require('fs');
const write = require('write');

class MainLogic {
    // Need to "lock" bot when new info comes in.

    constructor(mysqlCon, exchange) {
        this.queueSetupComplete = false;
        this.mysqlCon = mysqlCon;

        this.coinBotConfig = null;
        this.coinConfigArr = Array();

        // For the MACD (EMA-9, EMA-12, EMA-26)
        this.graphPeriod = 32;
        this.OHLCStoreNum = 33; // 26 time periods (33 now, because we're storing one extra, the first one which is never correct)
        this.RSIStoreNum = 15; // 14 for calculations plus the latest
        this.StochasticStoreNum = 14; // 14 time periods
        this.BollingerStoreNum = 21; // 21 time periods
        this.EMAStoreNum = this.graphPeriod;

        this.currTimestamp = 0;
        this.simulateTimestamp = -1;

        this.processLocks = new ProcessLocks([
            'OHLC',
            'RSI',
            'Stochastic',
            'Bollinger',
            'EMA',
            'MACD',
            'Advice',
        ]);

        /* Init the Exchange object */
        this.exchange = exchange;

        this.init();
    }

    async setupProcessors() {
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
        this.EMAProcessor = new EMAProcessor(
            this.mysqlCon,
            this.EMAStoreNum,
            this.graphPeriod,
            this.processLocks.unlock
        );
        this.MACDProcessor = new MACDProcessor(
            this.mysqlCon,
            this.EMAStoreNum,
            this.graphPeriod,
            this.processLocks.unlock
        );

        this.GeneralAdviceProcessor = new GeneralAdviceProcessor(
            this.mysqlCon,
            this.BollingerStoreNum,
            this.RSIStoreNum,
            this.StochasticStoreNum,
            this.EMAStoreNum,
            this.graphPeriod,
            this.processLocks.unlock
        );
    }

    async init() {
        await this.setupProcessors();
        await this.cleanOldData();
        await this.getCoinConfig();
        await this.setupSimulatedTimeNow();
        await this.setupExchange();
        await this.setupQueues();
    }

    async getCoinConfig() {
        /* Exchange 3, bot 1 for coin bot */
        this.coinBotConfig = await this.mysqlCon.getCoinConfig(1, 3);
        this.coinConfigArr = await this.mysqlCon.getCoinList();
    }

    async cleanOldData() {
        await this.mysqlCon.emptyCoinOHLC();
        await this.mysqlCon.emptyProcessRSI();
        await this.mysqlCon.emptyProcessStochastic();
        await this.mysqlCon.emptyProcessBollinger();
        await this.mysqlCon.emptyProcessEMA();
        await this.mysqlCon.emptyProcessMACD();
        await this.mysqlCon.emptyTrends();
        await this.mysqlCon.emptyCoinAdvice();
    }

    async setupSimulatedTimeNow() {
        this.simulatedStartTimestamp = parseInt(
            this.coinBotConfig['curr_timestamp'],
            10
        );
        this.simulatedEndTimestamp = parseInt(
            this.coinBotConfig['end_timestamp'],
            10
        );

        if (
            /* This is if we want to simulate from one time to another , so we can log results mor eeasily and overcome the start-up time until results */
            this.simulatedStartTimestamp !== -1 &&
            this.simulatedEndTimestamp !== -1
        ) {
            TimeNow.setStartEndIterateTime(
                this.simulatedStartTimestamp,
                this.simulatedEndTimestamp,
                1,
                5000
            );
        } /* If we're simulated from a certain time but we don't know the end time (every minute) - remember that it takes a number of minutes to properly simulate reaults, as usual*/ else if (
            this.simulatedStartTimestamp !== -1
        ) {
            TimeNow.setStartTime(this.simulateStartTimestamp);
        }
    }

    async setupExchange() {
        this.exchange.curr.initApi(
            this.coinBotConfig['api_key'],
            this.coinBotConfig['priv_api_key'],
            this.coinBotConfig['2fa_pass']
        );
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
        //let OHLCFrequency = 60000 / numberOfCoins;

        let OHLCFrequency = 6000 / numberOfCoins;
        this.coinDataAcquisitionQueuer.enqueueQueue(
            this.OHLCAcquisitionQueue,
            OHLCFrequency /* We only acquire this info once a minute */,
            true,
            true,
            true,
            1000 /* Just after the close */
        );

        this.coinDataAcquisitionQueuer.enqueueQueue(
            this.OHLCAcquisitionQueue,
            OHLCFrequency /* We only acquire this info once a minute */,
            true,
            true,
            true,
            11000 /* Just after the close */
        );

        this.coinDataAcquisitionQueuer.enqueueQueue(
            this.OHLCAcquisitionQueue,
            OHLCFrequency /* We only acquire this info once a minute */,
            true,
            true,
            true,
            21000 /* Just after the close */
        );

        this.coinDataAcquisitionQueuer.enqueueQueue(
            this.OHLCAcquisitionQueue,
            OHLCFrequency /* We only acquire this info once a minute */,
            true,
            true,
            true,
            31000 /* Just after the close */
        );

        this.coinDataAcquisitionQueuer.enqueueQueue(
            this.OHLCAcquisitionQueue,
            OHLCFrequency /* We only acquire this info once a minute */,
            true,
            true,
            true,
            41000 /* Just after the close */
        );

        this.coinDataAcquisitionQueuer.enqueueQueue(
            this.OHLCAcquisitionQueue,
            OHLCFrequency /* We only acquire this info once a minute */,
            true,
            true,
            true,
            51000 /* Just after the close */
        );

        this.RSIProcessingQueue = new Queue();
        this.StochasticProcessingQueue = new Queue();
        this.BollingerProcessingQueue = new Queue();
        this.EMAProcessingQueue = new Queue();
        this.MACDProcessingQueue = new Queue();
        this.setupTrendsAndSignalsProcessingQueue();

        /* We up this for each trend/signal we calculate, and for each coin */
        let trendsAndSignalsNumber = 1;
        let trendsAndSignalsFrequency =
            60000 / (trendsAndSignalsNumber * numberOfCoins);
        this.coinTrendsAndSignalsProcessingQueuer.enqueueQueue(
            this.RSIProcessingQueue,
            trendsAndSignalsFrequency /* We only acquire this info once a minute */,
            true,
            true,
            true,
            3000
        );

        this.coinTrendsAndSignalsProcessingQueuer.enqueueQueue(
            this.RSIProcessingQueue,
            trendsAndSignalsFrequency /* We only acquire this info once a minute */,
            true,
            true,
            true,
            13000
        );

        this.coinTrendsAndSignalsProcessingQueuer.enqueueQueue(
            this.RSIProcessingQueue,
            trendsAndSignalsFrequency /* We only acquire this info once a minute */,
            true,
            true,
            true,
            23000
        );

        this.coinTrendsAndSignalsProcessingQueuer.enqueueQueue(
            this.RSIProcessingQueue,
            trendsAndSignalsFrequency /* We only acquire this info once a minute */,
            true,
            true,
            true,
            33000
        );

        this.coinTrendsAndSignalsProcessingQueuer.enqueueQueue(
            this.RSIProcessingQueue,
            trendsAndSignalsFrequency /* We only acquire this info once a minute */,
            true,
            true,
            true,
            43000
        );

        this.coinTrendsAndSignalsProcessingQueuer.enqueueQueue(
            this.RSIProcessingQueue,
            trendsAndSignalsFrequency /* We only acquire this info once a minute */,
            true,
            true,
            true,
            53000
        );

        this.coinTrendsAndSignalsProcessingQueuer.enqueueQueue(
            this.StochasticProcessingQueue,
            trendsAndSignalsFrequency /* We only acquire this info once a minute */,
            true,
            true,
            true,
            4000
        );

        this.coinTrendsAndSignalsProcessingQueuer.enqueueQueue(
            this.StochasticProcessingQueue,
            trendsAndSignalsFrequency /* We only acquire this info once a minute */,
            true,
            true,
            true,
            14000
        );

        this.coinTrendsAndSignalsProcessingQueuer.enqueueQueue(
            this.StochasticProcessingQueue,
            trendsAndSignalsFrequency /* We only acquire this info once a minute */,
            true,
            true,
            true,
            24000
        );

        this.coinTrendsAndSignalsProcessingQueuer.enqueueQueue(
            this.StochasticProcessingQueue,
            trendsAndSignalsFrequency /* We only acquire this info once a minute */,
            true,
            true,
            true,
            34000
        );

        this.coinTrendsAndSignalsProcessingQueuer.enqueueQueue(
            this.StochasticProcessingQueue,
            trendsAndSignalsFrequency /* We only acquire this info once a minute */,
            true,
            true,
            true,
            44000
        );

        this.coinTrendsAndSignalsProcessingQueuer.enqueueQueue(
            this.StochasticProcessingQueue,
            trendsAndSignalsFrequency /* We only acquire this info once a minute */,
            true,
            true,
            true,
            54000
        );

        this.coinTrendsAndSignalsProcessingQueuer.enqueueQueue(
            this.BollingerProcessingQueue,
            trendsAndSignalsFrequency /* We only acquire this info once a minute */,
            true,
            true,
            true,
            5000
        );

        this.coinTrendsAndSignalsProcessingQueuer.enqueueQueue(
            this.BollingerProcessingQueue,
            trendsAndSignalsFrequency /* We only acquire this info once a minute */,
            true,
            true,
            true,
            15000
        );

        this.coinTrendsAndSignalsProcessingQueuer.enqueueQueue(
            this.BollingerProcessingQueue,
            trendsAndSignalsFrequency /* We only acquire this info once a minute */,
            true,
            true,
            true,
            25000
        );

        this.coinTrendsAndSignalsProcessingQueuer.enqueueQueue(
            this.BollingerProcessingQueue,
            trendsAndSignalsFrequency /* We only acquire this info once a minute */,
            true,
            true,
            true,
            35000
        );

        this.coinTrendsAndSignalsProcessingQueuer.enqueueQueue(
            this.BollingerProcessingQueue,
            trendsAndSignalsFrequency /* We only acquire this info once a minute */,
            true,
            true,
            true,
            45000
        );

        this.coinTrendsAndSignalsProcessingQueuer.enqueueQueue(
            this.BollingerProcessingQueue,
            trendsAndSignalsFrequency /* We only acquire this info once a minute */,
            true,
            true,
            true,
            55000
        );

        this.coinTrendsAndSignalsProcessingQueuer.enqueueQueue(
            this.EMAProcessingQueue,
            trendsAndSignalsFrequency /* We only acquire this info once a minute */,
            true,
            true,
            true,
            6000
        );

        this.coinTrendsAndSignalsProcessingQueuer.enqueueQueue(
            this.EMAProcessingQueue,
            trendsAndSignalsFrequency /* We only acquire this info once a minute */,
            true,
            true,
            true,
            16000
        );

        this.coinTrendsAndSignalsProcessingQueuer.enqueueQueue(
            this.EMAProcessingQueue,
            trendsAndSignalsFrequency /* We only acquire this info once a minute */,
            true,
            true,
            true,
            26000
        );

        this.coinTrendsAndSignalsProcessingQueuer.enqueueQueue(
            this.EMAProcessingQueue,
            trendsAndSignalsFrequency /* We only acquire this info once a minute */,
            true,
            true,
            true,
            36000
        );

        this.coinTrendsAndSignalsProcessingQueuer.enqueueQueue(
            this.EMAProcessingQueue,
            trendsAndSignalsFrequency /* We only acquire this info once a minute */,
            true,
            true,
            true,
            46000
        );

        this.coinTrendsAndSignalsProcessingQueuer.enqueueQueue(
            this.EMAProcessingQueue,
            trendsAndSignalsFrequency /* We only acquire this info once a minute */,
            true,
            true,
            true,
            56000
        );

        this.coinTrendsAndSignalsProcessingQueuer.enqueueQueue(
            this.MACDProcessingQueue,
            trendsAndSignalsFrequency /* We only acquire this info once a minute */,
            true,
            true,
            true,
            7000
        );

        this.coinTrendsAndSignalsProcessingQueuer.enqueueQueue(
            this.MACDProcessingQueue,
            trendsAndSignalsFrequency /* We only acquire this info once a minute */,
            true,
            true,
            true,
            17000
        );

        this.coinTrendsAndSignalsProcessingQueuer.enqueueQueue(
            this.MACDProcessingQueue,
            trendsAndSignalsFrequency /* We only acquire this info once a minute */,
            true,
            true,
            true,
            27000
        );

        this.coinTrendsAndSignalsProcessingQueuer.enqueueQueue(
            this.MACDProcessingQueue,
            trendsAndSignalsFrequency /* We only acquire this info once a minute */,
            true,
            true,
            true,
            37000
        );

        this.coinTrendsAndSignalsProcessingQueuer.enqueueQueue(
            this.MACDProcessingQueue,
            trendsAndSignalsFrequency /* We only acquire this info once a minute */,
            true,
            true,
            true,
            47000
        );

        this.coinTrendsAndSignalsProcessingQueuer.enqueueQueue(
            this.MACDProcessingQueue,
            trendsAndSignalsFrequency /* We only acquire this info once a minute */,
            true,
            true,
            true,
            57000
        );

        /* Calculating general advice info */
        this.GeneralAdviceQueue = new Queue();
        this.setupGeneralCoinAdviceQueue();

        this.coinAdviceGenerationQueuer.enqueueQueue(
            this.GeneralAdviceQueue,
            trendsAndSignalsFrequency /* We only acquire this info once a minute */,
            true,
            true,
            true,
            9000
        );

        this.coinAdviceGenerationQueuer.enqueueQueue(
            this.GeneralAdviceQueue,
            trendsAndSignalsFrequency /* We only acquire this info once a minute */,
            true,
            true,
            true,
            19000
        );

        this.coinAdviceGenerationQueuer.enqueueQueue(
            this.GeneralAdviceQueue,
            trendsAndSignalsFrequency /* We only acquire this info once a minute */,
            true,
            true,
            true,
            29000
        );

        this.coinAdviceGenerationQueuer.enqueueQueue(
            this.GeneralAdviceQueue,
            trendsAndSignalsFrequency /* We only acquire this info once a minute */,
            true,
            true,
            true,
            39000
        );

        this.coinAdviceGenerationQueuer.enqueueQueue(
            this.GeneralAdviceQueue,
            trendsAndSignalsFrequency /* We only acquire this info once a minute */,
            true,
            true,
            true,
            49000
        );

        this.coinAdviceGenerationQueuer.enqueueQueue(
            this.GeneralAdviceQueue,
            trendsAndSignalsFrequency /* We only acquire this info once a minute */,
            true,
            true,
            true,
            59000
        );

        /* Plotting graphs to compare calculations with online */
        this.PlotlyGraphingQueue = new Queue();
        this.setupTrendsAndSignalsGraphingQueue();

        this.coinTrendsAndSignalsGraphingQueuer.enqueueQueue(
            this.PlotlyGraphingQueue,
            trendsAndSignalsFrequency /* We only acquire this info once a minute */,
            true,
            true,
            true,
            11000
        );

        this.coinTrendsAndSignalsGraphingQueuer.enqueueQueue(
            this.PlotlyGraphingQueue,
            trendsAndSignalsFrequency /* We only acquire this info once a minute */,
            true,
            true,
            true,
            21000
        );

        this.coinTrendsAndSignalsGraphingQueuer.enqueueQueue(
            this.PlotlyGraphingQueue,
            trendsAndSignalsFrequency /* We only acquire this info once a minute */,
            true,
            true,
            true,
            31000
        );

        this.coinTrendsAndSignalsGraphingQueuer.enqueueQueue(
            this.PlotlyGraphingQueue,
            trendsAndSignalsFrequency /* We only acquire this info once a minute */,
            true,
            true,
            true,
            41000
        );

        this.coinTrendsAndSignalsGraphingQueuer.enqueueQueue(
            this.PlotlyGraphingQueue,
            trendsAndSignalsFrequency /* We only acquire this info once a minute */,
            true,
            true,
            true,
            51000
        );

        this.queueSetupComplete = true;

        /* If we're simulating a run, we start here */
        TimeNow.startIterate();
    }

    processQueues() {
        /* Here we process both incoming coin bot advice (locked or not) and monitor bots current trades */
        if (
            this.queueSetupComplete === true /*&& this.shouldProcessQueues()*/
        ) {
            this.coinDataAcquisitionQueuer.processQueues();
            this.coinTrendsAndSignalsProcessingQueuer.processQueues();
            this.coinAdviceGenerationQueuer.processQueues();
            this.coinTrendsAndSignalsGraphingQueuer.processQueues();
        }
    }

    shouldProcessQueues() {
        /* If we're running a simulation, we force the iterations each heartbeat - when we finish the simulation we stop processing. */
        if (TimeNow.forceIterate === true && TimeNow.finishedIterate === true) {
            return false;
        } else if (
            TimeNow.forceIterate === true &&
            this.currTimestamp !== TimeNow.nowSeconds()
        ) {
            this.currTimestamp = TimeNow.nowSeconds();
            return true;
        }

        return true;
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
        this.setupEMAProcessingQueue();
        this.setupMACDProcessingQueue();
    }

    setupTrendsAndSignalsGraphingQueue() {
        rotateArray(this.coinConfigArr, 1);
        this.setupPlotlyGraphingQueue();
    }

    async setupOHLCAcquisitionQueue() {
        /* We need to get all the coins we're going to focus on here from mysql - for now we'll just use BTCUSD for testing. */

        this.coinConfigArr.forEach((coin) => {
            this.OHLCAcquisitionQueue.enqueue(async () => {
                this.processLocks.lock('OHLC', coin['id']);

                console.log(coin);
                console.log(`${this.exchange.name}`);

                this.getOHLC(
                    coin['id'],
                    coin[`coin_id_${this.exchange.name}`],
                    this.OHLCStoreNum
                );
            });
        });
    }

    async getOHLC(coinId, coinPair, storeNum) {
        /* DEBUG: REMOVE THIS LATER */
        //if (coinId != 1) return;

        console.log(`Acquiring OHLC: ${coinPair}`);
        this.exchange.curr.OHLC(coinPair, 1, async (result) => {
            /* This gets the result array in the proper order */
            try {
                let ohlcDesc = this.getOHLCArray(result, coinPair);

                /* DEBUG: Reset for multiple coins */
                //if (coinId == 1) {
                this.calculateOHLCTrends(coinId, ohlcDesc);
                //}

                let limiterIndex = 0;
                for (const ohlcEl of ohlcDesc) {
                    await this.mysqlCon.storeCoinOHLC(coinId, ohlcEl);

                    if (limiterIndex >= storeNum) break;
                    limiterIndex++;
                }
                await this.mysqlCon.cleanupCoinOHLC(coinId, storeNum);
            } catch (err) {
                outputError(err);
                outputError(util.inspect(result));
            }
            /* Unlock ohlc here so we can do calculations on this element - do we need this per coin? */
            this.processLocks.unlock('OHLC');
        });
    }

    getOHLCArray(ohlcResult, coinPair) {
        let ohlcDesc = null;
        if (this.simulateTimestamp === -1) {
            ohlcDesc = ohlcResult[coinPair].reverse();
        } else {
            // For timestamp simulation
            ohlcDesc = ohlcResult[coinPair].reverse().filter((el) => {
                // Return array elements which are less than or equal to the indicated timestamp, adjusted for the current minute
                if (parseInt(el[0], 10) <= TimeNow.nowSeconds()) {
                    return true;
                } else {
                    return false;
                }
            });
        }

        return ohlcDesc;
    }

    setOHLCTimestamp(ohlcArr) {
        let timestamp = 0;
        if (this.simulateTimestamp === -1) {
            timestamp = this.currTimestamp = ohlcArr[0][0];
        } else {
            // For timestamp simulation
            timestamp = this.currTimestamp = TimeNow.nowSeconds();
        }

        return timestamp;
    }

    calculateOHLCTrends(coinId, ohlcArr) {
        /* Here we calculate the trends for each value of the OHLC then add them to our ohlcEl array */

        let timestamp = this.setOHLCTimestamp(ohlcArr);

        const closeArr = ohlcArr.map((el) => {
            // Close value in array
            return el[4];
        });

        const close_t1to3 = calculateGraphGradientsTrendsPerChange(
            closeArr.slice(0, 8).reverse(),
            true
        );

        //console.log('CLOSE TRENDS: ');
        //console.log(closeArr.slice(0, 4).reverse());
        //console.log(close_t1to3);

        this.mysqlCon.storeTrends(coinId, timestamp, close_t1to3, 'close');
    }

    async setupRSIProcessingQueue() {
        /* We do processing in the same way we did previously, an RSI for each coin. */

        this.coinConfigArr.forEach((coin) => {
            let trend = 'RSI';
            this.RSIProcessingQueue.enqueue(async () => {
                console.log(
                    `Processing ${trend}: ${
                        coin[`coin_id_${this.exchange.name}`]
                    }`
                );

                this.processTrendWithLock(this.RSIProcessor, trend, coin['id']);
            });
        });
    }

    async setupStochasticProcessingQueue() {
        /* We do processing in the same way we did previously, a Stochastic for each coin. */

        this.coinConfigArr.forEach((coin) => {
            let trend = 'Stochastic';
            this.StochasticProcessingQueue.enqueue(async () => {
                console.log(
                    `Processing ${trend}: ${
                        coin[`coin_id_${this.exchange.name}`]
                    }`
                );

                this.processTrendWithLock(
                    this.StochasticProcessor,
                    trend,
                    coin['id']
                );
            });
        });
    }

    async setupBollingerProcessingQueue() {
        /* We do processing in the same way we did previously, a BollingerBand for each coin. */

        this.coinConfigArr.forEach((coin) => {
            let trend = 'Bollinger';
            this.BollingerProcessingQueue.enqueue(async () => {
                console.log(
                    `Processing ${trend}: ${
                        coin[`coin_id_${this.exchange.name}`]
                    }`
                );

                this.processTrendWithLock(
                    this.BollingerProcessor,
                    trend,
                    coin['id']
                );
            });
        });
    }

    async setupEMAProcessingQueue() {
        /* We do processing in the same way we did previously, a BollingerBand for each coin. */

        this.coinConfigArr.forEach((coin) => {
            let trend = 'EMA';
            this.EMAProcessingQueue.enqueue(async () => {
                console.log(
                    `Processing ${trend}: ${
                        coin[`coin_id_${this.exchange.name}`]
                    }`
                );

                this.processTrendWithLock(this.EMAProcessor, trend, coin['id']);
            });
        });
    }

    async setupMACDProcessingQueue() {
        /* We do processing in the same way we did previously, a MACDfor each coin. */

        this.coinConfigArr.forEach((coin) => {
            let trend = 'MACD';
            this.MACDProcessingQueue.enqueue(async () => {
                console.log(
                    `Processing ${trend}: ${
                        coin[`coin_id_${this.exchange.name}`]
                    }`
                );

                this.processTrendWithLock(
                    this.MACDProcessor,
                    trend,
                    coin['id']
                );
            });
        });
    }

    setupGeneralCoinAdviceQueue() {
        this.setupGeneralAdviceQueue();
    }

    setupGeneralAdviceQueue() {
        this.coinConfigArr.forEach((coin) => {
            let trend = 'Advice';
            this.GeneralAdviceQueue.enqueue(async () => {
                console.log(
                    `Processing ${trend}: ${
                        coin[`coin_id_${this.exchange.name}`]
                    }`
                );

                this.calculateAdviceWithLock(
                    this.GeneralAdviceProcessor,
                    trend,
                    coin['id']
                );
            });
        });
    }

    /* Generic processor lock and then wait for function to finish to unlock */
    async processTrendWithLock(processor, trend, coinId) {
        this.processLocks.lock(trend, coinId);
        await processor.calculate(coinId);
        //await processor.findTrends(coinId);
        let unlocked = this.processLocks.awaitLock(trend, coinId);

        if (unlocked === false) {
            console.log(
                `Error: ${trend} lock for ${coinId} is not for the current coin!`
            );
        }
    }

    async calculateAdviceWithLock(advisor, trend, coinId) {
        this.processLocks.lock(trend, coinId);
        /* DEBUG */
        if (coinId === 1) {
            let advice = await advisor.advise(coinId);
            if (advice !== false) {
                console.log(advice);
                await this.mysqlCon.storeCoinAdvice(
                    coinId,
                    this.currTimestamp,
                    advice
                );
                await this.mysqlCon.cleanupCoinAdvice(coinId);
            }
        }
        let unlocked = this.processLocks.awaitLock(trend, coinId);

        if (unlocked === false) {
            console.log(
                `Error: ${trend} lock for ${coinId} is not for the current coin!`
            );
        }
    }

    setupPlotlyGraphingQueue() {
        this.coinConfigArr.forEach((coin) => {
            let trend = 'Plotly';
            this.PlotlyGraphingQueue.enqueue(async () => {
                let coinId = coin['id'];
                let coinName = coin['coin_name'];

                console.log(
                    `Plotting ${trend}: ${
                        coin[`coin_id_${this.exchange.name}`]
                    }`
                );

                let resultsOHLC = await this.mysqlCon.getCoinOHLC(coinId);

                let resultsRSI = await this.mysqlCon.getProcessedRSI(coinId);

                let resultsEMA = await this.mysqlCon.getProcessedEMA(coinId);

                let resultsStochastics =
                    await this.mysqlCon.getProcessedStochastic(coinId);

                let resultsBollingerBands =
                    await this.mysqlCon.getProcessedBollinger(coinId);

                this.plotGraph(
                    coinId,
                    coinName,
                    resultsOHLC,
                    resultsRSI,
                    resultsEMA,
                    resultsStochastics,
                    resultsBollingerBands
                );
            });
        });
    }

    plotGraph(
        coinId,
        coinName,
        resultsOHLC,
        resultsRSI,
        resultsEMA,
        resultsStochastics,
        resultsBollingerBands
    ) {
        if (resultsOHLC.length == 0) {
            return;
        }

        /* Coin candle indicators */
        let yOpen = resultsOHLC.map((el) => el['open']);
        let yClose = resultsOHLC.map((el) => el['close']);
        let yLow = resultsOHLC.map((el) => el['low']);
        let yHigh = resultsOHLC.map((el) => el['high']);

        /* RSI lines */
        let xRSI = resultsOHLC.map((el) => {
            /*let date = new Date(el["date"]);
            date = date.toLocaleDateString("en-AU");
            return `${el["time"]} ${date}`;*/
            return `${el['time'].split('.')[0]}`;
        });
        /* Need toFixed as value is too precise */
        let yRSI = resultsRSI.map((el) => Number(el['RSI']).toFixed(4));

        let unfilledAmount = xRSI.length - yRSI.length;
        for (var i = 0; i < unfilledAmount; i++) {
            yRSI.unshift('');
        }

        let yEMA = resultsEMA.map((el) => Number(el['SMA']).toFixed(4));
        unfilledAmount = xRSI.length - yEMA.length;
        for (var i = 0; i < unfilledAmount; i++) {
            yEMA.unshift('');
        }

        /* Stochastic kFast and dSlow */
        let ykFastStochastic = resultsStochastics.map((el) => el['k_fast']);
        let ydSlowStochastic = resultsStochastics.map((el) => el['d_slow']);

        /* Stochastic kFull and dFull */
        let ykFullStochastic = resultsStochastics.map((el) => el['k_full']);
        let ydFullStochastic = resultsStochastics.map((el) => el['d_full']);

        /* We let the size of the RSI drive how many xaxis entries we have */
        unfilledAmount = xRSI.length - ykFastStochastic.length;
        for (var i = 0; i < unfilledAmount; i++) {
            ykFastStochastic.unshift('');
            ydSlowStochastic.unshift('');
            ykFullStochastic.unshift('');
            ydFullStochastic.unshift('');
        }

        let y1Bollinger = resultsBollingerBands.map((el) => el['bol_ma']);
        let y2Bollinger = resultsBollingerBands.map((el) => el['bol_u']);
        let y3Bollinger = resultsBollingerBands.map((el) => el['bol_d']);

        let highestYOHLC = yHigh.reduce((a, b) => Math.max(a, b));
        let lowestYOHLC = yLow.reduce((a, b) => Math.min(a, b));
        /* We use the Bollinger bands for the range of the candle graph of large than the above */
        let highestYBOLU = y2Bollinger.reduce((a, b) => Math.max(a, b));
        let lowestYBOLD = y3Bollinger.reduce((a, b) => Math.min(a, b));

        let highestYEMA = yEMA.reduce((a, b) => Math.max(a, b));
        let lowestYEMA = yEMA.reduce((a, b) => Math.min(a, b));

        let highestCandleY =
            highestYOHLC < highestYBOLU ? highestYBOLU : highestYOHLC;
        /* Now we have to take into account EMA */
        highestCandleY =
            highestYEMA > highestCandleY ? highestYEMA : highestCandleY;

        let lowestCandleY =
            lowestYOHLC < lowestYBOLD || lowestYBOLD === 0
                ? lowestYOHLC
                : lowestYBOLD;

        /* Now we have to take into account EMA */
        if (lowestYEMA !== 0) {
            lowestCandleY =
                lowestYEMA < lowestCandleY ? lowestYEMA : lowestCandleY;
        }

        /* We let the size of the RSI drive how many xaxis entries we have */
        unfilledAmount = xRSI.length - y1Bollinger.length;

        for (var i = 0; i < unfilledAmount; i++) {
            y1Bollinger.unshift('');
            y2Bollinger.unshift('');
            y3Bollinger.unshift('');
        }

        /* Open template file */
        fs.readFile(
            '../plots/template/plotGenerator.html',
            'utf8',
            function (err, data) {
                let plotString = data;
                plotString = plotString.replace(/%coin_name%/g, `${coinName}`);

                plotString = plotString.replace(
                    '%ohlc_x_range_start%',
                    `${xRSI[0]}`
                );

                plotString = plotString.replace(
                    '%ohlc_x_range_end%',
                    `${xRSI[xRSI.length - 1]}`
                );

                plotString = plotString.replace(
                    '%ohlc_y_range_start%',
                    `${lowestCandleY}`
                );

                plotString = plotString.replace(
                    '%ohlc_y_range_end%',
                    `${highestCandleY}`
                );

                let dbDateTimeFormat = xRSI.map((el) => {
                    let changedFormat = el.replace(/\//g, '-');
                    return `${changedFormat}`;
                    //let splitFormat = changedFormat.split(" ");
                    //return `${splitFormat[1]} ${splitFormat[0]}`;
                });

                plotString = plotString.replace(
                    '%ohlc_x%',
                    `["${dbDateTimeFormat.join('","')}"]`
                );

                plotString = plotString.replace(
                    '%ohlc_low%',
                    `["${yLow.join('","')}"]`
                );

                plotString = plotString.replace(
                    '%ohlc_high%',
                    `["${yHigh.join('","')}"]`
                );

                plotString = plotString.replace(
                    '%ohlc_open%',
                    `["${yOpen.join('","')}"]`
                );

                plotString = plotString.replace(
                    '%ohlc_close%',
                    `["${yClose.join('","')}"]`
                );

                /* Bollinger */
                plotString = plotString.replace(
                    '%boll_ma_x1%',
                    `["${dbDateTimeFormat.join('","')}"]`
                );

                plotString = plotString.replace(
                    '%boll_ma_y1%',
                    `["${y1Bollinger.join('","')}"]`
                );

                plotString = plotString.replace(
                    '%boll_u_x1%',
                    `["${dbDateTimeFormat.join('","')}"]`
                );

                plotString = plotString.replace(
                    '%boll_u_y1%',
                    `["${y2Bollinger.join('","')}"]`
                );

                plotString = plotString.replace(
                    '%boll_l_x1%',
                    `["${dbDateTimeFormat.join('","')}"]`
                );

                plotString = plotString.replace(
                    '%boll_l_y1%',
                    `["${y3Bollinger.join('","')}"]`
                );

                /* EMA */

                plotString = plotString.replace(
                    '%ema_x1%',
                    `["${dbDateTimeFormat.join('","')}"]`
                );

                plotString = plotString.replace(
                    '%ema_y1%',
                    `["${yEMA.join('","')}"]`
                );

                /* RSI */
                plotString = plotString.replace(
                    '%rsi_x1%',
                    `["${xRSI.join('","')}"]`
                );

                plotString = plotString.replace(/%rsi_title%/g, `RSI`);

                plotString = plotString.replace(
                    '%rsi_y1%',
                    `["${yRSI.join('","')}"]`
                );

                //RSI Range
                // [-2, 105]
                plotString = plotString.replace('%rsi_y_range_start%', `-2`);

                plotString = plotString.replace('%rsi_y_range_end%', `105`);

                /* Stochastics */
                plotString = plotString.replace(
                    '%sto_fast_x1%',
                    `["${xRSI.join('","')}"]`
                );

                plotString = plotString.replace(
                    '%sto_fast_y1%',
                    `["${ykFastStochastic.join('","')}"]`
                );

                plotString = plotString.replace(
                    '%sto_slow_x2%',
                    `["${xRSI.join('","')}"]`
                );

                plotString = plotString.replace(
                    '%sto_slow_y2%',
                    `["${ydSlowStochastic.join('","')}"]`
                );

                plotString = plotString.replace(
                    '%sto_full_x1%',
                    `["${xRSI.join('","')}"]`
                );

                plotString = plotString.replace(
                    '%sto_full_y1%',
                    `["${ykFullStochastic.join('","')}"]`
                );

                plotString = plotString.replace(
                    '%sto_full_x2%',
                    `["${xRSI.join('","')}"]`
                );

                plotString = plotString.replace(
                    '%sto_full_y2%',
                    `["${ydFullStochastic.join('","')}"]`
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
