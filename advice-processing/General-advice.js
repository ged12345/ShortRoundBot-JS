const { COIN_STATUS, COIN_ADVICE } = require("../coin-bot/constants.js");

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
        let currClosePrice = resultsOHLC[resultsOHLC.length - 1]["close"];

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

        if (resultsEMA.length <= 5) {
            return false;
        }

        let coin_status = null;
        let trendCalculator = 0;
        let prevPastTrendCount = 3;
        for (
            let i = resultsEMA.length - prevPastTrendCount;
            i < resultsEMA.length;
            i++
        ) {
            trendCalculator += Number(
                resultsEMA[i + prevPastTrendCount]["trend"]
            );
        }

        const currRSI = resultsRSI[resultsRSI.length - 1]["RSI"];
        const currStoch =
            resultsStochastics[resultsStochastics.length - 1]["d_full"];

        const currUpperB = resultsBoll[resultsBoll.length - 1]["bol_u"];
        const currLowerB = resultsBoll[resultsBoll.length - 1]["bol_d"];

        const currEMA = resultsEMA[resultsEMA.length - 1]["EMA"];
        const oldEMA = resultsEMA[resultsEMA.length - 2]["EMA"];

        const currSMA = resultsEMA[resultsEMA.length - 1]["SMA"];
        const oldSMA = resultsEMA[resultsEMA.length - 2]["SMA"];

        /* 33 and 66 are the limits for RSI and Stoch */
        if (currRSI >= 90) {
            tradeBuyPercentage += 0.35;
            // For the higher levels, we take a bit from the sell or buy
            tradeSellPercentage -= 0.1;
        } else if (currRSI >= 80) {
            tradeBuyPercentage += 0.25;
        } else if (currRSI >= 66) {
            tradeBuyPercentage += 0.15;
        } else if (currRSI <= 33) {
            tradeSellPercentage += 0.15;
        } else if (currRSI <= 20) {
            tradeSellPercentage += 0.25;
        } else if (currRSI <= 10) {
            tradeSellPercentage += 0.35;
            // For the higher levels, we take a bit from the sell or buy
            tradeBuyPercentage -= 0.1;
        }

        if (currStoch >= 90) {
            tradeBuyPercentage += 0.35;
            // For the higher levels, we take a bit from the sell or buy
            tradeSellPercentage -= 0.1;
        } else if (currStoch >= 80) {
            tradeBuyPercentage += 0.25;
        } else if (currStoch >= 66) {
            tradeBuyPercentage += 0.15;
        } else if (currStoch <= 33) {
            tradeSellPercentage += 0.15;
        } else if (currStoch <= 20) {
            tradeSellPercentage += 0.25;
        } else if (currStoch <= 10) {
            tradeSellPercentage += 0.35;
            // For the higher levels, we take a bit from the sell or buy
            tradeBuyPercentage -= 0.1;
        }

        /* Current close price above or below corresponding Bollinger band */
        if (currClosePrice > currUpperB) {
            if (currClose / currUpperB - 1 < 0.003) {
                tradeBuyPercentage += 0.25;
                /* Bollinger above or below bands are somewhat strong signals */
                tradeSellPercentage -= 0.05;
            } else if (currClose / currUpperB - 1 >= 0.003) {
                tradeBuyPercentage += 0.35;
                /* Bollinger above or below bands are somewhat strong signals */
                tradeSellPercentage -= 0.75;
            }
        }
        if (currClosePrice < currLowerB) {
            if (currLowerB / currClosePrice - 1 < 0.003) {
                tradeSellPercentage += 0.25;
                /* Bollinger above or below bands are somewhat strong signals */
                tradeBuyPercentage -= 0.05;
            } else if (currLowerB / currClose - 1 >= 0.003) {
                tradeSellPercentage += 0.35;
                /* Bollinger above or below bands are somewhat strong signals */
                tradeBuyPercentage -= 0.75;
            }
        }

        if (oldEMA < oldSMA && currEMA > currSMA) {
            tradeBuyPercentage += 0.2;
        }
        if (oldEMA > oldSMA && currEMA < currSMA) {
            tradeSellPercentage += 0.2;
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
            tradeBuyPercentage += 0.25;
            coin_status = COIN_STATUS.SPIKING;
        }

        /* Let's check the trends for selling if we have more 10 with a severe drop */
        prevPastTrendCount = 10;

        if (resultsEMA.length >= 10) {
            trendCalculator = 0;
            for (
                let i = resultsEMA.length - prevPastTrendCount;
                i < resultsEMA.length;
                i++
            ) {
                console.log(resultsEMA[i]);
                trendCalculator += Number(resultsEMA[i]["trend"]);
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
        /*
            We've taken care of the gradient trend and then worst case scenarios.

            The next prat is the Bollinger band width.
        */

        let coin_advice = null;

        /* If we want to sell, but the buy indicator is very high, we don't */
        if (
            (tradeSellPercentage > 0.35 || tradeSellPercentage < 0.75) &&
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
