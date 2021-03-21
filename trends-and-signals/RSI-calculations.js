/* NOTE: Takes 15-20mins for RSI to be close to accurate, and 30mins for full accuracy.
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
const sleep = require("../utils/general.js").sleep;
const Decimal = require("decimal.js");

class RSICalculations {
    constructor(mysqlCon, storeNum, totalRecordsNum, unlockKey) {
        this.mysqlCon = mysqlCon;
        this.RSIStoreNum = storeNum;
        this.totalRecordsNum = totalRecordsNum;
        this.unlockKey = unlockKey;
        Decimal.set({ precision: 24 });
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
            await this.secondRSICalculation2(coinId);
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
        let offsetIndexOHLC = 0;

        let aveLoss = 0;
        let aveGain = 0;

        resultsOHLC.forEach((el) => {
            /* Fix this check and make it make more sense */
            if (offsetIndexOHLC < this.RSIStoreNum - 1) {
                arrRSI.push({
                    timestamp: el["timestamp"],
                    close: Number(el["close"]),
                    lossOrGain: 0,
                    aveGain: 0,
                    aveLoss: 0,
                    RS: 0,
                    RSI: 0,
                });

                if (offsetIndexOHLC > 0) {
                    // If we're at the correct first 14 elements, we don't calculate change for the first entry, but the next 13.
                    // Calculate the change for the first 14, and on the 15th, we calculate the aveLoss and aveGain
                    let prevElRSIClose = new Decimal(
                        arrRSI[offsetIndexOHLC - 1]["close"]
                    );
                    let currElRSIClose = new Decimal(
                        arrRSI[offsetIndexOHLC]["close"]
                    );
                    arrRSI[offsetIndexOHLC][
                        "lossOrGain"
                    ] = currElRSIClose.minus(prevElRSIClose);
                    let lossOrGain = arrRSI[offsetIndexOHLC]["lossOrGain"];

                    if (lossOrGain > 0) {
                        aveGain = new Decimal(aveGain).plus(lossOrGain);
                    } else if (lossOrGain < 0) {
                        aveLoss = new Decimal(aveLoss).plus(-lossOrGain);
                    }

                    /* 14th entry, so we calculate aveGain, aveLoss, RS, and RSI */
                    if (offsetIndexOHLC === this.RSIStoreNum - 2) {
                        arrRSI[offsetIndexOHLC]["aveGain"] = new Decimal(
                            aveGain
                        ).dividedBy(14.0);
                        arrRSI[offsetIndexOHLC]["aveLoss"] = new Decimal(
                            aveLoss
                        ).dividedBy(14.0);

                        if (arrRSI[offsetIndexOHLC]["aveLoss"] === 0) {
                            arrRSI[offsetIndexOHLC]["RSI"] = new Decimal(100);
                        } else if (arrRSI[offsetIndexOHLC]["aveGain"] === 0) {
                            arrRSI[offsetIndexOHLC]["RSI"] = new Decimal(0);
                        } else {
                            arrRSI[offsetIndexOHLC]["RS"] = new Decimal(
                                aveGain
                            ).dividedBy(aveLoss);
                            let RS = arrRSI[offsetIndexOHLC]["RS"];
                            arrRSI[offsetIndexOHLC]["RSI"] = new Decimal(
                                100
                            ).minus(new Decimal(100).dividedBy(RS.plus(1)));
                        }
                    } /*else {
                        if (lossOrGain > 0) {
                            aveGain = new Decimal(aveGain).plus(lossOrGain);
                        } else if (lossOrGain < 0) {
                            aveLoss = new Decimal(aveLoss).plus(-lossOrGain);
                        }
                    }*/
                }
            }

            offsetIndexOHLC++;
        });

        /*console.log(
                util.inspect(arrRSI, { showHidden: false, depth: null })
            );*/

        arrRSI.forEach(async (el) => {
            await this.mysqlCon.storeProcessedRSI(coinId, el);
        });

        /* Need this delay, otherwise sometimes the first calculation is skipped, possibly due to the previous store operation */
        sleep(500).then(async () => {
            /* Now we do the secondary calculations so we have a more complete dataset when the coin bot starts */
            for (
                var remainderIndexOHLC = this.RSIStoreNum - 1;
                remainderIndexOHLC < resultsOHLC.length;
                remainderIndexOHLC++
            ) {
                await this.secondGenericCalculation(
                    coinId,
                    remainderIndexOHLC,
                    resultsOHLC
                );
            }
        });
    }

    async secondRSICalculation2(coinId) {
        /* Find the 15th result, and there should always be 15 */
        /* Note: This has changed - we want this to expand out to 32. */

        let resultsOHLC = await this.mysqlCon.getCoinOHLC(coinId);
        /* No acquired OHLC results yet */

        if (resultsOHLC.length === 0) return;

        await this.secondGenericCalculation(
            coinId,
            resultsOHLC.length - 1,
            resultsOHLC
        );
    }

    async secondGenericCalculation(coinId, currIndex, resultsOHLC) {
        /* Need this promise because the access and then storage needs to
        occur sequentially in the first calculation (multiple second calculations) */
        return new Promise(async (resolve, reject) => {
            let resultsRSI = await this.mysqlCon.getProcessedRSI(coinId);
            //if (resultsRSI.length < 14) return;

            let lastResult = resultsRSI[resultsRSI.length - 1];
            let elLastOHLC = resultsOHLC[currIndex];

            if (
                Number(lastResult["timestamp"]) + 60 !==
                Number(elLastOHLC["timestamp"])
            ) {
                console.log("DISCREPANCY1");

                console.log(lastResult);
                console.log(elLastOHLC);
                console.log(coinId);
                console.log(currIndex);
                console.log(elLastOHLC["close"] - lastResult["close"]);
            }

            let currRSI = {
                timestamp: elLastOHLC["timestamp"],
                close: Number(elLastOHLC["close"]),
                lossOrGain: new Decimal(elLastOHLC["close"]).minus(
                    lastResult["close"]
                ),
                aveGain: 0,
                aveLoss: 0,
                RS: 0,
                RSI: 0,
            };

            // Average Gain = [(previous Average Gain) x 13 + current Gain] / 14.
            // Average Loss = [(previous Average Loss) x 13 + current Loss] / 14.

            let gain =
                currRSI["lossOrGain"] > 0
                    ? new Decimal(currRSI["lossOrGain"])
                    : 0;
            let loss =
                currRSI["lossOrGain"] < 0
                    ? new Decimal(-currRSI["lossOrGain"])
                    : 0;

            currRSI["aveGain"] = new Decimal(lastResult["ave_gain"])
                .times(13)
                .plus(gain)
                .dividedBy(14.0);
            currRSI["aveLoss"] = new Decimal(lastResult["ave_loss"])
                .times(13)
                .plus(loss)
                .dividedBy(14.0);

            /* NOT NEEDED */
            /* If loss or gain are zero, we'll get NaN, so set this to 0 */
            /*if (currRSI["aveGain"] === NaN) {
                currRSI["aveGain"] = 0;
            } else if (currRSI["aveLoss"] === NaN) {
                currRSI["aveLoss"] = 0;
            }*/

            if (currRSI["aveLoss"] === 0) {
                currRSI["RSI"] = new Decimal(100);
            } else if (currRSI["aveGain"] === 0) {
                currRSI["RSI"] = new Decimal(0);
            } else {
                currRSI["RS"] = new Decimal(currRSI["aveGain"]).dividedBy(
                    currRSI["aveLoss"]
                );
                let RS = currRSI["RS"];
                currRSI["RSI"] = new Decimal(100).minus(
                    new Decimal(100).dividedBy(RS.plus(1))
                );
            }

            await this.mysqlCon.storeProcessedRSI(coinId, currRSI);
            resolve();
        });
    }
}

module.exports = RSICalculations;
