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
        this.mysqlCon.getCoinOHLC(coinId, (resultsOHLC) => {
            /* No acquired OHLC results yet */

            let arrStochastic = Array();

            if (resultsOHLC.length === 0) return;

            let lowestTraded = 1000000000000;
            let highestTraded = 0;


            /* If we have three fastK's calculated, we can then calculate the slowD by averaging the last fastK's (divided by 3) */
            let stochasticResults = this.mysqlCon.getProcessedStochastic(coinId, (resultsStochastics) => {

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
                });

                /* Add this to mysql*/
                this.mysqlCon.storeProcessedStochastic(coinId, currStochastic, () => { });

                this.mysqlCon.cleanupProcessedStochastic(coinId);
            });
        });
    }

    firstRSICalculation(coinId) {
        this.mysqlCon.getCoinOHLC(coinId, (resultsOHLC) => {
            /* No acquired OHLC results yet */

            if (resultsOHLC.length === 0) return;

            let arrRSI = Array();
            let countOHLC = resultsOHLC.length;
            let offsetIndexOHLC = 0;
            let offsetInteriorIndexOHLC = 0;

            let aveLoss = 0;
            let aveGain = 0;

            resultsOHLC.forEach((el) => {
                if (offsetIndexOHLC + 1 > countOHLC - this.RSIStoreNum) {
                    arrRSI.push({
                        timestamp: el["timestamp"],
                        close: Number(el["close"]),
                        lossOrGain: 0,
                        aveGain: 0,
                        aveLoss: 0,
                        RS: 0,
                        RSI: 0,
                    });

                    // If we're at the correct last 15 elements, we don't calculate change for the first entry, but the next 13.
                    if (offsetInteriorIndexOHLC > 0) {
                        // Calculate the change for the first 14, and on the 15th, we calculate the
                        let prevElRSI = arrRSI[offsetInteriorIndexOHLC - 1];
                        let currElRSI = arrRSI[offsetInteriorIndexOHLC];
                        let lossOrGain = (arrRSI[offsetInteriorIndexOHLC][
                            "lossOrGain"
                        ] =
                            Number(currElRSI["close"]) -
                            Number(prevElRSI["close"]));

                        if (lossOrGain > 0) {
                            aveGain += lossOrGain;
                        } else if (lossOrGain < 0) {
                            /* Change is always negative here */
                            aveLoss += -lossOrGain;
                        }
                    }
                    /* 15th entry, so we calculate aveGain, aveLoss, RS, and RSI */
                    if (offsetInteriorIndexOHLC === 14) {
                        arrRSI[offsetInteriorIndexOHLC]["aveGain"] =
                            aveGain / 14.0;
                        arrRSI[offsetInteriorIndexOHLC]["aveLoss"] =
                            aveLoss / 14.0;

                        if (arrRSI[offsetInteriorIndexOHLC]["aveLoss"] === 0) {
                            arrRSI[offsetInteriorIndexOHLC]["RSI"] = 100;
                        } else if (
                            arrRSI[offsetInteriorIndexOHLC]["aveGain"] === 0
                        ) {
                            arrRSI[offsetInteriorIndexOHLC]["RSI"] = 0;
                        } else {
                            let RS = (arrRSI[offsetInteriorIndexOHLC]["RS"] =
                                aveGain / aveLoss);
                            arrRSI[offsetInteriorIndexOHLC]["RSI"] =
                                100 - 100 / (1 + RS);
                        }
                    }

                    offsetInteriorIndexOHLC++;
                }

                offsetIndexOHLC++;
            });

            /*console.log(
                util.inspect(arrRSI, { showHidden: false, depth: null })
            );*/

            arrRSI.forEach((el) => {
                this.mysqlCon.storeProcessedRSI(coinId, el, () => {});
            });
        });
    }

    secondRSICalculation(coinId, resultsRSI) {
        /* Find the 15th result, and there should always be 15 */
        if (resultsRSI.length != this.RSIStoreNum) return;
        let lastResult = resultsRSI[this.RSIStoreNum - 1];

        this.mysqlCon.getCoinOHLC(coinId, (resultsOHLC) => {
            /* No acquired OHLC results yet */

            console.log("WHAT??1");
            if (resultsOHLC.length === 0) return;

            let elLastOHLC = resultsOHLC[resultsOHLC.length - 1];
            let currRSI = {
                timestamp: elLastOHLC["timestamp"],
                close: Number(lastResult["close"]),
                lossOrGain: lastResult["close"] - elLastOHLC["close"],
                aveGain: 0,
                aveLoss: 0,
                RS: 0,
                RSI: 0,
            };

            // Average Gain = [(previous Average Gain) x 13 + current Gain] / 14.
            // Average Loss = [(previous Average Loss) x 13 + current Loss] / 14.

            let gain =
                currRSI["lossOrGain"] > 0 ? Number(currRSI["lossOrGain"]) : 0;
            let loss =
                currRSI["lossOrGain"] < 0 ? Number(-currRSI["lossOrGain"]) : 0;
            currRSI["aveGain"] =
                (Number(lastResult["ave_gain"]) * 13 + gain) / 14.0;
            currRSI["aveLoss"] =
                (Number(lastResult["ave_loss"]) * 13 + loss) / 14.0;

            /* If loss or gain are zero, we'll get NaN, so set this to 0 */
            if (currRSI["aveGain"] === NaN) {
                currRSI["aveGain"] = 0;
            } else if (currRSI["aveLoss"] === NaN) {
                currRSI["aveLoss"] = 0;
            }

            if (currRSI["aveLoss"] === 0) {
                currRSI["RSI"] = 100;
            } else if (currRSI["aveGain"] === 0) {
                currRSI["RSI"] = 0;
            } else {
                currRSI["RS"] = currRSI["aveGain"] / currRSI["aveLoss"];
                currRSI["RSI"] = 100 - 100 / (1 + currRSI["RS"]);
            }

            console.log("WHAT??2");
            console.log(elLastOHLC);
            console.log(lastResult);
            console.log(currRSI);

            this.mysqlCon.storeProcessedRSI(coinId, currRSI, () => {});
        });
    }
}

module.exports = RSICalculations;
