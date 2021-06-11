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

Full stoch
kFull = dSlow
dFull = kFull for the past n periods / n (n=3 here, since our original for dSlow was 3)
*/
const util = require('util');
const Decimal = require('decimal.js');
const { calculateGraphGradientsTrendsPerChange } = require('../utils/math.js');

class MACDCalculations {
    constructor(mysqlCon, storeNum, totalRecordsNum, unlockKey) {
        this.mysqlCon = mysqlCon;
        this.MACDStoreNum = storeNum;
        this.totalRecordsNum = totalRecordsNum;
        this.unlockKey = unlockKey;
        Decimal.set({ precision: 24 });
    }

    async cleanup(coinId) {
        /* Cleanup the processed RSI and limit */
        await this.mysqlCon.cleanupProcessedMACD(coinId, this.totalRecordsNum);
        /* Unlock the coin for processing */
        this.unlockKey('MACD');
    }

    async calculate(coinId) {
        let resultsOHLC = await this.mysqlCon.getCoinOHLC(coinId);
        let arrMACD = Array();

        /* No acquired OHLC results yet */
        if (resultsOHLC.length === 0) return;

        let lowestTraded = 1000000000000;
        let highestTraded = 0;

        /* If we have three fastK's calculated, we can then calculate the slowD by averaging the last fastK's (divided by 3) */
        let resultsMACDs = await this.mysqlCon.getProcessedMACD(coinId);

        /* Highest and lowest of last 14 periods */
        let totalOHLCResults = resultsOHLC.length;
        /* Note: We were hitting the current period as a part of the 14 prev. periods but this is incorrect. We use the innerLowHighIndex and DON'T skip the last one (our current period) */
        let startLowHighIndex = totalOHLCResults - this.MACDStoreNum;
        let lowHighIndex = 0;
        let innerLowHighIndex = 0;

        resultsOHLC.forEach((el, index) => {
            //console.log("Real index: " + index);
            if (lowHighIndex < startLowHighIndex) {
                //console.log("lowHighIndex: " + lowHighIndex);
                lowHighIndex++;
            } else {
                if (innerLowHighIndex < this.MACDStoreNum) {
                    //console.log("Current Low: " + Number(el["low"]));
                    if (Number(el['low']) < lowestTraded) {
                        //    console.log("Old Low: " + lowestTraded);
                        lowestTraded = Number(el['low']);
                    }

                    //console.log("Current High: " + Number(el["high"]));
                    if (Number(el['high']) > highestTraded) {
                        //    console.log("Old High: " + highestTraded);
                        highestTraded = Number(el['high']);
                    }
                }
                innerLowHighIndex++;
            }
        });

        let lastElOHLC = resultsOHLC[resultsOHLC.length - 1];
        let currMACD = {
            timestamp: Number(lastElOHLC['timestamp']),
            close: Number(lastElOHLC['close']),
            high: highestTraded,
            low: lowestTraded,
            kFast: new Decimal(Number(lastElOHLC['close']))
                .minus(lowestTraded)
                .dividedBy(new Decimal(highestTraded).minus(lowestTraded))
                .times(100),
            dSlow: -1,
            kFull: -1,
            dFull: -1,
        };

        if (currMACD['kFast'] < 0) {
            currMACD['kFast'] = 0;
        } else if (currMACD['kFast'] > 100) {
            currMACD['kFast'] = 100;
        }

        if (resultsMACDs.length > 2) {
            /* Get the last three entries (including the current) and average them to get the slowD */
            currMACD['dSlow'] = new Decimal(currMACD['kFast'])
                .plus(Number(resultsMACDs[resultsMACDs.length - 2]['k_fast']))
                .plus(Number(resultsMACDs[resultsMACDs.length - 1]['k_fast']))
                .dividedBy(3.0);
        }

        if (resultsMACDs.length > 5) {
            currMACD['kFull'] = Number(currMACD['dSlow']);

            currMACD['dFull'] = new Decimal(currMACD['kFull'])
                .plus(Number(resultsMACDs[resultsMACDs.length - 2]['d_slow']))
                .plus(Number(resultsMACDs[resultsMACDs.length - 1]['d_slow']))
                .dividedBy(3.0);
        }

        /* Add this to mysql and then cleanup*/
        await this.mysqlCon.storeProcessedMACD(coinId, currMACD);

        this.cleanup(coinId);
    }

    async findTrends(coinId) {
        let resultsMACDs = await this.mysqlCon.getProcessedMACD(coinId);

        /* We check for -1, because thats' the default for Stoch for 4-5 turns */
        if (
            resultsMACDs.length < 4 /* &&
            Number(resultsMACDs[resultsMACDs.length - 1 - 4]) === Number(-1.0)*/
        ) {
            return;
        }

        let MACDArr = resultsMACDs.map((el) => {
            /* We need the faster metric, but we can change to d_full if we have to */
            return el.k_full;
        });

        let timestamp = resultsMACDs[resultsMACDs.length - 1]['timestamp'];

        console.log('MACD: ' + MACDArr.reverse().slice(0, 4));

        const macd_t1to3 = calculateGraphGradientsTrendsPerChange(
            MACDArr.reverse().slice(0, 4)
        );

        this.mysqlCon.storeTrends(coinId, timestamp, macd_t1to3, 'Stoch');
    }
}

module.exports = MACDCalculations;
