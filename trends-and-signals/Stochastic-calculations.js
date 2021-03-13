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

        /* Highest and lowest of last 14 periods */
        let totalOHLCResults = resultsOHLC.length;
        /* Note: We were hitting the current period as a part of the 14 prev. periods but this is incorrect. We use the innerLowHighIndex and the below index to skip the last one (our current period) */
        let startLowHighIndex = totalOHLCResults - this.StochasticStoreNum - 1;
        let lowHighIndex = 0;
        let innerLowHighIndex = 0;

        resultsOHLC.forEach((el) => {
            if (lowHighIndex < startLowHighIndex) {
                lowHighIndex++;
            } else {
                if (innerLowHighIndex < this.StochasticStoreNum)
                    if (Number(el["low"]) < lowestTraded) {
                        lowestTraded = Number(el["low"]);
                    }

                if (Number(el["high"]) > highestTraded) {
                    highestTraded = Number(el["high"]);
                }
                innerLowHighIndex++;
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
            dSlow: -1,
            kFull: -1,
            dFull: -1,
        };

        if (resultsStochastics.length >= 2) {
            /* Get the last three entries (including the current) and average them to get the slowD */
            currStochastic["dSlow"] =
                (Number(currStochastic["kFast"]) +
                    //(Number(resultsStochastics[stochasticsStartIndex]["k_fast"]) +
                    Number(
                        resultsStochastics[resultsStochastics.length - 2][
                            "k_fast"
                        ]
                    ) +
                    Number(
                        resultsStochastics[resultsStochastics.length - 1][
                            "k_fast"
                        ]
                    )) /
                3.0;
        }

        if (resultsStochastics.length > 3 + 3) {
            currStochastic["kFull"] = Number(currStochastic["kSlow"]);

            currStochastic["dFull"] =
                (Number(currStochastic["kFull"]) +
                    //(Number(resultsStochastics[stochasticsStartIndex]["k_fast"]) +
                    Number(
                        resultsStochastics[resultsStochastics.length - 2][
                            "k_slow"
                        ]
                    ) +
                    Number(
                        resultsStochastics[resultsStochastics.length - 1][
                            "k_slow"
                        ]
                    )) /
                3.0;
        }

        if (currStochastic["dSlow"] === NaN) {
            currStochastic["dSlow"] = -1;
        }

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
