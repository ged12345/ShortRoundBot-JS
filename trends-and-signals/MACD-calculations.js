//https://www.investopedia.com/ask/answers/122414/what-moving-average-convergence-divergence-macd-formula-and-how-it-calculated.asp

const util = require('util');
const Decimal = require('decimal.js');
const sleep = require('../utils/general.js').sleep;
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
        await this.mysqlCon.cleanupTrends(coinId);
        /* Unlock the coin for processing */
        this.unlockKey('MACD');
    }

    async calculate(coinId) {
        let resultsMACD = await this.mysqlCon.getProcessedMACD(coinId);
        if (resultsMACD.length === 0) {
            await this.calculateInitialEMA12(coinId);
            sleep(500).then(async () => {
                await this.calculateInitialEMA26(coinId);
                sleep(500).then(async () => {
                    await this.calculateInitialMACDandSignalLine(coinId);
                });
            });
        } else {
            await this.calculateAll(coinId);
            await this.findTrends(coinId);
        }

        this.cleanup(coinId);
    }

    async calculateInitialEMA12(coinId) {
        let resultsOHLC = await this.mysqlCon.getCoinOHLC(coinId);

        /* No acquired OHLC results yet */
        if (resultsOHLC.length === 0) return;

        /* 1. Iterate through 12 OHLC entries, and calculate the SMA. */
        let totalOHLCResults = resultsOHLC.length;
        let totalClose = 0;

        /* Everything but the last value. We calculate the SMA first but calculate the EMA of the last OHLC value (the SMA being the EMA for yesterday) */

        let EMANum = 12;

        for (let i = 0; i < EMANum; i++) {
            totalClose += Number(resultsOHLC[i]['close']);
        }

        //console.log('TOTAL CLOSE: ');
        //console.log(totalClose);

        let EMA12Arr = [];
        EMA12Arr.push({
            timestamp: resultsOHLC[EMANum - 1]['timestamp'],
            EMA: Number(totalClose / (EMANum * 1.0)),
        });

        totalClose = 0;
        let multiplier = 2.0 / (EMANum + 1);

        for (let i = EMANum; i < totalOHLCResults; i++) {
            let close = Number(resultsOHLC[i]['close']);

            EMA12Arr.push({
                timestamp: resultsOHLC[i]['timestamp'],
                EMA: Number(
                    (close - EMA12Arr[EMA12Arr.length - 1]['EMA']) *
                        multiplier +
                        EMA12Arr[EMA12Arr.length - 1]['EMA']
                ),
            });
        }

        EMA12Arr.forEach(async (el) => {
            let currMACD = {
                timestamp: el['timestamp'],
                EMA_12: el['EMA'],
                EMA_26: -9999,
                MACD: -9999,
                signal_line: -9999,
                hist: -9999,
            };

            /* Add this to mysql and then cleanup*/
            await this.mysqlCon.storeProcessedMACD(coinId, currMACD);
        });
    }

    async calculateInitialEMA26(coinId) {
        let resultsOHLC = await this.mysqlCon.getCoinOHLC(coinId);
        let resultsMACD = await this.mysqlCon.getProcessedMACD(coinId);

        /* No acquired OHLC results yet */
        if (resultsOHLC.length === 0) return;

        /* 1. Iterate through 26 OHLC entries, and calculate the SMA. */
        let totalOHLCResults = resultsOHLC.length;
        let totalClose = 0;

        /* Everything but the last value. We calculate the SMA first but calculate the EMA of the last OHLC value (the SMA being the EMA for yesterday) */

        let EMANum = 26;

        for (var i = 0; i < EMANum; i++) {
            totalClose += Number(resultsOHLC[i]['close']);
        }

        let EMA26Arr = [];
        EMA26Arr.push({
            timestamp: resultsOHLC[EMANum - 1]['timestamp'],
            EMA: Number(totalClose / (EMANum * 1.0)),
        });

        totalClose = 0;
        let multiplier = 2.0 / (EMANum + 1);

        for (var i = EMANum; i < totalOHLCResults; i++) {
            let close = Number(resultsOHLC[i]['close']);

            EMA26Arr.push({
                timestamp: resultsOHLC[i]['timestamp'],
                EMA: Number(
                    (close - EMA26Arr[EMA26Arr.length - 1]['EMA']) *
                        multiplier +
                        EMA26Arr[EMA26Arr.length - 1]['EMA']
                ),
            });

            //console.log('RESULTS OHLC:' + i);
        }

        EMA26Arr.forEach(async (el) => {
            let EMA_12 = -9999;
            for (var i = 0; i < resultsMACD.length; i++) {
                //console.log(resultsMACD[i]['timestamp'], el['timestamp']);

                if (resultsMACD[i]['timestamp'] === el['timestamp']) {
                    EMA_12 = resultsMACD[i]['EMA_12'];
                }
            }

            let currMACD = {
                timestamp: el['timestamp'],
                EMA_12: EMA_12,
                EMA_26: el['EMA'],
                MACD: -9999,
                signal_line: -9999,
                hist: -9999,
            };
            /* Add this to mysql and then cleanup*/
            await this.mysqlCon.storeProcessedMACD(coinId, currMACD);
        });
    }

    async calculateInitialMACDandSignalLine(coinId) {
        let resultsOHLC = await this.mysqlCon.getCoinOHLC(coinId);
        let resultsMACD = await this.mysqlCon.getProcessedMACD(coinId);

        // We have common EMA values at the start of the 26 - 12 EMA = 14
        let firstCommonIndex = 14;

        let MACDArr = [];
        let signalLineArr = [];

        for (var i = firstCommonIndex; i < resultsMACD.length; i++) {
            let timestamp = resultsOHLC[i]['timestamp'];
            let currMACD = {
                timestamp: timestamp,
                EMA_12: resultsMACD['EMA_12'],
                EMA_26: resultsMACD['EMA_26'],
                MACD: Number(resultsMACD['EMA_26'] - resultsMACD['EMA_12']),
                signal_line: -9999,
                hist: -9999,
            };
        }

        /* Signal line is not calculated because we're at 32 for stored OHLC, and 26+9 = 35 periods */
    }

    async calculateAll(coinId) {
        let resultsOHLC = await this.mysqlCon.getCoinOHLC(coinId);
        let resultsMACD = await this.mysqlCon.getProcessedMACD(coinId);

        let close = Number(resultsOHLC[resultsOHLC.length - 1]['close']);

        let EMANum = 12;
        let multiplier = 2.0 / (EMANum + 1);

        let EMA12 =
            Number(
                close - Number(resultsMACD[resultsMACD.length - 1]['EMA_12'])
            ) *
                multiplier +
            Number(resultsMACD[resultsMACD.length - 1]['EMA_12']);

        EMANum = 26;
        multiplier = 2.0 / (EMANum + 1);

        let EMA26 =
            Number(
                close - Number(resultsMACD[resultsMACD.length - 1]['EMA_26'])
            ) *
                multiplier +
            Number(resultsMACD[resultsMACD.length - 1]['EMA_26']);

        let MACD = Number(EMA12 - EMA26);

        let signalLine = -9999;
        /* Count how many MACDs we have */
        let signalCount = 0;
        resultsMACD.forEach((el) => {
            if (Number(el['MACD']) !== Number(-9999.0)) {
                signalCount += 1;
            }
        });

        let signalNum = 9;
        multiplier = 2.0 / (signalNum + 1);

        if (signalCount === 9) {
            /* We have our first signal! */
            let totalClose = 0;
            for (
                var i = resultsMACD.length - signalNum;
                i < resultsMACD.length;
                i++
            ) {
                totalClose += Number(resultsMACD[i]['MACD']);
            }

            signalLine = Number(totalClose / signalNum);
        } else if (signalCount > 9) {
            /* We have our next signal! */
            //console.log('SIGNAL 9+');
            //console.log(resultsMACD[resultsMACD.length - 1], close);
            signalLine =
                MACD * multiplier +
                resultsMACD[resultsMACD.length - 1]['signal_line'] *
                    (1 - multiplier);
        }

        let currMACD = {
            timestamp: resultsOHLC[resultsOHLC.length - 1]['timestamp'],
            EMA_12: EMA12,
            EMA_26: EMA26,
            MACD: MACD,
            signal_line: signalLine,
            hist: signalLine !== Number(-9999.0) ? MACD - signalLine : -9999,
        };

        //console.log(EMA12, EMA26, MACD, signalLine);

        /* Add this to mysql and then cleanup*/
        await this.mysqlCon.storeProcessedMACD(coinId, currMACD);
    }

    async findTrends(coinId) {
        let resultsMACDs = await this.mysqlCon.getProcessedMACD(coinId);

        /* We check for -9999, because thats' the default for MACD for 4-5 turns */
        if (
            resultsMACDs.length < 4 ||
            Number(resultsMACDs[resultsMACDs.length - 1]['signal_line']) ===
                Number(-9999)
        ) {
            return;
        }

        let MACDArr = resultsMACDs.map((el) => {
            /* We need the faster metric, but we can change to d_full if we have to */
            return el.hist;
        });

        let timestamp = resultsMACDs[resultsMACDs.length - 1]['timestamp'];

        const macd_t1to3 = calculateGraphGradientsTrendsPerChange(
            MACDArr.reverse().slice(0, 4),
            true
        );

        this.mysqlCon.storeTrends(coinId, timestamp, macd_t1to3, 'MACD');
    }
}

module.exports = MACDCalculations;
