/*
                  100
    RSI = 100 - --------
                 1 + RS

    RS = Average Gain / Average Loss

The very first calculations for average gain and average loss are simple 14-period averages:

First Average Gain = Sum of Gains over the past 14 periods / 14.
First Average Loss = Sum of Losses over the past 14 periods / 14
The second, and subsequent, calculations are based on the prior averages and the current gain loss:

Average Gain = [(previous Average Gain) x 13 + current Gain] / 14.
Average Loss = [(previous Average Loss) x 13 + current Loss] / 14.

100-100/2

Result should be locked between 0 and 100.

66.66 <-- overbought
33.33 <-- oversold
https://tradingsim.com/blog/relative-strength-index/
*/

const util = require("util");

class RSICalculations {
    constructor(mysqlCon, storeNum, totalRecordsNum, unlockKey) {
        this.mysqlCon = mysqlCon;
        this.RSIStoreNum = storeNum;
        this.totalRecordsNum = totalRecordsNum;
        this.unlockKey = unlockKey;
    }

    /*
        RSI Calculation steps:
        1. First we grab all the OHLC data for the coinId
        2. Then we take the close prices of each OHLC.
        3. For the first run through (or if the bot crashes), we average out the last 14 entries (but we don't start at the latest minute, as we'll be using those 4 values to calculate this minutes RSI), calculating gain and loss as the close price either goes down or up.
        4. Then we go back over these values and calculate the average gain and loss for those 14 time periods.
        5. From that we calculate the RS = Ave. Gain / Ave. Loss
        6. Then the RSI.

        7. Now, if we already have the Ave. Gain and Ave. Loss from our first RSI value (the prev timestamp), then we use the second calculation and calculate the current gain or loss for the latest time period.
        */
    async calculate(coinId) {
        let resultsRSI = await this.mysqlCon.getProcessedRSI(coinId);
        if (resultsRSI.length === 0) {
            //console.log("RSI FIRST: " + coinId);
            await this.firstRSICalculation(coinId);
        } else {
            //console.log("RSI SECOND: " + coinId);
            await this.secondRSICalculation(coinId, resultsRSI);
        }

        this.cleanup(coinId);
    }

    async cleanup(coinId) {
        /* Cleanup the processed RSI and limit */
        await this.mysqlCon.cleanupProcessedRSI(coinId, this.totalRecordsNum);
        /* Unlock the coin for processing */
        this.unlockKey("RSI");
    }

    async firstRSICalculation(coinId) {
        let resultsOHLC = await this.mysqlCon.getCoinOHLC(coinId);

        /* No acquired OHLC results yet */
        if (resultsOHLC.length === 0) return;

        let arrRSI = Array();
        let countOHLC = resultsOHLC.length;
        let offsetIndexOHLC = 0;
        let offsetInteriorIndexOHLC = 0;

        let aveLoss = 0;
        let aveGain = 0;

        resultsOHLC.forEach((el) => {
            if (offsetIndexOHLC + 1 > Math.abs(countOHLC - this.RSIStoreNum)) {
                arrRSI.push({
                    timestamp: el["timestamp"] - 60,
                    close: Number(el["close"]),
                    lossOrGain: 0,
                    aveGain: 0,
                    aveLoss: 0,
                    RS: 0,
                    RSI: 0,
                });

                // If we're at the correct last 14 elements, we don't calculate change for the first entry, but the next 13.
                if (offsetInteriorIndexOHLC > 0) {
                    // Calculate the change for the first 14, and on the 15th, we calculate the
                    let prevElRSI = arrRSI[offsetInteriorIndexOHLC - 1];
                    let currElRSI = arrRSI[offsetInteriorIndexOHLC];
                    arrRSI[offsetInteriorIndexOHLC]["lossOrGain"] =
                        Number(currElRSI["close"]) - Number(prevElRSI["close"]);
                    let lossOrGain =
                        arrRSI[offsetInteriorIndexOHLC]["lossOrGain"];

                    /* 15th entry, so we calculate aveGain, aveLoss, RS, and RSI */
                    if (offsetInteriorIndexOHLC === this.RSIStoreNum - 1) {
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
                            arrRSI[offsetInteriorIndexOHLC]["RS"] =
                                aveGain / aveLoss;
                            let RS = arrRSI[offsetInteriorIndexOHLC]["RS"];
                            arrRSI[offsetInteriorIndexOHLC]["RSI"] =
                                100 - 100 / (1 + RS);
                        }
                    } else {
                        if (lossOrGain > 0) {
                            aveGain += lossOrGain;
                        } else if (lossOrGain < 0) {
                            /* Change is always negative here */
                            aveLoss += -lossOrGain;
                        }
                    }
                }

                offsetInteriorIndexOHLC++;
            }

            offsetIndexOHLC++;
        });

        /*console.log(
                util.inspect(arrRSI, { showHidden: false, depth: null })
            );*/

        arrRSI.forEach(async (el) => {
            await this.mysqlCon.storeProcessedRSI(coinId, el);
        });
    }

    async secondRSICalculation(coinId, resultsRSI) {
        /* Find the 15th result, and there should always be 15 */
        /* Note: This has changed - we want this to expand out to 32. */
        if (resultsRSI.length < 15) return;
        let lastResult = resultsRSI[resultsRSI.length - 1];

        let resultsOHLC = await this.mysqlCon.getCoinOHLC(coinId);
        /* No acquired OHLC results yet */

        if (resultsOHLC.length === 0) resolve();

        let elLastOHLC = resultsOHLC[resultsOHLC.length - 1];
        let currRSI = {
            timestamp: elLastOHLC["timestamp"] - 60,
            close: Number(elLastOHLC["close"]),
            lossOrGain: elLastOHLC["close"] - lastResult["close"],
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

        await this.mysqlCon.storeProcessedRSI(coinId, currRSI);
    }
}

module.exports = RSICalculations;
