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

Result should be locked between 0 and 100.
*/

class RSICalculations {
    constructor(mysqlCon, storeNum) {
        this.mysqlCon = mysqlCon;
        this.RSIStoreNum = storeNum;
    }

    calculate(coinId) {
        /* We have the first time RSI calculation, and then we can calculate the latest one off the old RSI? */
        /*
        1. First we grab all the OHLC data for the coinId
        2. Then we take the close prices of each OHLC.
        3. For the first run through (or if the bot crashes), we average out the last 14 entries (but we don't start at the latest minute, as we'll be using those 4 values to calculate this minutes RSI), calculating gain and loss as the close price either goes down or up.
        4. Then we go back over these values and calculate the average gain and loss for those 14 time periods.
        5. From that we calculate the RS = Ave. Gain / Ave. Loss
        6. Then the RSI.

        7. Now, if we already have the Ave. Gain and Ave. Loss from our first RSI value (the prev timestamp), then we use the second calculation and calculate the current gain or loss for the latest time period.
        */

        this.mysqlCon.getCoinOHLC(coinId, (results) => {
            /* No acquired OHLC results yet */

            if (results.length === 0) return;

            let arrRSI = Array();
            let countOHLC = results.length;
            let offsetIndexOHLC = 0;
            let offsetInteriorIndexOHLC = 0;

            let aveLoss = 0;
            let aveGain = 0;

            results.forEach((el) => {
                if (offsetIndexOHLC > countOHLC - this.RSIStoreNum) {
                    arrRSI.push({
                        timestamp: el["timestamp"],
                        close: el["close"],
                        change: 0,
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
                        let change = (arrRSI[offsetInteriorIndexOHLC][
                            "change"
                        ] = currElRSI["close"] - prevElRSI["close"]);

                        if (change > 0) {
                            aveGain += change;
                        } else if (change < 0) {
                            /* Change is always negative here */
                            aveLoss += -change;
                        }

                        offsetInteriorIndexOHLC++;
                    }
                    /* 15th entry */
                    if (offsetInteriorIndexOHLC === 14) {
                        arrRSI[offsetInteriorIndexOHLC]["aveGain"] =
                            aveGain / 14;
                        arrRSI[offsetInteriorIndexOHLC]["aveLoss"] =
                            aveLoss / 14;
                        let RS = (arrRSI[offsetInteriorIndexOHLC]["RS"] =
                            aveGain / aveLoss);
                        arrRSI[offsetInteriorIndexOHLC]["RSI"] =
                            100 - 100 / (1 + RS);
                    }
                }

                offsetIndexOHLC++;
            });

            console.log("RSI Arr: " + arrRSI);
        });
    }
}

module.exports = RSICalculations;
