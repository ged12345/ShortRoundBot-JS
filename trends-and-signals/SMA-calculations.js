/*

*/

const util = require("util");
const { calculateGraphGradients } = require("../utils/math.js");
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
            await this.secondSMACalculation(coinId);
        }

        this.cleanup(coinId);
    }

    async firstSMACalculation(coinId) {
        let resultsOHLC = await this.mysqlCon.getCoinOHLC(coinId);

        /* No acquired OHLC results yet */
        if (resultsOHLC.length === 0) return;

        /* 1. Iterate through 32 OHLC entries, and calculate the SMA. */
        let totalOHLCResults = resultsOHLC.length;

        let totalClose = 0;
        /* Everything but the last value. We calculate the SMA first but calculate the EMA of the last OHLC value (the SMA being the EMA for yesterday) */

        resultsOHLC.forEach((el, index) => {
            if (index < this.totalRecordsNum - 1) {
                totalClose += Number(el["close"]);
            }
        });

        let lastElOHLC = resultsOHLC[resultsOHLC.length - 1];
        let close = Number(lastElOHLC["close"]);

        let SMA = totalClose / this.SMAStoreNum;
        //let multiplier = 2 / (this.SMAStoreNum + 1);
        //let EMA = close * multiplier + SMA * (1 - multiplier);

        let currSMA = {
            timestamp: lastElOHLC["timestamp"],
            close: close,
            SMA: SMA,
            EMA: 0,
            trend: "NULL",
            trend_weighting:
                "NULL" /* Like a momentum indicator - how long have we been trending for? */,
        };

        /* Add this to mysql and then cleanup*/
        await this.mysqlCon.storeProcessedSMA(coinId, currSMA);
        this.cleanup(coinId);
    }

    async secondSMACalculation(coinId) {
        let resultsOHLC = await this.mysqlCon.getCoinOHLC(coinId);

        /* No acquired OHLC results yet */
        if (resultsOHLC.length === 0) return;

        let resultsSMA = await this.mysqlCon.getProcessedSMA(coinId);

        if (resultsSMA.length === 0) return;

        /* 1. Iterate through 32 OHLC entries, and calculate the SMA. */ let totalClose = 0;
        /* Everything but the last value. We calculate the SMA first but calculate the EMA of the last OHLC value (the SMA being the EMA for yesterday) */

        resultsOHLC.forEach((el, index) => {
            if (index < this.totalRecordsNum) {
                totalClose += Number(el["close"]);
            }
        });

        let lastElOHLC = resultsOHLC[resultsOHLC.length - 1];
        let prevElSMA = resultsSMA[resultsSMA.length - 1];
        let close = Number(lastElOHLC["close"]);
        let SMA = totalClose / this.SMAStoreNum;

        let multiplier = 2 / (this.SMAStoreNum + 1);
        let EMA = 0;

        if (resultsSMA.length === 1) {
            EMA = close * multiplier + prevElSMA["SMA"] * (1 - multiplier);
        } else {
            EMA = close * multiplier + prevElSMA["EMA"] * (1 - multiplier);
        }

        let arrEMA = resultsSMA.map((el) => {
            return el["EMA"];
        });
        arrEMA.push(EMA);

        /* We calculate the trend and trend weighting here */
        let trend = "NULL";
        let trendArr = [];
        if (resultsSMA.length > 1) {
            trendArr = calculateGraphGradients(arrEMA);
            trend = trendArr[0][trendArr[0].length - 1];
        }

        let currSMA = {
            timestamp: lastElOHLC["timestamp"],
            close: close,
            SMA: SMA,
            EMA: EMA,
            trend: trend,
            trend_weighting:
                "NULL" /* Like a momentum indicator - how long have we been trending for? */,
        };

        // We need at least three EMAS to calculate the trend/grade

        /* Here we look back and see if a similar trend has occurred and for how long, then we calculate the weighting (1 + N periods/10, which we can use to multiply probability of trend/buy?) */

        /* Add this to mysql and then cleanup*/
        await this.mysqlCon.storeProcessedSMA(coinId, currSMA);
        await this.mysqlCon.cleanupProcessedSMA(coinId, this.SMAStoreNum);

        this.cleanup(coinId);
    }
}

module.exports = SMACalculations;
