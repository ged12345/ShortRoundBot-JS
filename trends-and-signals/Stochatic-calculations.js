//www.investopedia.com/terms/s/stochasticoscillator.asp

/*
The Formula for the Stochastic Oscillator is:
%K= (C−L14)
    --------
    (H14−L14)

​	 )×100
where:
C = The most recent closing price
L14 = The lowest price traded of the 14 previous
trading sessions
H14 = The highest price traded during the same
14-day period
%K = The current value of the stochastic indicator
*/
​

https: const util = require("util");

class StochasticCalculations {
    constructor(mysqlCon, storeNum) {
        this.mysqlCon = mysqlCon;
        this.StochasticStoreNum = storeNum;
    }

    calculate(coinId) {
        let resultsOHLC = await this.mysqlCon.getCoinOHLC(coinId);
        /* No acquired OHLC results yet */

        let arrStochastic = Array();

        if (resultsOHLC.length === 0) return;

        let lowestTraded = 1000000000000;
        let highestTraded = 0;

        /* If we have three fastK's calculated, we can then calculate the slowD by averaging the last fastK's (divided by 3) */
        let resultsStochastics = await this.mysqlCon.getProcessedStochastic(coinId);

        let slowD = -1;
        if (resultsStochastics.length >= 3)
        {
            /* Get the last three entries and average them to get the slowD */
            let stoachasticsStartIndex = resultsStochastics.length - 3;
            slowD = (resultsStochastics[stoachasticsStartIndex] + resultsStochastics[stoachasticsStartIndex + 1] + resultsStochastics[stoachasticsStartIndex + 2]) / 3;
        }

            /* Highest and lowest of last 14 periods */
        resultsOHLC.forEach((el) => {
            if (lowestTraded > el["low"]) {
                lowestTraded = Number(el["low"]);
            }

            if (highestTraded < el["high"]) {
                highestTraded = Number(el["high"]);
            }
        });

        let lastElOHLC = resultsOHLC[resultsOHLC.length - 1];
        let currStochastic = {
            timestamp: lastElOHLC["timestamp"],
            close: Number(lastElOHLC["close"]),
            fastK: ((Number(lastElOHLC["close"]) - lowestTraded)/(highestTraded - lowestTraded)) * 100,
            slowD: slowD
        }

        /* Add this to mysql and then cleanup*/
        await this.mysqlCon.storeProcessedStochastic(coinId, currStochastic);
        await this.mysqlCon.cleanupProcessedStochastic(coinId);
    }
}

module.exports = StochasticCalculations;
