/*
BOLU=MA(TP,n)+m∗σ[TP,n]
BOLD=MA(TP,n)−m∗σ[TP,n]
where:
BOLU=Upper Bollinger Band
BOLD=Lower Bollinger Band
MA=Moving average
TP (typical price)=(High+Low+Close)÷3
n=Number of days in smoothing period (typically 21 from John Bollinger)
m=Number of standard deviations (typically 2)
σ[TP,n]=Standard Deviations over last n periods of TP
​
MA = TP / n. <-- Moving Average
Standard Deviation for scalping = 1.5-2

σ[TP,n]= 1-n ( sqrt(((xi - mean) * (xi - mean))) / 2
Mean = [1-n (xi) ] / n

Math.pow(parseFloat(temp[i])-mean),2);

Note: We need to keep BOLU, BOLD, *and* the MA(TP,n), which is the middle of the band. This is how we measure how close the

https://www.investopedia.com/terms/b/bollingerbands.asp
*/

const util = require("util");
class BollingerBandsCalculations {
    constructor(mysqlCon, storeNum, totalRecordsNum, unlockKey) {
        this.mysqlCon = mysqlCon;
        this.BollingerStoreNum = storeNum;
        this.totalRecordsNum = totalRecordsNum;
        this.unlockKey = unlockKey;
    }

    async cleanup(coinId) {
        /* Cleanup the processed RSI and limit */
        await this.mysqlCon.cleanupProcessedStochastic(
            coinId,
            this.totalRecordsNum
        );
        /* Unlock the coin for processing */
        this.unlockKey("Bollinger");
    }

    async calculate(coinId) {
        let resultsOHLC = await this.mysqlCon.getCoinOHLC(coinId);

        /* Could be 1.5 for scalping */
        let numOfSDs = 2;

        /* No acquired OHLC results yet */
        if (resultsOHLC.length === 0) return;

        /* 1. Iterate through 21 OHLC entries, and calculate the mean. */
        let totalOHLCResults = resultsOHLC.length;
        let startMeanIndex = totalOHLCResults - this.BollingerStoreNum;
        let meanIndex = 0;

        let mean = 0;
        resultsOHLC.forEach((el, index) => {
            if (meanIndex < startMeanIndex) {
                meanIndex++;
            } else {
                mean += Number(el["close"]);
            }
        });

        mean = mean / this.BollingerStoreNum;

        /* 2 Iterate through the 21 OHLC entries again, and calculate the MA and the total Standard Deviations */
        let startMAAndSDIndex = totalOHLCResults - this.BollingerStoreNum;
        let maAndSDIndex = 0;

        let MA = 0;
        let SD = 0;
        resultsOHLC.forEach((el, index) => {
            if (maAndSDIndex < startMAAndSDIndex) {
                maAndSDIndex++;
            } else {
                MA +=
                    (Number(el["low"]) +
                        Number(el["high"]) +
                        Number(el["close"])) /
                    3.0;

                SD += (Number(el["close"]) - mean) ** 2;
                // (sqrt(((xi - mean) * (xi - mean)))
            }
        });

        MA = MA / this.BollingerStoreNum;
        SD = Math.sqrt(SD / this.BollingerStoreNum);

        let lastElOHLC = resultsOHLC[resultsOHLC.length - 1];

        /* Eyeballed error from the graphs is 5-10 */
        let observedError;

        let currBollinger = {
            timestamp: lastElOHLC["timestamp"] - 60,
            close: Number(lastElOHLC["close"]),
            mean: mean,
            SD: SD,
            MA: MA,
            bolU: MA + numOfSDs * SD,
            bolD: MA - numOfSDs * SD,
            bolMA: MA,
        };

        /* Add this to mysql and then cleanup*/
        await this.mysqlCon.storeProcessedBollinger(coinId, currBollinger);
        await this.mysqlCon.cleanupProcessedBollinger(
            coinId,
            this.BollingerStoreNum
        );

        this.cleanup(coinId);
    }
}

module.exports = BollingerBandsCalculations;
