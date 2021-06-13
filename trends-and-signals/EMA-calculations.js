/*
 */
const util = require('util');
const { calculateGraphGradientsTrendsPerChange } = require('../utils/math.js');
class EMACalculations {
    constructor(mysqlCon, storeNum, totalRecordsNum, unlockKey) {
        this.mysqlCon = mysqlCon;
        this.EMAStoreNum = storeNum;
        this.totalRecordsNum = totalRecordsNum;
        this.unlockKey = unlockKey;
    }

    async cleanup(coinId) {
        /* Cleanup the processed RSI and limit */
        await this.mysqlCon.cleanupProcessedEMA(coinId, this.totalRecordsNum);
        /* Unlock the coin for processing */
        this.unlockKey('EMA');
    }

    async calculate(coinId) {
        let resultsEMA = await this.mysqlCon.getProcessedEMA(coinId);
        if (resultsEMA.length === 0) {
            //console.log("EMA FIRST: " + coinId);
            await this.firstEMACalculation(coinId);
        } else {
            //console.log("EMA SECOND: " + coinId);
            await this.secondEMACalculation(coinId);
        }

        this.cleanup(coinId);
    }

    async firstEMACalculation(coinId) {
        let resultsOHLC = await this.mysqlCon.getCoinOHLC(coinId);

        /* No acquired OHLC results yet */
        if (resultsOHLC.length === 0) return;

        /* 1. Iterate through 32 OHLC entries, and calculate the SMA. */
        let totalOHLCResults = resultsOHLC.length;
        let totalClose = 0;
        /* Everything but the last value. We calculate the SMA first but calculate the EMA of the last OHLC value (the SMA being the EMA for yesterday) */

        resultsOHLC.forEach((el, index) => {
            if (index < this.totalRecordsNum - 1) {
                totalClose += Number(el['close']);
            }
        });

        let lastElOHLC = resultsOHLC[resultsOHLC.length - 1];
        let close = Number(lastElOHLC['close']);

        let SMA = totalClose / this.EMAStoreNum;
        //let multiplier = 2 / (this.EMAStoreNum + 1);
        //let EMA = close * multiplier + SMA * (1 - multiplier);

        let currEMA = {
            timestamp: lastElOHLC['timestamp'],
            close: close,
            SMA: SMA,
            EMA: 0,
            trend: 'NULL',
            trend_weighting:
                'NULL' /* Like a momentum indicator - how long have we been trending for? */,
        };

        /* Add this to mysql and then cleanup*/
        await this.mysqlCon.storeProcessedEMA(coinId, currEMA);
        this.cleanup(coinId);
    }

    async secondEMACalculation(coinId) {
        let resultsOHLC = await this.mysqlCon.getCoinOHLC(coinId);

        /* No acquired OHLC results yet */
        if (resultsOHLC.length === 0) return;

        let resultsEMA = await this.mysqlCon.getProcessedEMA(coinId);

        if (resultsEMA.length === 0) return;

        /* 1. Iterate through 32 OHLC entries, and calculate the SMA. */ let totalClose = 0;
        /* Everything but the last value. We calculate the SMA first but calculate the EMA of the last OHLC value (the SMA being the EMA for yesterday) */

        resultsOHLC.forEach((el, index) => {
            if (index < this.totalRecordsNum) {
                totalClose += Number(el['close']);
            }
        });

        let lastElOHLC = resultsOHLC[resultsOHLC.length - 1];
        let prevElSMA = resultsEMA[resultsEMA.length - 1];
        let close = Number(lastElOHLC['close']);
        let SMA = totalClose / this.EMAStoreNum;

        let multiplier = 2 / (this.EMAStoreNum + 1);
        let EMA = 0;

        if (resultsEMA.length === 1) {
            EMA = close * multiplier + prevElSMA['SMA'] * (1 - multiplier);
        } else {
            EMA = close * multiplier + prevElSMA['EMA'] * (1 - multiplier);
        }

        let arrEMA = resultsEMA.map((el) => {
            return el['EMA'];
        });
        arrEMA.push(EMA);

        /* We calculate the trend and trend weighting here */
        let trend = 0;
        let trendArr = [];
        /* NOTE: We currently don't use this */
        /*if (resultsEMA.length > 1) {
            trendArr = calculateGraphGradients(arrEMA);
            trend = trendArr[0][trendArr[0].length - 1];
        }*/

        let currEMA = {
            timestamp: lastElOHLC['timestamp'],
            close: close,
            SMA: SMA,
            EMA: EMA,
            trend: trend,
            trend_weighting: 0 /* Like a momentum indicator - how long have we been trending for? */,
        };

        // We need at least three EMAS to calculate the trend/grade

        /* Here we look back and see if a similar trend has occurred and for how long, then we calculate the weighting (1 + N periods/10, which we can use to multiply probability of trend/buy?) */

        /* Add this to mysql and then cleanup*/
        await this.mysqlCon.storeProcessedEMA(coinId, currEMA);
        await this.mysqlCon.cleanupProcessedEMA(coinId, this.EMAStoreNum);

        await this.findTrends(coinId);

        this.cleanup(coinId);
    }

    async findTrends(coinId) {
        let resultsEMA = await this.mysqlCon.getProcessedEMA(coinId);

        if (resultsEMA.length < 4) {
            return;
        }

        let EMAArr = resultsEMA.map((el) => {
            return el.EMA;
        });

        let timestamp = resultsEMA[resultsEMA.length - 1]['timestamp'];

        console.log('EMA: ' + EMAArr.reverse().slice(0, 4));

        const ema_t1to3 = calculateGraphGradientsTrendsPerChange(
            EMAArr.reverse().slice(0, 4)
        );

        if (ema_t1to3) {
            this.mysqlCon.storeTrends(coinId, timestamp, ema_t1to3, 'EMA');
        }
    }
}

module.exports = EMACalculations;
