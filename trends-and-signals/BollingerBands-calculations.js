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
σ[TP,n]=Standard Deviation over last n periods of TP
​
MA = TP / n. <-- Moving Average
Standard Deviation for scalping = 1.5-2

σ[TP,n]= 1-n ( sqrt(((xi - mean) * (xi - mean)))
Mean = [1-n (xi) ] / n

Math.pow(parseFloat(temp[i])-mean),2);

Note: We need to keep BOLU, BOLD, *and* the MA(TP,n), which is the middle of the band. This is how we measure how close the

https://www.investopedia.com/terms/b/bollingerbands.asp
*/

const util = require("util");
class BollingerBandsCalculations {
    constructor(mysqlCon, storeNum, unlockKey) {
        this.mysqlCon = mysqlCon;
        this.BollingerStoreNum = storeNum;
        this.unlockKey = unlockKey;
    }

    async cleanup(coinId) {
        /* Cleanup the processed RSI and limit */
        await this.mysqlCon.cleanupProcessedStochastic(
            coinId,
            this.BollingerStoreNum
        );
        /* Unlock the coin for processing */
        this.unlockKey("Bollinger");
    }

    async calculate(coinId) {
        let resultsOHLC = await this.mysqlCon.getCoinOHLC(coinId);
        let arrBollinger = Array();

        /* No acquired OHLC results yet */
        if (resultsOHLC.length === 0) return;

        /* Add this to mysql and then cleanup*/
        await this.mysqlCon.storeProcessedBollinger(coinId, currBollinger);
        await this.mysqlCon.cleanupProcessedBollinger(
            coinId,
            this.BollingerStoreNum
        );

        this.cleanup(coinId);
    }
}

module.exports = StochasticCalculations;
