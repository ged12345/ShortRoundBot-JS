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

const util = require('util');
const { calculateGraphGradientsTrendsPerChange } = require('../utils/math.js');
class BollingerBandsCalculations {
    constructor(mysqlCon, storeNum, totalRecordsNum, unlockKey) {
        this.mysqlCon = mysqlCon;
        this.BollingerStoreNum = storeNum;
        this.totalRecordsNum = totalRecordsNum;
        this.unlockKey = unlockKey;
    }

    async cleanup(coinId) {
        /* Cleanup the processed Bollinger and limit */
        await this.mysqlCon.cleanupProcessedBollinger(
            coinId,
            this.totalRecordsNum
        );
        /* Unlock the coin for processing */
        this.unlockKey('Bollinger');
    }

    async calculate(coinId) {
        let resultsOHLC = await this.mysqlCon.getCoinOHLC(coinId);
        let resultsHistoricBoll = await this.mysqlCon.getHistoricBollinger(
            coinId
        );

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
                mean += Number(el['close']);
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
                    (Number(el['low']) +
                        Number(el['high']) +
                        Number(el['close'])) /
                    3.0;

                SD += (Number(el['close']) - mean) ** 2;
                // (sqrt(((xi - mean) * (xi - mean)))
            }
        });

        MA = MA / this.BollingerStoreNum;
        SD = Math.sqrt(SD / this.BollingerStoreNum);

        let lastElOHLC = resultsOHLC[resultsOHLC.length - 1];

        let close = Number(lastElOHLC['close']);

        let currBollinger = {
            timestamp: lastElOHLC['timestamp'],
            close: close,
            mean: mean,
            SD: SD,
            bolU: MA + numOfSDs * SD,
            bolD: MA - numOfSDs * SD,
            bolMA: MA,
            bWidth: null,
            perB: null,
        };

        currBollinger['bWidth'] =
            ((currBollinger['bolU'] - currBollinger['bolD']) / MA) * 100;

        currBollinger['perB'] =
            ((close - currBollinger['bolD']) /
                (currBollinger['bolU'] - currBollinger['bolD'])) *
            100;

        /* Add this to mysql and then cleanup*/
        await this.mysqlCon.storeProcessedBollinger(coinId, currBollinger);
        this.cleanup(coinId);

        let squeeze = 0;
        let expansion = 0;
        let bandWidth = Number(currBollinger['bWidth']);

        if (resultsHistoricBoll.length > 0) {
            //console.log(resultsHistoricBoll);
            squeeze = Number(resultsHistoricBoll[0]['historic_squeeze']);
            expansion = Number(resultsHistoricBoll[0]['historic_expansion']);

            /* Getting the average of the previous historic high/low and the current means that anomalies are smoothed out? */
            // Bandwidth is mutiplied by 100, and the values seem to swing between 0-5
            const bandwidthFactor = 0.5;
            if (
                bandWidth < squeeze ||
                Math.abs(bandWidth - squeeze) < bandwidthFactor
            ) {
                squeeze = (bandWidth + squeeze) / 2.0;
            }
            if (
                bandWidth > expansion ||
                Math.abs(bandWidth - expansion) < bandwidthFactor
            ) {
                expansion = (bandWidth + expansion) / 2.0;
            }
        } else {
            /* First time, so we're just discovering the values */
            squeeze = bandWidth;
            expansion = bandWidth;
        }

        let currHistBollinger = {
            timestamp: lastElOHLC['timestamp'],
            close: close,
            b_hist_squeeze: squeeze,
            b_hist_expansion: expansion,
        };

        //console.log(currHistBollinger);
        await this.mysqlCon.storeHistoricBollinger(coinId, currHistBollinger);
        await this.findTrends(coinId);
    }

    async findTrends(coinId) {
        let resultsHistoricBoll = await this.mysqlCon.getHistoricBollinger(
            coinId
        );

        if (resultsHistoricBoll.length < 4) {
            return;
        }

        let perbArr = resultsHistoricBoll.map((el) => {
            return el.per_b;
        });

        let timestamp =
            resultsHistoricBoll[resultsHistoricBoll.length - 1]['timestamp'];

        //console.log('PerB: ' + perbArr.reverse().slice(0, 4));

        const perb_t1to3 = calculateGraphGradientsTrendsPerChange(
            perbArr.reverse().slice(0, 4)
        );

        if (perb_t1to3) {
            this.mysqlCon.storeTrends(coinId, timestamp, perb_t1to3, 'PerB');
        }
    }
}

module.exports = BollingerBandsCalculations;
