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

80 - overbought
20 - oversold
*/
const util = require("util");

class StochasticCalculations {
    constructor(mysqlCon, storeNum, totalRecordsNum, unlockKey) {
        this.mysqlCon = mysqlCon;
        this.StochasticStoreNum = storeNum;
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
        this.unlockKey("Stochastic");
    }

    async calculate(coinId) {
        let resultsOHLC = await this.mysqlCon.getCoinOHLC(coinId);
        let arrStochastic = Array();

        /* No acquired OHLC results yet */
        if (resultsOHLC.length === 0) return;

        let lowestTraded = 1000000000000;
        let highestTraded = 0;

        /* If we have three fastK's calculated, we can then calculate the slowD by averaging the last fastK's (divided by 3) */
        let resultsStochastics = await this.mysqlCon.getProcessedStochastic(
            coinId
        );

        let dSlow = -1;
        if (resultsStochastics.length >= 3) {
            /* Get the last three entries and average them to get the slowD */
            let stochasticsStartIndex = resultsStochastics.length - 3;

            dSlow =
                (Number(resultsStochastics[stochasticsStartIndex]["k_fast"]) +
                    Number(
                        resultsStochastics[stochasticsStartIndex + 1]["k_fast"]
                    ) +
                    Number(
                        resultsStochastics[stochasticsStartIndex + 2]["k_fast"]
                    )) /
                3.0;
        }

        if (dSlow === NaN) {
            dSlow = -1;
        }

        /* Highest and lowest of last 14 periods */
        let totalOHLCResults = resultsOHLC.length;
        let startLowHighIndex = totalOHLCResults - this.StochasticStoreNum;
        let lowHighIndex = 0;

        resultsOHLC.forEach((el) => {
            if (lowHighIndex < startLowHighIndex) {
                lowHighIndex++;
            } else {
                if (Number(el["low"]) < lowestTraded) {
                    lowestTraded = Number(el["low"]);
                }

                if (Number(el["high"]) > highestTraded) {
                    highestTraded = Number(el["high"]);
                }
            }
        });

        let lastElOHLC = resultsOHLC[resultsOHLC.length - 1];
        let currStochastic = {
            timestamp: lastElOHLC["timestamp"],
            close: Number(lastElOHLC["close"]),
            kFast:
                ((Number(lastElOHLC["close"]) - lowestTraded) /
                    (highestTraded - lowestTraded)) *
                100,
            dSlow: dSlow,
        };

        console.log(currStochastic);

        /* Add this to mysql and then cleanup*/
        await this.mysqlCon.storeProcessedStochastic(coinId, currStochastic);
        await this.mysqlCon.cleanupProcessedStochastic(
            coinId,
            this.StochasticStoreNum
        );

        this.cleanup(coinId);
    }
}

module.exports = StochasticCalculations;
