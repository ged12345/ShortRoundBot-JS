/*

*/

const util = require("util");
class SMACalculations {
    constructor(mysqlCon, storeNum, totalRecordsNum, unlockKey) {
        this.mysqlCon = mysqlCon;
        this.SMAStoreNum = storeNum;
        this.totalRecordsNum = totalRecordsNum;
        this.unlockKey = unlockKey;
    }

    async cleanup(coinId) {
        /* Cleanup the processed RSI and limit */
        await this.mysqlCon.cleanupProcessedSMA(coinId, this.totalRecordsNum);
        /* Unlock the coin for processing */
        this.unlockKey("SMA");
    }

    async calculate(coinId) {
        let resultsSMA = await this.mysqlCon.getProcessedSMA(coinId);
        if (resultsSMA.length === 0) {
            //console.log("SMA FIRST: " + coinId);
            await this.firstSMACalculation(coinId);
        } else {
            //console.log("SMA SECOND: " + coinId);
            await this.secondSMACalculation2(coinId);
        }

        this.cleanup(coinId);
    }

    async firstSMACalculation(coinId) {
        let resultsOHLC = await this.mysqlCon.getCoinOHLC(coinId);

        /* No acquired OHLC results yet */
        if (resultsOHLC.length === 0) return;

        /* 1. Iterate through 232 OHLC entries, and calculate the SMA. */
        let totalOHLCResults = resultsOHLC.length;

        let totalClose = 0;
        /* Everything but the last value. We calculate the SMA first but calculate the EMA of the last OHLC value (the SMA being the EMA for yesterday) */

        resultsOHLC.forEach((el, index) => {
            if (index != this.totalRecordsNum - 2) {
                totalClose += el["close"];
            }
        });

        let lastElOHLC = resultsOHLC[resultsOHLC.length - 1];
        let close = Number(lastElOHLC["close"]);

        let SMA = totalClose / this.SMAStoreNum;
        let multiplier = 2 / (this.SMAStoreNum + 1);
        let EMA = close * multiplier + SMA * (1 - multipler);

        let currSMA = {
            timestamp: lastElOHLC["timestamp"],
            close: close,
            SMA: SMA,
            EMA: EMA,
            trend: null,
            trend_weighting: null /* Like a momentum indicator - how long have we been trending for? */,
        };

        /* Add this to mysql and then cleanup*/
        await this.mysqlCon.storeProcessedSMA(coinId, currSMA);

        this.cleanup(coinId);
    }

    async firstSMACalculation(coinId) {
        let resultsOHLC = await this.mysqlCon.getCoinOHLC(coinId);

        /* No acquired OHLC results yet */
        if (resultsOHLC.length === 0) return;

        /* 1. Iterate through 232 OHLC entries, and calculate the SMA. */
        let totalOHLCResults = resultsOHLC.length;

        let totalClose = 0;
        /* Everything but the last value. We calculate the SMA first but calculate the EMA of the last OHLC value (the SMA being the EMA for yesterday) */

        resultsOHLC.forEach((el, index) => {
            if (index != this.totalRecordsNum - 2) {
                totalClose += el["close"];
            }
        });

        let lastElOHLC = resultsOHLC[resultsOHLC.length - 1];
        let close = Number(lastElOHLC["close"]);

        let SMA = totalClose / this.SMAStoreNum;
        let multiplier = 2 / (this.SMAStoreNum + 1);
        let EMA = close * multiplier + SMA * (1 - multipler);

        let currSMA = {
            timestamp: lastElOHLC["timestamp"],
            close: close,
            SMA: SMA,
            EMA: EMA,
            trend: null,
            trend_weighting: null /* Like a momentum indicator - how long have we been trending for? */,
        };

        /* Add this to mysql and then cleanup*/
        await this.mysqlCon.storeProcessedSMA(coinId, currSMA);
        await this.mysqlCon.cleanupProcessedSMA(coinId, this.SMAStoreNum);

        this.cleanup(coinId);
    }
}

module.exports = BollingerBandsCalculations;
