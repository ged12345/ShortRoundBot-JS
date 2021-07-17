const Queuer = require('../utils/queuer.js').Queuer;
const Queue = require('../utils/queue.js');
const API = require('../utils/api.js');
const { encryptCodeIn, decryptAES } = require('../utils/general.js');
const eventConstants = require('./constants.js').BOT_EVENT;
const coinAdviceConstants = require('../coin-bot/constants.js').COIN_ADVICE;
const code = require('./constants.js').BOT_CODE['primer'];
const botNames = require('./constants.js').BOT_NAMES;
const {
    calculateSellUrgencyFactor,
    getRandomInt,
} = require('../utils/math.js');
const Exchange = require('../exchanges/exchange.js');

class MainLogic {
    // Need to "lock" bot when new info comes in.

    constructor() {
        /* Init the Exchange object */
        this.exchange = new Exchange();
        this.exchange.setCurrent('kraken');

        this.wageredFloat = 1.0;
        this.state = eventConstants.SEEKING_COIN;

        this.exchangeCoinId = 'XXBTZUSD';

        this.setupExchange();
        this.prepareOrder();
    }

    async setupExchange() {
        this.exchange.curr.initApi(
            'xqqQr3bPDV7UoYMIp7VxdKNL/qNCJGa4x46AKds8b80N6m20MclDUL9g',
            'FWcXq02U6hLCFqMDrltZfDufY9cv+zoTCpnu1715ugQxRB1D94vPtL2BaXE0ZqBB8RZxkVGCPUs3VQP+IkBcLw==',
            'Jinxed80!!Jinxed80!!'
        );
    }

    prepareOrder() {
        this.state = eventConstants.LOOKING_FOR_BEST_BUY;

        /* How long do we have left in this minute */
        let currSeconds = Date.now() % 60;

        /* If there's less than 10 seconds left, we perform a market price order */
        if (currSeconds >= 10) {
            this.prepareMarketOrder(async () => {
                this.state = eventConstants.FOUND_BEST_BUY;
            });
        } else {
            /* Here we attempt a limit order 2/3 of the way towards the lowest price of this minute. Note: Will this keep being updated over this minute? We will have to re-check in a loop */

            /* Here we're looking for the best price to buy coin at */
            this.exchange.curr.OHLC(this.exchangeCoinId, 1, async (result) => {
                let currOhlcResult = result[this.exchangeCoinId].reverse();
                console.log(ohlcResult[0]);

                let currClose = Number(ohlcResult[0][3]);
                let currLowest = Number(ohlcResult[0][2]);
                let currHighest = Number(ohlcResult[0][2]);

                if (Math.abs(currClose - currLowest) < 4) {
                    /* Just do a market order if close and lowest are close */
                    this.prepareMarketOrder(async () => {
                        this.state = eventConstants.FOUND_BEST_BUY;
                    });
                } else {
                    /* Overview: Here we go into a loop. First we buy at the limit price, and then wait half the remaining time, waiting for it to be filled. If it's not, we then open an order 1/3 of the way towards the lowest price. If we're in the last 10 or so seconds, we cancel both orders and buy at market. */

                    /* Period to try and fill an order for */
                    let halfRemainingPeriod = (60 - currSeconds - 10) / 2.0;
                    let timeToWait1 = halfRemainingPeriod + currSeconds;
                    let timeToWait2 = halfRemainingPeriod * 2 + currSeconds;

                    /* Check and see how big a spread between high and low - If this is bigger than a certain percentage, we aim for half of the highest to avoid trying to fill a price too high */

                    if (currHighest / currLowest - 1 > 0.01) {
                        var lowestPriceRangeAmount =
                            (currHighest - currLowest / 2.0) / 3.0;
                        var lowestPrice1 = currLowest + lowestPriceRangeAmount;
                        var lowestPrice2 =
                            currLowest + lowestPriceRangeAmount * 2;
                    } else {
                        var lowestPriceRangeAmount =
                            (currHighest - currLowest) / 3.0;
                        var lowestPrice1 = currLowest + lowestPriceRangeAmount;
                        var lowestPrice2 =
                            currLowest + lowestPriceRangeAmount * 2;
                    }

                    /* Next we:
                    1. Buy the coin
                    2. Enter a loop where we query whether the order has filled completely
                    3. If the first order hasn't filled by the time we reach timeToWait1, we add order 2 and go back to looping until timeToWait2 has been reached. At this point, if neither has been filled, we cancel both, and then put in a market order. */

                    waitForFilledBuyOrder(
                        timeToWait1,
                        lowestPrice1,
                        timeToWait2,
                        lowestPrice2
                    );
                }

                process.exit(1);
            });
        }

        return;
    }

