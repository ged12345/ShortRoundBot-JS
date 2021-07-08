const {
    COIN_STATUS,
    COIN_ADVICE,
    TREND_SHAPE,
} = require('../coin-bot/constants.js');
const { outputError } = require('../utils/general.js');

class GeneralTrendAdvice {
    constructor(
        mysqlCon,
        bollingerStoreNum,
        rsiStoreNum,
        stochasticStoreNum,
        emaStoreNum,
        totalRecordsNum,
        unlockKey
    ) {
        this.mysqlCon = mysqlCon;
        this.BollingerStoreNum = bollingerStoreNum;
        this.RSIStoreNum = rsiStoreNum;
        this.StochasticStoreNum = stochasticStoreNum;
        this.EMAStoreNum = emaStoreNum;
        this.totalRecordsNum = totalRecordsNum;
        this.unlockKey = unlockKey;
    }

    async advise(coinId) {
        let resultsOHLC = await this.mysqlCon.getCoinOHLC(coinId);
        let resultsHistoricBoll = await this.mysqlCon.getHistoricBollinger(
            coinId
        );
        let resultsBoll = await this.mysqlCon.getProcessedBollinger(coinId);
        let resultsEMA = await this.mysqlCon.getProcessedEMA(coinId);
        let resultsRSI = await this.mysqlCon.getProcessedRSI(coinId);
        let resultsStochastics = await this.mysqlCon.getProcessedStochastic(
            coinId
        );
        let resultsMACD = await this.mysqlCon.getProcessedMACD(coinId);

        let resultsTrends = await this.mysqlCon.getTrends(coinId);

        if (resultsOHLC.length === 0) {
            console.log('Advice: None yet, OHLC not prepared yet.');
            return false;
        }
        /* If we have no EMAs and the signal line for the MACD hasn't be calculated */
        if (resultsEMA.length < 2) {
            console.log('Advice: None yet, EMA too short.');
            return false;
        } else if (
            resultsMACD[resultsMACD.length - 1]['signal_line'] === -9999
        ) {
            console.log('Advice: None yet, MACD too short.');
            return false;
        }

        let tradeBuyPercentage = 0;
        let tradeSellPercentage = 0;

        let currResultsTrends = resultsTrends[resultsTrends.length - 1];

        /* 3 is current, 2 is next current, 1 is 3 back */
        let CloseTotalPercentageChange =
            Number(currResultsTrends['close_per_change1']) +
            Number(currResultsTrends['close_per_change2']) +
            Number(currResultsTrends['close_per_change3']);

        let CloseCurrPercentageChange = Number(
            currResultsTrends['close_per_change3']
        );

        let CloseCurr1And2PercentageChange =
            Number(currResultsTrends['close_per_change3']) +
            Number(currResultsTrends['close_per_change2']);

        console.log(
            Number(currResultsTrends['close_per_change1']),
            Number(currResultsTrends['close_per_change2']),
            Number(currResultsTrends['close_per_change3'])
        );

        let RSITotalPercentageChange =
            Number(currResultsTrends['RSI_per_change1']) +
            Number(currResultsTrends['RSI_per_change2']) +
            Number(currResultsTrends['RSI_per_change3']);

        let RSICurrPercentageChange = Number(
            currResultsTrends['RSI_per_change3']
        );

        let RSICurr1And2PercentageChange =
            Number(currResultsTrends['RSI_per_change3']) +
            Number(currResultsTrends['RSI_per_change2']);

        let StochTotalPercentageChange =
            Number(currResultsTrends['Stoch_per_change1']) +
            Number(currResultsTrends['Stoch_per_change2']) +
            Number(currResultsTrends['Stoch_per_change3']);

        let StochCurrPercentageChange = Number(
            currResultsTrends['Stoch_per_change3']
        );

        let StochCurr1And2PercentageChange =
            Number(currResultsTrends['Stoch_per_change3']) +
            Number(currResultsTrends['Stoch_per_change2']);

        let PerBTotalPercentageChange =
            Number(currResultsTrends['PerB_per_change1']) +
            Number(currResultsTrends['PerB_per_change2']) +
            Number(currResultsTrends['PerB_per_change3']);

        let PerBCurrPercentageChange = Number(
            currResultsTrends['PerB_per_change3']
        );

        let PerBCurr1And2PercentageChange =
            Number(currResultsTrends['PerB_per_change3']) +
            Number(currResultsTrends['PerB_per_change2']);

        let MACDTotalPercentageChange =
            Number(currResultsTrends['MACD_per_change1']) +
            Number(currResultsTrends['MACD_per_change2']) +
            Number(currResultsTrends['MACD_per_change3']);

        let currRSI = Number(resultsRSI[resultsRSI.length - 1]['RSI']);
        /* This was it previously - we fixed this but may be stuffing us up */
        /* let currPerB = Number(resultsMACD['per_b']); */
        let currPerB = Number(resultsBoll[resultsBoll.length - 1]['per_b']);
        let currClosePrice = resultsOHLC[resultsOHLC.length - 1]['close'];
        let coinStatus = '';
        let coinAdvice = COIN_ADVICE.HOLD;

        let timestamp = Date.now();
        let timestampDate = new Date(timestamp);
        let stampFullDate = timestampDate
            .toLocaleDateString('en-AU')
            .slice(0, 10)
            .split('/')
            .reverse()
            .join('-');
        let stampFullTime = timestampDate.toLocaleTimeString('en-AU', {
            hour12: false,
        });

        console.log(stampFullTime);

        /* CLOSE */
        if (
            currResultsTrends['close_shape'] === TREND_SHAPE.CRASHING &&
            CloseTotalPercentageChange < -2
        ) {
            tradeSellPercentage = 95;
        } else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.CRASHING &&
            CloseTotalPercentageChange < -1.5
        ) {
            tradeSellPercentage = 90;
        } else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.CRASHING &&
            CloseTotalPercentageChange < -1
        ) {
            tradeSellPercentage = 85;
        } else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.CRASHING &&
            CloseTotalPercentageChange < -0.5
        ) {
            tradeSellPercentage = 80;
        } else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.CRASHING &&
            CloseTotalPercentageChange < -0.25
        ) {
            tradeSellPercentage = 70;
        } else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.CRASHING &&
            CloseTotalPercentageChange < -0.1
        ) {
            tradeSellPercentage = 60;
        } else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.DROPPING_DOWN &&
            CloseTotalPercentageChange < -5
        ) {
            tradeSellPercentage = 75;
        } else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.DROPPING_DOWN &&
            CloseTotalPercentageChange < -2.5
        ) {
            tradeSellPercentage = 70;
        } else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.DROPPING_DOWN &&
            CloseTotalPercentageChange < -1
        ) {
            tradeSellPercentage = 65;
        } else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.DROPPING_DOWN &&
            CloseTotalPercentageChange < -0.5
        ) {
            tradeSellPercentage = 60;
        } else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.DROPPING_DOWN &&
            CloseTotalPercentageChange < -0.25
        ) {
            tradeSellPercentage = 55;
        } else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.DROPPING_DOWN &&
            CloseTotalPercentageChange < -0.1
        ) {
            tradeSellPercentage = 50;
        } else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.DROPPING_DOWN &&
            CloseTotalPercentageChange < -0.05
        ) {
            tradeSellPercentage = 40;
        }

        if (
            currResultsTrends['close_shape'] === TREND_SHAPE.DROPPING_DOWN &&
            CloseCurr1And2PercentageChange < -1
        ) {
            tradeSellPercentage += 12.5;
        } else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.DROPPING_DOWN &&
            CloseCurr1And2PercentageChange < -0.75
        ) {
            tradeSellPercentage += 10;
        } else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.DROPPING_DOWN &&
            CloseCurr1And2PercentageChange < -0.5
        ) {
            tradeSellPercentage += 7.5;
        } /* Added these last two - may be messing us up */ else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.DROPPING_DOWN &&
            CloseCurr1And2PercentageChange < -0.25
        ) {
            tradeSellPercentage += 5;
        } else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.DROPPING_DOWN &&
            CloseCurr1And2PercentageChange < -0.1
        ) {
            tradeSellPercentage += 2.5;
        }

        if (
            currResultsTrends['close_shape'] === TREND_SHAPE.DROPPING_DOWN &&
            CloseCurrPercentageChange < -1
        ) {
            tradeSellPercentage += 15;
        } else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.DROPPING_DOWN &&
            CloseCurrPercentageChange < -0.75
        ) {
            tradeSellPercentage += 12.5;
        } else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.DROPPING_DOWN &&
            CloseCurrPercentageChange < -0.5
        ) {
            tradeSellPercentage += 10;
        } /* Added these last two - may be messing us up */ else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.DROPPING_DOWN &&
            CloseCurrPercentageChange < -0.25
        ) {
            tradeSellPercentage += 7.5;
        } else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.DROPPING_DOWN &&
            CloseCurrPercentageChange < -0.1
        ) {
            tradeSellPercentage += 5;
        }

        console.log('Trade Buy1: ', tradeBuyPercentage);
        console.log('Trade Sell1: ', tradeSellPercentage);

        /* Buy percentages */
        if (CloseTotalPercentageChange > 0.2) {
            tradeBuyPercentage += 20;
        } else if (CloseTotalPercentageChange > 0.15) {
            tradeBuyPercentage += 15;
        } else if (CloseTotalPercentageChange > 0.125) {
            tradeBuyPercentage += 12.5;
        } else if (CloseTotalPercentageChange > 0.1) {
            tradeBuyPercentage += 10;
        } else if (CloseTotalPercentageChange > 0.075) {
            tradeBuyPercentage += 7.5;
        } else if (CloseTotalPercentageChange > 0.05) {
            tradeBuyPercentage += 5;
        }

        console.log('Trade Buy2: ', tradeBuyPercentage);
        console.log('Trade Sell2: ', tradeSellPercentage);

        /* Our buy percentage is low, and the first or first and second together is going up, let's pump up the buy percentage */
        if (tradeBuyPercentage < 30) {
            if (CloseCurrPercentageChange > 0.2) {
                tradeBuyPercentage += 25;
            } else if (CloseCurrPercentageChange > 0.15) {
                tradeBuyPercentage += 20;
            } else if (CloseCurrPercentageChange > 0.1) {
                tradeBuyPercentage += 15;
            } else if (CloseCurrPercentageChange > 0.05) {
                tradeBuyPercentage += 10;
            } else if (CloseCurr1And2PercentageChange > 0.2) {
                tradeBuyPercentage += 20;
            } else if (CloseCurr1And2PercentageChange > 0.15) {
                tradeBuyPercentage += 15;
            } else if (CloseCurr1And2PercentageChange > 0.1) {
                tradeBuyPercentage += 10;
            } else if (CloseCurr1And2PercentageChange > 0.05) {
                tradeBuyPercentage += 5;
            }
        }

        console.log('Close part total:', CloseTotalPercentageChange);
        console.log('Close part 1+2:', CloseCurr1And2PercentageChange);
        console.log('Close part 1:', CloseCurrPercentageChange);
        console.log('Trade Buy: ', tradeBuyPercentage);
        console.log('Trade Sell: ', tradeSellPercentage);
        //console.log(currResultsTrends);

        /* MACD */
        /* If the MACD histogram percentage change is currently negative */
        if (MACDTotalPercentageChange > 10) {
            tradeBuyPercentage += 20;
        } else if (MACDTotalPercentageChange > 7.5) {
            tradeBuyPercentage += 15;
        } else if (MACDTotalPercentageChange > 5) {
            tradeBuyPercentage += 12.5;
        } else if (MACDTotalPercentageChange > 2.5) {
            tradeBuyPercentage += 10;
        } else if (MACDTotalPercentageChange > 1) {
            tradeBuyPercentage += 7.5;
        } else if (MACDTotalPercentageChange > 0.5) {
            tradeBuyPercentage += 5;
        }

        /* If the MACD histogram percentage change is currently negative */
        if (MACDTotalPercentageChange < -10) {
            tradeSellPercentage += 20;
        } else if (MACDTotalPercentageChange < -7.5) {
            tradeSellPercentage += 15;
        } else if (MACDTotalPercentageChange < -5) {
            tradeSellPercentage += 12.5;
        } else if (MACDTotalPercentageChange < -2.5) {
            tradeSellPercentage += 10;
        } else if (MACDTotalPercentageChange < -1) {
            tradeSellPercentage += 7.5;
        } else if (MACDTotalPercentageChange < -0.5) {
            tradeSellPercentage += 5;
        }

        console.log('MACDTrade Buy: ', tradeBuyPercentage);
        console.log('MACDTrade Sell: ', tradeSellPercentage);

        /* RSI */
        if (RSITotalPercentageChange > 0 && RSITotalPercentageChange > 25) {
            tradeBuyPercentage += 7.5;
        }

        if (RSICurrPercentageChange > 20) {
            tradeBuyPercentage += 25;
        } else if (RSICurr1And2PercentageChange > 20) {
            tradeBuyPercentage += 20;
        } else if (RSICurrPercentageChange > 15) {
            tradeBuyPercentage += 20;
        } else if (RSICurr1And2PercentageChange > 15) {
            tradeBuyPercentage += 15;
        } else if (RSICurrPercentageChange > 10) {
            tradeBuyPercentage += 15;
        } else if (RSICurr1And2PercentageChange > 10) {
            tradeBuyPercentage += 10;
        } else if (RSICurrPercentageChange > 5) {
            tradeBuyPercentage += 10;
        } else if (RSICurr1And2PercentageChange > 5) {
            tradeBuyPercentage += 5;
        } else if (RSICurrPercentageChange > 2.5) {
            tradeBuyPercentage += 5;
        } else if (RSICurr1And2PercentageChange > 2.5) {
            tradeBuyPercentage += 2.5;
        }

        if (currRSI > 90) {
            tradeBuyPercentage += 15;
        }

        if (currRSI > 66) {
            tradeBuyPercentage += 10;
        }

        console.log('RSITrade Buy: ', tradeBuyPercentage);
        console.log('RSITrade Sell: ', tradeSellPercentage);

        /* Stoch */
        if (StochTotalPercentageChange > 40) {
            tradeBuyPercentage += 10;
        } else if (StochTotalPercentageChange > 25) {
            tradeBuyPercentage += 7.5;
        } else if (StochTotalPercentageChange > 15) {
            tradeBuyPercentage += 5;
        } else if (StochTotalPercentageChange > 10) {
            tradeBuyPercentage += 2.5;
        }

        if (StochCurrPercentageChange > 40) {
            tradeBuyPercentage += 35;
        } else if (StochCurr1And2PercentageChange > 40) {
            tradeBuyPercentage += 30;
        } else if (StochCurrPercentageChange > 30) {
            tradeBuyPercentage += 30;
        } else if (StochCurr1And2PercentageChange > 30) {
            tradeBuyPercentage += 25;
        } else if (StochCurrPercentageChange > 20) {
            tradeBuyPercentage += 25;
        } else if (StochCurr1And2PercentageChange > 20) {
            tradeBuyPercentage += 20;
        } else if (StochCurrPercentageChange > 15) {
            tradeBuyPercentage += 20;
        } else if (StochCurr1And2PercentageChange > 15) {
            tradeBuyPercentage += 15;
        } else if (StochCurrPercentageChange > 10) {
            tradeBuyPercentage += 15;
        } else if (StochCurr1And2PercentageChange > 10) {
            tradeBuyPercentage += 10;
        } else if (StochCurrPercentageChange > 5) {
            tradeBuyPercentage += 10;
        } else if (StochCurr1And2PercentageChange > 5) {
            tradeBuyPercentage += 5;
        } else if (StochCurrPercentageChange > 2.5) {
            tradeBuyPercentage += 5;
        } else if (StochCurr1And2PercentageChange > 2.5) {
            tradeBuyPercentage += 2.5;
        }

        console.log('Stoch 1:', Number(currResultsTrends['Stoch_per_change1']));
        console.log('Stoch 2:', Number(currResultsTrends['Stoch_per_change2']));
        console.log('Stoch 3:', Number(currResultsTrends['Stoch_per_change3']));

        console.log('Stoch part total:', StochTotalPercentageChange);
        console.log('Stoch part 1+2:', StochCurr1And2PercentageChange);
        console.log('Stoch part 1:', StochCurrPercentageChange);
        console.log('StochTrade Buy: ', tradeBuyPercentage);
        console.log('StochTrade Sell: ', tradeSellPercentage);

        
        console.log('Current PerB: ', currPerB);
        /*if (currPerB > 98) {
            tradeBuyPercentage += 25;
        }*/

        /* Trend for PerB seems to be if the current price trend is negative and PerB falls below or very cose to zero threshold, there is a price revrsal i.e. a buy buy buy! */
        if (
            currPerB < 2.5 &&
            CloseCurr1And2PercentageChange < 0 &&
            CloseCurrPercentageChange < 0
        ) {
            tradeBuyPercentage += 30;
            tradeSellPercentage += 30;
        }
        else if (
            currPerB > 97.5 &&
            CloseCurr1And2PercentageChange > 0 &&
            CloseCurrPercentageChange > 0
        ) {
            tradeBuyPercentage -= 30;
            tradeSellPercentage += 30;
        } else {
            /* Note: We should only add these other metrics if the two cases above do not occur. When we hit hte top of a PerB range and the trend is already upward, we really want to stamp down on buying.

            /* Bollinginger - PerB */
            if (PerBTotalPercentageChange > 40) {
                tradeBuyPercentage += 30;
            } else if (PerBTotalPercentageChange > 25) {
                tradeBuyPercentage += 15;
            } else if (PerBTotalPercentageChange > 15) {
                tradeBuyPercentage += 10;
            } else if (PerBTotalPercentageChange > 10) {
                tradeBuyPercentage += 5;
            }

            if (PerBCurrPercentageChange > 40) {
                tradeBuyPercentage += 35;
            } else if (PerBCurr1And2PercentageChange > 40) {
                tradeBuyPercentage += 30;
            } else if (PerBCurrPercentageChange > 30) {
                tradeBuyPercentage += 30;
            } else if (PerBCurr1And2PercentageChange > 30) {
                tradeBuyPercentage += 25;
            } else if (PerBCurrPercentageChange > 20) {
                tradeBuyPercentage += 25;
            } else if (PerBCurr1And2PercentageChange > 20) {
                tradeBuyPercentage += 20;
            } else if (PerBCurrPercentageChange > 15) {
                tradeBuyPercentage += 20;
            } else if (PerBCurr1And2PercentageChange > 15) {
                tradeBuyPercentage += 15;
            } else if (PerBCurrPercentageChange > 10) {
                tradeBuyPercentage += 15;
            } else if (PerBCurr1And2PercentageChange > 10) {
                tradeBuyPercentage += 10;
            } else if (PerBCurrPercentageChange > 5) {
                tradeBuyPercentage += 10;
            } else if (PerBCurr1And2PercentageChange > 5) {
                tradeBuyPercentage += 5;
            } else if (PerBCurrPercentageChange > 2.5) {
                tradeBuyPercentage += 5;
            } else if (PerBCurr1And2PercentageChange > 2.5) {
                tradeBuyPercentage += 2.5;
            }

        }

        console.log('PerBTrade Buy: ', tradeBuyPercentage);
        console.log('PerBTrade Sell: ', tradeSellPercentage);

        if (tradeBuyPercentage > 90) {
            coinAdvice = COIN_ADVICE.DEFINITE_BUY;
        } else if (tradeBuyPercentage >= 70 && tradeSellPercentage < 60) {
            coinAdvice = COIN_ADVICE.POSSIBLE_BUY;
        } else if (tradeBuyPercentage >= 60 && tradeSellPercentage < 30) {
            coinAdvice = COIN_ADVICE.POSSIBLE_BUY;
        } /* We changed this too - tradeSellPercentage was > 10) */ else if (
            tradeBuyPercentage >= 55 &&
            tradeSellPercentage < 10
        ) {
            coinAdvice = COIN_ADVICE.POSSIBLE_BUY;
        } else if (tradeBuyPercentage > 50 && tradeSellPercentage < 60) {
            coinAdvice = COIN_ADVICE.HOLD;
        } else if (tradeBuyPercentage > 40 && tradeSellPercentage < 20) {
            coinAdvice = COIN_ADVICE.HOLD;
        } else if (tradeBuyPercentage < 60 && tradeSellPercentage > 70) {
            coinAdvice = COIN_ADVICE.POSSIBLE_SELL;
        } else if (tradeBuyPercentage < 40 && tradeSellPercentage > 60) {
            coinAdvice = COIN_ADVICE.POSSIBLE_SELL;
        } else if (tradeSellPercentage > 80) {
            coinAdvice = COIN_ADVICE.POSSIBLE_SELL;
        } else if (tradeSellPercentage >= 90) {
            coinAdvice = COIN_ADVICE.IMMEDIATE_SELL;
        } /* Maybe - test this out */
        /*else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.CRASHING &&
            tradeSellPercentage > 60
        ) {
            coinAdvice = COIN_ADVICE.POSSIBLE_SELL;
        }*/

        console.log('Shape: ', currResultsTrends['close_shape']);

        if (
            currResultsTrends['close_shape'] ===
                TREND_SHAPE.SLOPING_UP_TO_FLAT ||
            currResultsTrends['close_shape'] ===
                TREND_SHAPE.SPIKING_UP_TO_FLAT ||
            currResultsTrends['close_shape'] ===
                TREND_SHAPE.SLOPING_DOWN_TO_FLAT ||
            currResultsTrends['close_shape'] ===
                TREND_SHAPE.DROPPING_DOWN_TO_FLAT ||
            currResultsTrends['close_shape'] === TREND_SHAPE.FLAT
        ) {
            coinStatus = COIN_STATUS.SIDEWAYS;
        } else if (
            currResultsTrends['close_shape'] ===
                TREND_SHAPE.FLAT_TO_SLOPING_UP ||
            currResultsTrends['close_shape'] ===
                TREND_SHAPE.UPWARD_UBEND_SOFT ||
            currResultsTrends['close_shape'] === TREND_SHAPE.SLOPING_UP ||
            currResultsTrends['close_shape'] === TREND_SHAPE.RIGHT_SIDE_N
        ) {
            coinStatus = COIN_STATUS.WOBBLING_UP;
        } else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.UPWARD_UBEND_HARD
        ) {
            coinStatus = COIN_STATUS.RISING;
        } else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.SPIKING_UP ||
            currResultsTrends['close_shape'] === TREND_SHAPE.FLAT_TO_SPIKING_UP
        ) {
            coinStatus = COIN_STATUS.SPIKING;
        } else if (
            currResultsTrends['close_shape'] ===
                TREND_SHAPE.FLAT_TO_SLOPING_DOWN ||
            currResultsTrends['close_shape'] ===
                TREND_SHAPE.DOWNWARD_UBEND_SOFT ||
            currResultsTrends['close_shape'] === TREND_SHAPE.SLOPING_DOWN ||
            currResultsTrends['close_shape'] ===
                TREND_SHAPE.DOWNWARD_UBEND_HARD ||
            currResultsTrends['close_shape'] === TREND_SHAPE.UPSIDE_DOWN_N
        ) {
            coinStatus = COIN_STATUS.WOBBLING_DOWN;
        } else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.DROPPING_DOWN ||
            currResultsTrends['close_shape'] ===
                TREND_SHAPE.FLAT_TO_DROPPING_DOWN
        ) {
            coinStatus = COIN_STATUS.DROPPING;
        } else if (currResultsTrends['close_shape'] === TREND_SHAPE.CRASHING) {
            coinStatus = COIN_STATUS.CRASHING;
        }

        /* Debug */
        if (
            coinAdvice === COIN_ADVICE.DEFINITE_BUY ||
            coinAdvice === COIN_ADVICE.POSSIBLE_BUY
        ) {
            outputError('Timestamp: ', timestamp);
            outputError('Definite Buy');
            outputError('Close');
            outputError(
                'Close 1: ',
                currResultsTrends['close_per_change1']
            );
            outputError(
                'Close 2: ',
                currResultsTrends['close_per_change2']
            );
            outputError(
                'Close 3: ',
                currResultsTrends['close_per_change3']
            );
            outputError('MACD');
            outputError(
                'MACD 1: ',
                currResultsTrends['MACD_per_change1']
            );
            outputError(
                'MACD 2: ',
                currResultsTrends['MACD_per_change2']
            );
            outputError(
                'MACD 3: ',
                currResultsTrends['MACD_per_change3']
            );
            outputError('RSI');
            outputError(
                'RSI 1: ',
                currResultsTrends['RSI_per_change1']
            );
            outputError(
                'RSI 2: ',
                currResultsTrends['RSI_per_change2']
            );
            outputError(
                'RSI 3: ',
                currResultsTrends['RSI_per_change3']
            );
            outputError('Curr RSI: ', currRSI);
            outputError('PerB');
            outputError(
                'PerB 1: ',
                currResultsTrends['PerB_per_change1']
            );
            outputError(
                'PerB 2: ',
                currResultsTrends['PerB_per_change2']
            );
            outputError(
                'PerB 3: ',
                currResultsTrends['PerB_per_change3']
            );
            outputError('Curr PerB: ', currPerB);
            outputError('Stoch');
            outputError(
                'Stoch 1: ',
                currResultsTrends['Stoch_per_change1']
            );
            outputError(
                'Stoch 2: ',
                currResultsTrends['Stoch_per_change2']
            );
            outputError(
                'Stoch 3: ',
                currResultsTrends['Stoch_per_change3']
            );
        }

        return {
            tradeBuy: tradeBuyPercentage,
            tradeSell: tradeSellPercentage,
            coinStatus: coinStatus,
            coinAdvice: coinAdvice,
            initialClose: currClosePrice,
        };
    }

    async adviseV1(coinId) {
        /* Here we get all of our metrics */
        let resultsOHLC = await this.mysqlCon.getCoinOHLC(coinId);
        let resultsHistoricBoll = await this.mysqlCon.getHistoricBollinger(
            coinId
        );
        let resultsBoll = await this.mysqlCon.getProcessedBollinger(coinId);
        let resultsEMA = await this.mysqlCon.getProcessedEMA(coinId);
        let resultsRSI = await this.mysqlCon.getProcessedRSI(coinId);
        let resultsStochastics = await this.mysqlCon.getProcessedStochastic(
            coinId
        );

        if (resultsOHLC.length === 0) return false;

        /* We supply the current close price so the traders can know what to set their stop-loss at and the top sell price. */
        let currClosePrice = resultsOHLC[resultsOHLC.length - 1]['close'];

        /* Are we giving locked in advice here? If so, I need to identify when to tell the traders to sell. Do I need the initial trade purchase price, or do I just give the advice to sell at the first notice of a downward trend? */

        /* Find bots locked to this coin and give advice - but would the advice for any of them be any different from hold or sell? */
        let lockedAdvice = false;

        /* LET'S DO IT WITHOUT THE LOCKS FOR NOW. THAT'S PURELY ON THE TRADE BOTS SIDE, BUT ONLY FOR NOW, SO IT DOESN'T JUST SKIP BETWEEN COINS. */

        /*  I'll try the simplified version: Sharp downward trend for any of the last three periods will initiate sell advice. The trade bot will hopefully bring up the stop loss to close to the latest close value, selling at the market price. */

        /* We're going for a value from 0-1 */
        let tradeBuyPercentage = 0;
        /* We need this just in case we need to sell straight away - downward trending in a bad way, as in every SMA value for the past however long is a downward trend...we sell immediately. */
        let tradeSellPercentage = 0;

        /* Identifying trends */
        /* 1. Are we in an upward trend ? */
        /* We check the last three SMA entries to see if we're in an upward trend, or if we're in a sideways(1)? Better if upwards (2). */

        if (resultsEMA.length < 2) {
            return false;
        }

        const currRSI = Number(resultsRSI[resultsRSI.length - 1]['RSI']);
        let currStoch = Number(
            resultsStochastics[resultsStochastics.length - 1]['d_full']
        );

        /* If we don't have d_full (takes 5 mins), we can use the other indicators to get some sort of quick heuristic going when the bot is started. The hope is our coin-bot will never go down for long, but if it has to, we want ShortRound to get up and running as quickly as possible. */
        if (currStoch === -1) {
            currStoch = Number(
                resultsStochastics[resultsStochastics.length - 1]['d_slow']
            );

            if (currStoch === -1) {
                currStoch = Number(
                    resultsStochastics[resultsStochastics.length - 1]['k_fast']
                );
            }
        }

        const currUpperB = Number(resultsBoll[resultsBoll.length - 1]['bol_u']);
        const currLowerB = Number(resultsBoll[resultsBoll.length - 1]['bol_d']);
        const currPerB = Number(resultsBoll[resultsBoll.length - 1]['per_b']);

        const currEMA = Number(resultsEMA[resultsEMA.length - 1]['EMA']);
        const oldEMA = Number(resultsEMA[resultsEMA.length - 2]['EMA']);

        const currSMA = Number(resultsEMA[resultsEMA.length - 1]['SMA']);
        const oldSMA = Number(resultsEMA[resultsEMA.length - 2]['SMA']);

        let RSIBuyPer = 0;
        let RSISellPer = 0;

        /* 33 and 66 are the limits for RSI and Stoch */
        if (currRSI >= 90) {
            RSISellPer += 0.35;
            // For the higher levels, we take a bit from the sell or buy
            RSIBuyPer -= 0.1;
        } else if (currRSI >= 80) {
            RSISellPer += 0.25;
        } else if (currRSI >= 66) {
            RSISellPer += 0.15;
        }

        if (currRSI <= 10) {
            RSIBuyPer += 0.35;
            // For the higher levels, we take a bit from the sell or buy
            RSISellPer -= 0.1;
        } else if (currRSI <= 20) {
            RSIBuyPer += 0.25;
        } else if (currRSI <= 33) {
            RSIBuyPer += 0.15;
        }

        console.log('RSI Buy: ' + RSIBuyPer);
        console.log('RSI Sell: ' + RSISellPer);

        /* We have to look at the Stoch as a momentum indicator - allegedly if theres an upward or downward trending market, it indicates momentum in that direction, but if there's a divergence, that's when there may be an indicator of a price change */

        let stochBuyPer = 0;
        let stochSellPer = 0;

        if (currStoch >= 90) {
            stochSellPer = 0.35;
            // For the higher levels, we take a bit from the sell or buy
            stochBuyPer = -0.1;
        } else if (currStoch >= 80) {
            stochSellPer = 0.25;
        } else if (currStoch >= 66) {
            stochSellPer = 0.15;
        }

        if (currStoch <= 10) {
            stochBuyPer = 0.35;
            // For the higher levels, we take a bit from the sell or buy
            stochSellPer = -0.1;
        } else if (currStoch <= 20) {
            stochBuyPer = 0.25;
        } else if (currStoch <= 33) {
            stochBuyPer = 0.15;
        }

        console.log('Stoch Buy: ' + stochBuyPer);
        console.log('Stoch Sell: ' + stochSellPer);

        let bollBuyPer = 0;
        let bollSellPer = 0;

        /* Current close price near above/above or near below/below corresponding Bollinger band */
        if (currPerB > 92.5) {
            if (currPerB > 120) {
                bollBuyPer += 0.35;
                /* Bollinger above or below bands are somewhat strong signals */
                bollSellPer -= 0.1;
            } else if (currPerB > 110) {
                bollBuyPer += 0.25;
                /* Bollinger above or below bands are somewhat strong signals */
                bollSellPer -= 0.15;
            } else if (currPerB > 92.5) {
                bollBuyPer += 0.1;
                /* Bollinger above or below bands are somewhat strong signals */
                bollSellPer -= 0.05;
            }
        }
        /* Current close price above or below corresponding Bollinger band */
        if (currPerB < 7.5) {
            if (currPerB < -20) {
                bollSellPer += 0.35;
                /* Bollinger above or below bands are somewhat strong signals */
                bollBuyPer -= 0.15;
            } else if (currPerB < -10) {
                bollSellPer += 0.25;
                /* Bollinger above or below bands are somewhat strong signals */
                bollBuyPer -= 0.1;
            } else if (currPerB < 7.5) {
                bollSellPer += 0.1;
                /* Bollinger above or below bands are somewhat strong signals */
                bollBuyPer -= 0.05;
            }
        }

        console.log('Boll Buy: ' + bollBuyPer);
        console.log('Boll Sell: ' + bollSellPer);

        let EMABuyPer = 0;
        let EMASellPer = 0;

        /* Ema flips below and under SMA when there's a trend shift */
        if (oldEMA < oldSMA && currEMA > currSMA) {
            EMABuyPer += 0.3;
        }
        if (oldEMA > oldSMA && currEMA < currSMA) {
            EMASellPer += 0.3;
        }

        console.log('EMA Buy: ' + EMABuyPer);
        console.log('EMA Sell: ' + EMASellPer);

        /* Here we calculate a MACD-like value by seeing if the EMA is currently above the SMA and vica versa, and proportionally how far between the two - above is bearish, below is bullish */

        let MACDBuyPer = 0;
        let MACDSellPer = 0;

        /* Possible to add a momentum factor - we can go back through the EMAs and SMAs and see how long each has been under the other, as there seems to be an better chance for an upward or downward trend when this occurs, so we add to our buying percentage */
        if (oldEMA > oldSMA && currEMA > currSMA) {
            if (Math.abs(currEMA - currSMA) / currClosePrice < 0.001) {
                MACDBuyPer += 0.1;
            } else {
                MACDBuyPer += 0.2;
            }
        } else if (oldEMA < oldSMA && currEMA < currSMA) {
            if (Math.abs(currEMA - currSMA) / currClosePrice < 0.001) {
                MACDSellPer += 0.1;
            } else {
                MACDSellPer += 0.2;
            }
        }

        console.log('MACD Buy: ' + MACDBuyPer);
        console.log('MACD Sell: ' + MACDSellPer);

        tradeBuyPercentage =
            RSIBuyPer + stochBuyPer + bollBuyPer + EMABuyPer + MACDBuyPer;
        tradeSellPercentage =
            RSISellPer + stochSellPer + bollSellPer + EMASellPer + MACDSellPer;

        /* TRENDING: Let's work on the latest 3 trends, if they exist */
        let coin_status = null;
        let trendCalculator = 0;

        if (resultsEMA.length >= 5) {
            let prevPastTrendCount = 3;
            for (
                let i = resultsEMA.length - prevPastTrendCount;
                i < resultsEMA.length;
                i++
            ) {
                trendCalculator += Number(resultsEMA[i]['trend']);
            }

            if (trendCalculator <= -2.5) {
                /* We use negative values here because only if the trend is very negative do we regard the trend as downward. We may have gone from a negative to a sideways trend which is *less* negative, but not positive */
                /* Do not buy. Trend is too downward atm. Give a massive penalty. */
                tradeBuyPercentage -= 0.75;
                coin_status = COIN_STATUS.WOBBLING_DOWN;
                /* If we're locked in, we set this */
                tradeSellPercentage = 0.5;
            } else if (trendCalculator <= -1.5) {
                /* Do not buy. Trend is too downward atm. Give a massive penalty. */
                tradeBuyPercentage -= 0.75;
                coin_status = COIN_STATUS.WOBBLING_DOWN;
                /* If we're locked in, we set this */
                tradeSellPercentage = 0.25;
            } else if (
                trendCalculator <
                prevPastTrendCount - prevPastTrendCount / 2
            ) {
                tradeBuyPercentage += 0.15;
                coin_status = COIN_STATUS.WOBBLING_UP;
                /* Trend is straight but slightly upwards */
            } else if (trendCalculator <= prevPastTrendCount) {
                /* Trend is mostly upwards so high probability of profit */
                tradeBuyPercentage += 0.3;
                coin_status = COIN_STATUS.SPIKING;
            }

            /* CRASHING CHECK : Let's check the trends for selling if we have more than 10 with a severe drop */
            prevPastTrendCount = 10;

            if (resultsEMA.length >= 10) {
                trendCalculator = 0;
                for (
                    let i = resultsEMA.length - prevPastTrendCount;
                    i < resultsEMA.length;
                    i++
                ) {
                    trendCalculator += Number(resultsEMA[i]['trend']);
                }

                /* These are locked advice events, BTW, specific to a bot locked to this coin. */
                /* -7.5 is arbitrary but represents a pretty severe drop (3/4) */
                if (trendCalculator < -7.5) {
                    /* Do not buy. Trend is too downward atm. Send results back immediately, which should be to sell this coin immediately. */
                    tradeSellPercentage = 1;

                    return {
                        tradeBuy: tradeBuyPercentage,
                        tradeSell: tradeSellPercentage,
                        coinStatus: COIN_STATUS.CRASHING,
                        coinAdvice: COIN_ADVICE.IMMEDIATE_SELL,
                        initialClose: currClosePrice,
                    };
                } else if (trendCalculator < -5) {
                    /* If we're somehow holding onto coin, we need to tell the bot to sell if we haven't already. This would only come into play if we were holding onto coin long-term despite a decent dip, a rise, and then another dip. Usually, stop loss should take care of this. */

                    tradeSellPercentage = 0.75;
                    return {
                        tradeBuy: tradeBuyPercentage,
                        tradeSell: tradeSellPercentage,
                        coinStatus: COIN_STATUS.WOBBLING_DOWN,
                        coinAdvice: COIN_ADVICE.DEFINITE_SELL,
                        initialClose: currClosePrice,
                    };
                }
            }
        }
        /*
            We've taken care of the gradient trend (if it exists) and then worst case scenarios.

            Next we calculate coin advice.
        */

        let coin_advice = null;

        /* If we want to sell, but the buy indicator is very high, we don't */
        if (
            tradeSellPercentage > 0.35 &&
            tradeSellPercentage < 0.75 &&
            tradeBuyPercentage >= 0.75
        ) {
            coin_advice = COIN_ADVICE.HOLD;
        } else if (tradeSellPercentage > 0.25) {
            coin_advice = COIN_ADVICE.POSSIBLE_SELL;
        } else if (tradeSellPercentage > 0.5) {
            coin_advice = COIN_ADVICE.DEFINITE_SELL;
        } else if (tradeBuyPercentage < 0.5) {
            coin_advice = COIN_ADVICE.HOLD;
        } else if (tradeBuyPercentage >= 0.5) {
            coin_advice = COIN_ADVICE.POSSIBLE_BUY;
        } else if (tradeBuyPercentage >= 0.75) {
            coin_advice = COIN_ADVICE.DEFINITE_BUY;
        }

        return {
            tradeBuy: tradeBuyPercentage,
            tradeSell: tradeSellPercentage,
            coinStatus: coin_status,
            coinAdvice: coin_advice,
            initialClose: currClosePrice,
        };
    }
}
module.exports = GeneralTrendAdvice;
