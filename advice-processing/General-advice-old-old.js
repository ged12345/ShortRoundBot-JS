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
        let CloseCurrPercentageChange = Number(
            currResultsTrends['close_per_change3']
        );

        let CloseCurr1And2PercentageChange =
            Number(currResultsTrends['close_per_change3']) +
            Number(currResultsTrends['close_per_change2']);

        let CloseTotalPercentageChange =
            Number(currResultsTrends['close_per_change1']) +
            Number(currResultsTrends['close_per_change2']) +
            Number(currResultsTrends['close_per_change3']);

        let CloseTotalChangeAllAveraged = (CloseTotalPercentageChange + CloseCurr1And2PercentageChange * 3 + CloseCurrPercentageChange * 5) / 9.0;

        console.log(
            Number(currResultsTrends['close_per_change1']),
            Number(currResultsTrends['close_per_change2']),
            Number(currResultsTrends['close_per_change3']),
            CloseCurrPercentageChange ,
            CloseCurr1And2PercentageChange,
            CloseTotalPercentageChange,
            CloseTotalChangeAllAveraged
        );

        let RSICurrPercentageChange = Number(
            currResultsTrends['RSI_per_change3']
        );

        let RSICurr1And2PercentageChange =
            Number(currResultsTrends['RSI_per_change3']) +
            Number(currResultsTrends['RSI_per_change2']);

        let RSITotalPercentageChange =
            Number(currResultsTrends['RSI_per_change1']) +
            Number(currResultsTrends['RSI_per_change2']) +
            Number(currResultsTrends['RSI_per_change3']);

        let RSITotalChangeAllAveraged = (RSITotalPercentageChange + RSICurr1And2PercentageChange * 3 + RSICurrPercentageChange * 5) / 9.0;

        let StochCurrPercentageChange = Number(
            currResultsTrends['Stoch_per_change3']
        );

        let StochCurr1And2PercentageChange =
            Number(currResultsTrends['Stoch_per_change3']) +
            Number(currResultsTrends['Stoch_per_change2']);

        let StochTotalPercentageChange =
            Number(currResultsTrends['Stoch_per_change1']) +
            Number(currResultsTrends['Stoch_per_change2']) +
            Number(currResultsTrends['Stoch_per_change3']);

        let StochTotalChangeAllAveraged = (StochTotalPercentageChange + StochCurr1And2PercentageChange * 3 + StochCurrPercentageChange * 5) / 9.0;

        let PerBCurrPercentageChange = Number(
            currResultsTrends['PerB_per_change3']
        );

        let PerBCurr1And2PercentageChange =
            Number(currResultsTrends['PerB_per_change3']) +
            Number(currResultsTrends['PerB_per_change2']);

        let PerBTotalPercentageChange =
            Number(currResultsTrends['PerB_per_change1']) +
            Number(currResultsTrends['PerB_per_change2']) +
            Number(currResultsTrends['PerB_per_change3']);

        let PerBTotalChangeAllAveraged = (PerBTotalPercentageChange + PerBCurr1And2PercentageChange * 3 + PerBCurrPercentageChange * 5) / 9.0;

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
            CloseTotalChangeAllAveraged < -0.5
        ) {
            tradeSellPercentage = 95;
        } else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.CRASHING &&
            CloseTotalChangeAllAveraged < -0.45
        ) {
            tradeSellPercentage = 90;
        } else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.CRASHING &&
            CloseTotalChangeAllAveraged < -0.4
        ) {
            tradeSellPercentage = 85;
        } else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.CRASHING &&
            CloseTotalChangeAllAveraged < -0.35
        ) {
            tradeSellPercentage = 80;
        } else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.CRASHING &&
            CloseTotalChangeAllAveraged < - 0.25
        ) {
            tradeSellPercentage = 70;
        } else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.CRASHING &&
           CloseTotalChangeAllAveraged< -0.2
        ) {
            tradeSellPercentage = 60;
        } else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.DROPPING_DOWN &&
            CloseTotalChangeAllAveraged < -0.15
        ) {
            tradeSellPercentage = 75;
        } else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.DROPPING_DOWN &&
            CloseTotalChangeAllAveraged < -0.125
        ) {
            tradeSellPercentage = 70;
        } else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.DROPPING_DOWN &&
            CloseTotalChangeAllAveraged < -0.1
        ) {
            tradeSellPercentage = 65;
        } else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.DROPPING_DOWN &&
            CloseTotalChangeAllAveraged < -0.075
        ) {
            tradeSellPercentage = 60;
        } else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.DROPPING_DOWN &&
            CloseTotalChangeAllAveraged < -0.05
        ) {
            tradeSellPercentage = 55;
        } else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.DROPPING_DOWN &&
            CloseTotalChangeAllAveraged< -0.025
        ) {
            tradeSellPercentage = 50;
        } else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.DROPPING_DOWN &&
            CloseTotalChangeAllAveraged < -0.01
        ) {
            tradeSellPercentage = 40;
        } else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.DROPPING_DOWN &&
            CloseTotalChangeAllAveraged < 0
        ) {
            tradeSellPercentage = 30;
        }

        if (
            currResultsTrends['close_shape'] === TREND_SHAPE.CRASHING &&
            CloseCurr1And2PercentageChange < -1
        ) {
            tradeSellPercentage += 50;
        } else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.CRASHING &&
            CloseCurr1And2PercentageChange < -0.5
        ) {
            tradeSellPercentage += 40;
        } else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.CRASHING &&
            CloseCurr1And2PercentageChange < -0.25
        ) {
            tradeSellPercentage += 45;
        } else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.CRASHING &&
            CloseCurr1And2PercentageChange < -0.1
        ) {
            tradeSellPercentage += 30;
        } /* Added these last two - may be messing us up */ else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.CRASHING &&
            CloseCurr1And2PercentageChange < -0.05
        ) {
            tradeSellPercentage += 25;
        } else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.CRASHING &&
            CloseCurr1And2PercentageChange < -0.025
        ) {
            tradeSellPercentage += 20;
        } else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.CRASHING &&
            CloseCurr1And2PercentageChange < -0.0125
        ) {
            tradeSellPercentage += 15;
        }

        if (
            currResultsTrends['close_shape'] === TREND_SHAPE.DROPPING_DOWN &&
            CloseCurr1And2PercentageChange < -1
        ) {
            tradeSellPercentage += 40;
        } else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.DROPPING_DOWN &&
            CloseCurr1And2PercentageChange < -0.5
        ) {
            tradeSellPercentage += 30;
        } else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.DROPPING_DOWN &&
            CloseCurr1And2PercentageChange < -0.25
        ) {
            tradeSellPercentage += 25;
        } else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.DROPPING_DOWN &&
            CloseCurr1And2PercentageChange < -0.1
        ) {
            tradeSellPercentage += 20;
        } /* Added these last two - may be messing us up */ else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.DROPPING_DOWN &&
            CloseCurr1And2PercentageChange < -0.05
        ) {
            tradeSellPercentage += 15;
        } else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.DROPPING_DOWN &&
            CloseCurr1And2PercentageChange < -0.025
        ) {
            tradeSellPercentage += 10;
        } else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.DROPPING_DOWN &&
            CloseCurr1And2PercentageChange < -0.0125
        ) {
            tradeSellPercentage += 5;
        }
        
        
        if (
            currResultsTrends['close_shape'] === TREND_SHAPE.CRASHING &&
            CloseCurrPercentageChange < -1
        ) {
            tradeSellPercentage += 50;
        } else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.CRASHING &&
            CloseCurrPercentageChange < -0.5
        ) {
            tradeSellPercentage += 40;
        } else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.CRASHING &&
            CloseCurrPercentageChange < -0.25
        ) {
            tradeSellPercentage += 45;
        } else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.CRASHING &&
            CloseCurrPercentageChange < -0.1
        ) {
            tradeSellPercentage += 30;
        } /* Added these last two - may be messing us up */ else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.CRASHING &&
            CloseCurrPercentageChange < -0.05
        ) {
            tradeSellPercentage += 25;
        } else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.CRASHING &&
            CloseCurrPercentageChange < -0.025
        ) {
            tradeSellPercentage += 20;
        } else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.CRASHING &&
            CloseCurrPercentageChange < -0.0125
        ) {
            tradeSellPercentage += 15;
        }

        if (
            currResultsTrends['close_shape'] === TREND_SHAPE.DROPPING_DOWN &&
            CloseCurrPercentageChange < -1
        ) {
            tradeSellPercentage += 40;
        } else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.DROPPING_DOWN &&
            CloseCurrPercentageChange < -0.5
        ) {
            tradeSellPercentage += 30;
        } else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.DROPPING_DOWN &&
            CloseCurrPercentageChange < -0.25
        ) {
            tradeSellPercentage += 25;
        } else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.DROPPING_DOWN &&
            CloseCurrPercentageChange < -0.1
        ) {
            tradeSellPercentage += 20;
        } /* Added these last two - may be messing us up */ else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.DROPPING_DOWN &&
            CloseCurrPercentageChange < -0.05
        ) {
            tradeSellPercentage += 15;
        } else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.DROPPING_DOWN &&
            CloseCurrPercentageChange < -0.025
        ) {
            tradeSellPercentage += 10;
        } else if (
            currResultsTrends['close_shape'] === TREND_SHAPE.DROPPING_DOWN &&
            CloseCurrPercentageChange < -0.0125
        ) {
            tradeSellPercentage += 5;
        }

        console.log('Trade Buy1: ', tradeBuyPercentage);
        console.log('Trade Sell1: ', tradeSellPercentage);

        /* Buy percentages */
        if (CloseTotalChangeAllAveraged > 0.5) {
            tradeBuyPercentage += 60;
        } else if (CloseTotalChangeAllAveraged > 0.3) {
            tradeBuyPercentage += 55;
        } else if (CloseTotalChangeAllAveraged > 0.25) {
            tradeBuyPercentage += 50;
        } else if (CloseTotalChangeAllAveraged > 0.2) {
            tradeBuyPercentage += 45;
        } else if (CloseTotalChangeAllAveraged> 0.15) {
            tradeBuyPercentage += 40;
        } else if (CloseTotalChangeAllAveraged > 0.125) {
            tradeBuyPercentage += 35;
        } else if (CloseTotalChangeAllAveraged > 0.1) {
            tradeBuyPercentage += 30;
        } else if (CloseTotalChangeAllAveraged > 0.075) {
            tradeBuyPercentage += 20;
        } else if (CloseTotalChangeAllAveraged > 0.05) {
            tradeBuyPercentage += 10;
        }

        console.log('Trade Buy2: ', tradeBuyPercentage);
        console.log('Trade Sell2: ', tradeSellPercentage);

        /* Our buy percentage is low, and the first or first and second together is going up, let's pump up the buy percentage */
        /*if (tradeBuyPercentage < 30) {
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
        }*/

        console.log('Close part total:', CloseTotalPercentageChange);
        console.log('Close part 1+2:', CloseCurr1And2PercentageChange);
        console.log('Close part 1:', CloseCurrPercentageChange);
        console.log('Close Total All Ave.:', CloseTotalChangeAllAveraged);
        console.log('Trade Buy: ', tradeBuyPercentage);
        console.log('Trade Sell: ', tradeSellPercentage);
        //console.log(currResultsTrends);

        /* MACD */
        /* If the MACD histogram percentage change is currently negative */
        
        if (MACDTotalPercentageChange > 25) {
            tradeBuyPercentage += 40;
        } else if (MACDTotalPercentageChange > 20) {
            tradeBuyPercentage += 30;
        } else if (MACDTotalPercentageChange > 15) {
            tradeBuyPercentage += 25;
        } else if (MACDTotalPercentageChange > 10) {
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
        if (MACDTotalPercentageChange < -25) {
            tradeSellPercentage += 40;
        } else if (MACDTotalPercentageChange < -20) {
            tradeSellPercentage += 30;
        } else if (MACDTotalPercentageChange < -15) {
            tradeSellPercentage += 25;
        } else if (MACDTotalPercentageChange < -10) {
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

        if (RSITotalChangeAllAveraged > 50) {
            tradeBuyPercentage += 50;
        } else if (RSITotalChangeAllAveraged > 40) {
            tradeBuyPercentage += 45;
        } else if (RSITotalChangeAllAveraged > 30) {
            tradeBuyPercentage += 40;
        } else if (RSITotalChangeAllAveraged > 25) {
            tradeBuyPercentage += 35;
        } else if (RSITotalChangeAllAveraged > 20) {
            tradeBuyPercentage += 30;
        } else if (RSITotalChangeAllAveraged > 15) {
            tradeBuyPercentage += 25;
        } else if (RSITotalChangeAllAveraged > 10) {
            tradeBuyPercentage += 20;
        }  else if (RSITotalChangeAllAveraged > 5) {
            tradeBuyPercentage += 15;
        } else if (RSITotalChangeAllAveraged > 2.5) {
            tradeBuyPercentage += 10;
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
       /* if (StochTotalPercentageChange > 40) {
            tradeBuyPercentage += 10;
        } else if (StochTotalPercentageChange > 25) {
            tradeBuyPercentage += 7.5;
        } else if (StochTotalPercentageChange > 15) {
            tradeBuyPercentage += 5;
        } else if (StochTotalPercentageChange > 10) {
            tradeBuyPercentage += 2.5;
        }*/

        if (StochTotalChangeAllAveraged > 60) {
            tradeBuyPercentage += 60;
        } else if (StochTotalChangeAllAveraged > 50) {
            tradeBuyPercentage += 55;
        } else if (StochTotalChangeAllAveraged > 40) {
            tradeBuyPercentage += 50;
        } else if (StochTotalChangeAllAveraged  > 30) {
            tradeBuyPercentage += 45;
        }  else if (StochTotalChangeAllAveraged  > 20) {
            tradeBuyPercentage += 40;
        } else if (StochTotalChangeAllAveraged  > 15) {
            tradeBuyPercentage += 35;
        }else if (StochTotalChangeAllAveraged  > 10) {
            tradeBuyPercentage += 30;
        } else if (StochTotalChangeAllAveraged  > 5) {
            tradeBuyPercentage += 20;
        } else if (StochTotalChangeAllAveraged  > 2.5) {
            tradeBuyPercentage += 10;
        } 

        console.log('Stoch 1:', Number(currResultsTrends['Stoch_per_change1']));
        console.log('Stoch 2:', Number(currResultsTrends['Stoch_per_change2']));
        console.log('Stoch 3:', Number(currResultsTrends['Stoch_per_change3']));

        console.log('Stoch part total:', StochTotalPercentageChange);
        console.log('Stoch part 1+2:', StochCurr1And2PercentageChange);
        console.log('Stoch part 1:', StochCurrPercentageChange);
        console.log('Close Total All Ave.:', StochTotalChangeAllAveraged);
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
            tradeBuyPercentage += 50;
            tradeSellPercentage += 50;
        }
        else if (
            currPerB > 97.5 &&
            CloseCurr1And2PercentageChange > 0 &&
            CloseCurrPercentageChange > 0
        ) {
            tradeBuyPercentage -= 50;
            tradeSellPercentage += 50;
        } else {
            /* Note: We should only add these other metrics if the two cases above do not occur. When we hit hte top of a PerB range and the trend is already upward, we really want to stamp down on buying.

            /* Bollinginger - PerB */
            /*if (PerBTotalPercentageChange > 40) {
                tradeBuyPercentage += 30;
            } else if (PerBTotalPercentageChange > 25) {
                tradeBuyPercentage += 15;
            } else if (PerBTotalPercentageChange > 15) {
                tradeBuyPercentage += 10;
            } else if (PerBTotalPercentageChange > 10) {
                tradeBuyPercentage += 5;
            }*/

            if (PerBTotalChangeAllAveraged > 60) {
                tradeBuyPercentage += 60;
            } else if (PerBTotalChangeAllAveraged > 50) {
                tradeBuyPercentage += 55;
            } else if (PerBTotalChangeAllAveraged > 40) {
                tradeBuyPercentage += 50;
            } else if (PerBTotalChangeAllAveraged > 30) {
                tradeBuyPercentage += 45;
            } else if (PerBTotalChangeAllAveraged > 20) {
                tradeBuyPercentage += 40;
            } else if (PerBTotalChangeAllAveraged > 15) {
                tradeBuyPercentage += 35;
            } else if (PerBTotalChangeAllAveraged > 10) {
                tradeBuyPercentage += 30;
            } else if (PerBTotalChangeAllAveraged > 5) {
                tradeBuyPercentage += 20;
            }  else if (PerBTotalChangeAllAveraged > 2.5) {
                tradeBuyPercentage += 10;
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
        } else if (tradeSellPercentage >= 90) {
            coinAdvice = COIN_ADVICE.IMMEDIATE_SELL;
        } else if (tradeSellPercentage > 80) {
            coinAdvice = COIN_ADVICE.POSSIBLE_SELL;
        } else if (tradeBuyPercentage < 60 && tradeSellPercentage > 70) {
            coinAdvice = COIN_ADVICE.POSSIBLE_SELL;
        } else if (tradeBuyPercentage < 40 && tradeSellPercentage > 60) {
            coinAdvice = COIN_ADVICE.POSSIBLE_SELL;
        }/* Maybe - test this out */
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
}
module.exports = GeneralTrendAdvice;