    waitForFilledBuyOrder(
        timeToWait1,
        lowestPrice1,
        timeToWait2,
        lowestPrice2
    ) {
        let filledFullOrder = false;
        let order1Complete = false;
        let order2Complete = false;
        let order1Vol = 0;
        let order2Vol = 0;
        let order1ExecVol = 0;
        let order2ExecVol = 0;
        let order1TXID = '';
        let order2TXID = '';

        while (filledOrder === false) {
            /* How long do we have left in this minute */
            let currSeconds = Date.now() % 60;

            if (order1Complete === false) {
                this.exchange.curr.addOrder(
                    {
                        pair: this.exchangeCoinId,
                        ordertype: 'limit',
                        type: 'buy',
                        volume: this.orderVolume,
                        lowestPrice1,
                    },
                    async (result) => {
                        order1TXID = result['txid'];
                        order1Complete = true;
                    }
                );
            } else if (
                order1Complete === true &&
                order2Complete === false &&
                currSeconds > timeToWait1 &&
                filledFullOrder === false
            ) {
                /* Setup the second order */
                this.exchange.curr.addOrder(
                    {
                        pair: this.exchangeCoinId,
                        ordertype: 'limit',
                        type: 'buy',
                        volume: this.orderVolume,
                        lowestPrice2,
                    },
                    async (result) => {
                        order2TXID = result['txid'];
                        order2Complete = true;
                    }
                );
            } else if (
                order1Complete === true &&
                order2Complete === true &&
                currSeconds > timeToWait2 &&
                filledFullOrder === false
            ) {
                /* Prepare a market order and cancel the two others */
                this.prepareMarketOrder(async () => {
                    this.state = eventConstants.FOUND_BEST_BUY;
                    filledFullOrder = true;
                    break;
                });
            }

            /* Wait one second */
            await new Promise((r) => setTimeout(r, 1000));

            /* Query orders to see if they've completed */
            if (order1Complete) {
                this.exchange.curr.queryOrders(
                    this.exchangeCoinId,
                    order1TXID,
                    (result) => {
                        order1ExecVol = Number(result['vol_exec']);

                        if (order1ExecVol + order2ExecVol > (order1Vol + order2Vol) / 2.0) {
                            /* Both orders filled enough to equal our desired amount. Cancel partly filled now */
                            filledOrder = true;
                        }
                        else if (result['vol'] === result['vol_exec']) {
                            /* Cancel order2 */
                            filledOrder = true;
                        }
                    }
                );
            } else if (order2Complete) {
                this.exchange.curr.queryOrders(
                    this.exchangeCoinId,
                    order2TXID,
                    (result) => {
                        if (order1ExecVol + order2ExecVol > (order1Vol + order2Vol) / 2.0) {
                            /* Both orders filled enough to equal our desired amount. Cancel partly filled now */
                            filledOrder = true;
                        }
                        else if (result['vol'] === result['vol_exec']) {
                            /* Cancel order1 */
                            filledOrder = true;
                        }
                    }
                );
            }
        }
    }

    prepareMarketOrder(cb) {
        /* We grab the current ticker price */

        /* TO-DO: Ticker - update this to take into account the simulated timestamp I've added */
        this.exchange.curr.ticker(this.exchangeCoinId, async (result) => {
            console.log(result);
            /* Bid price is highest price asked atm */
            let currentBidPrice = Number(result['b']);
            let currentAskPrice = Number(result['a']);
            let currentClosePrice = Number(result['c']);
            let topLimitPrice = currentBidPrice * 1.003; // 0.3%
            let bottomLimitPrice = currentAskPrice * 0.9975; // 0.25%

            this.takeProfitPrice = topLimitPrice;
            this.stopLossPrice = bottomLimitPrice;
            this.orderPrice = currentClosePrice;
            this.newTrackTradeClosePrice = this.orderPrice;

            /* Let's calculate the volume based on our float and current price */
            this.orderVolume = currentClosePrice / this.wageredFloat;

            console.log(
                `Prepare order: ${currentBidPrice} ${currentAskPrice} ${topLimitPrice} ${bottomLimitPrice}`
            );

            /* Initial purchase of coin */
            this.exchange.curr.addOrder(
                {
                    pair: this.exchangeCoinId,
                    ordertype: 'market',
                    type: 'buy',
                    volume: this.orderVolume,
                },
                async (result) => {
                    /* Take profit order (immediate sell at market price once we hit limit) for top limit price (actual limit trade may not be filled - we may do this later if not making enough, with monitoring) */
                    prepareStopLossTakeProfit();
                }
            );
            this.initialTradeTimestamp = Date.now();
            cb();
        });
    }

    prepareStopLossTakeProfit() {
        /* Take profit order (immediate sell at market price once we hit limit) for top limit price (actual limit trade may not be filled - we may do this later if not making enough, with monitoring) */
        /*this.exchange.curr.addOrder(
            {
                pair: this.exchangeCoinId,
                ordertype: 'take-profit',
                type: 'sell',
                volume: this.orderVolume,
                price: topLimitPrice,
            },
            async (result) => {
                this.takeProfitTXID = result['txid'];

                /* Take stop loss for bottom limit price */
        /*this.exchange.curr.addOrder(
                {
                    pair: this.exchangeCoinId,
                    ordertype: 'stop-loss',
                    type: 'sell',
                    volume: this.orderVolume,
                    price: bottomLimitPrice,
                },
                async (result) => {
                    this.stopLossTXID = result['txid'];
                }
            );
            }
        );*/
    }

    sellEarly() {
        this.exchange.curr.addOrder(
            {
                pair: this.exchangeCoinId,
                ordertype: 'market',
                type: 'sell',
                volume: this.orderVolume,
            },
            async (result) => {
                /* We cancel the other orders */
                this.cancelOrders();
            }
        );
    }

    cancelOrders() {
        if (this.takeProfitTXID !== '') {
            this.exchange.curr.cancelOrder(
                this.exchangeCoinId,
                this.takeProfitTXID,
                async (result) => {}
            );
        } else if (this.stopLossTXID !== '') {
            this.exchange.curr.cancelOrder(
                this.exchangeCoinId,
                this.stopLossTXID,
                async (result) => {}
            );
        }
    }
}

let logic = new MainLogic();
