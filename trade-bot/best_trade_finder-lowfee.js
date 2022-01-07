const API = require('../utils/api.js');
const eventConstants = require('./constants.js').BOT_EVENT;
const coinAdviceConstants = require('../coin-bot/constants.js').COIN_ADVICE;
const Exchange = require('../exchanges/exchange.js');

class BestTradeFinder {
    constructor(type) {
        /* Init the Exchange object */
        this.exchange = new Exchange();
        /* Testet account (for testing)
            LmJXBHvH4O9iOuLfSL
            87e5mc5UORaI1G0t3K4v6rG1MYu1rwD2V5K5
        */
        this.exchange.setCurrent('kraken');
        this.exchange.curr.initApi(
            'xqqQr3bPDV7UoYMIp7VxdKNL/qNCJGa4x46AKds8b80N6m20MclDUL9g',
            'FWcXq02U6hLCFqMDrltZfDufY9cv+zoTCpnu1715ugQxRB1D94vPtL2BaXE0ZqBB8RZxkVGCPUs3VQP+IkBcLw==',
            'Jinxed80!!Jinxed80!!'
        );

        this.wageredFloat = 20.0;
        this.state = eventConstants.SEEKING_COIN;
        this.exchangeCoinId = 'XXBTZUSD';

        this.botId = 1;

        this.tradeStoreObject = {
            trade_id: null,
            trade_type: null,
            trade_volume: 0,
            trade_price: 0,
            coin_exchange_id: '',
            profit_loss: 0,
        };

        this.setupExchange();
        this.prepareOrder(type, 'XXBTZUSD');
    }

    /*constructor(botId, exchange, wageredFloat, tradeObject) {
        this.botId = botId;
        this.exchange = exchange;
        this.wagerFloat = wageredFloat;
        this.tradeStoreObject = {
            trade_id: null,
            trade_type: null,
            trade_volume: 0,
            trade_price: 0,
            coin_exchange_id: "",
            profit_loss: 0,
        };
    }*/

    async setupExchange() {
        this.exchange.curr.initApi(
            'xqqQr3bPDV7UoYMIp7VxdKNL/qNCJGa4x46AKds8b80N6m20MclDUL9g',
            'FWcXq02U6hLCFqMDrltZfDufY9cv+zoTCpnu1715ugQxRB1D94vPtL2BaXE0ZqBB8RZxkVGCPUs3VQP+IkBcLw==',
            'Jinxed80!!Jinxed80!!'
        );
    }

    prepareOrder(type, exchangeCoinId) {
        this.state = eventConstants.LOOKING_FOR_BEST_BUY;
        this.tradeStoreObject.trade_type = type;
        this.exchangeCoinId = this.tradeStoreObject.coin_exchange_id =
            exchangeCoinId;

        /* How long do we have left in this minute */
        let currSeconds = (Date.now() / 1000.0) % 60;

        /* If there's less than 10 seconds left, we perform a market price order */

        console.log(currSeconds);
        if (currSeconds >= 54) {
            console.log('MARKET ORDER PLACED!! Under 10 seconds left.');
            this.prepareMarketOrder(type, async (txid) => {
                /*API.addTradeRecord(botId, () => {
                    this.state = eventConstants.FOUND_BEST_SELL;
                });*/
            });
        } else {
            /* Here we attempt a limit order 2/3 of the way towards the lowest price of this minute. Note: Will this keep being updated over this minute? We will have to re-check in a loop */

            /* Here we're looking for the best price to buy coin at */
            this.exchange.curr.OHLC(this.exchangeCoinId, 1, async (result) => {
                let currOhlcResult = result[this.exchangeCoinId].reverse();
                console.log(currOhlcResult[0]);

                let currClose = Number(currOhlcResult[0][4]);
                let currLowest = Number(currOhlcResult[0][3]);
                let currHighest = Number(currOhlcResult[0][2]);

                if (Math.abs(currClose - currHighest) / currClose < 0.0002) {
                    /* Just do a market order if close and lowest are close */
                    console.log(
                        'MARKET ORDER PLACED!! ' +
                            currClose +
                            ' : ' +
                            currHighest
                    );
                    //process.exit(1);
                    this.prepareMarketOrder(type, async () => {
                        this.state = eventConstants.FOUND_BEST_BUY;
                    });
                } else {
                    /* Overview: Here we go into a loop. First we buy at the limit price, and then wait half the remaining time, waiting for it to be filled. If it's not, we then open an order 1/3 of the way towards the lowest price. If we're in the last 10 or so seconds, we cancel both orders and buy at market. */

                    /* Period to try and fill an order for */
                    let halfRemainingPeriod = (60 - currSeconds - 10) / 2.0;
                    let timeToWait1 = halfRemainingPeriod + currSeconds;
                    let timeToWait2 = halfRemainingPeriod * 2 + currSeconds;

                    /* Check and see how big a spread between high and low - If this is bigger than a certain percentage, we aim for half of the highest to avoid trying to fill a price too high */

                    let priceRangeAmount = 0;

                    if (currHighest / currLowest - 1 > 0.01) {
                        priceRangeAmount =
                            (currHighest - currLowest / 2.0) / 3.0;
                    } else {
                        priceRangeAmount = (currHighest - currLowest) / 3.0;
                    }

                    if (type === 'buy') {
                        var price1 = currLowest + priceRangeAmount;
                        var price2 = currLowest + priceRangeAmount * 2;
                    } else if (type === 'sell') {
                        var price1 = currHighest - priceRangeAmount;
                        var price2 = currHighest - priceRangeAmount * 2;
                    }

                    /* Next we:
                    1. Buy/sell the coin
                    2. Enter a loop where we query whether the order has filled completely
                    3. If the first order hasn't filled by the time we reach timeToWait1, we add order 2 and go back to looping until timeToWait2 has been reached. At this point, if neither has been filled, we cancel both, and then put in a market order. */

                    console.log('Wait for filled order.');

                    this.waitForFilledOrder(
                        type,
                        type === 'sell' ? 'take-profit' : 'limit',
                        timeToWait1,
                        price1,
                        timeToWait2,
                        price2
                    );
                }
            });
        }

        return;
    }

    async waitForFilledOrder(
        type,
        orderType,
        timeToWait1,
        price1,
        timeToWait2,
        price2
    ) {
        let filledFullOrder = false;
        let order1Complete = false;
        let order2Complete = false;
        let orderVolObj = {
            order1Vol: 0,
            order2Vol: 0,
            order1ExecVol: 0,
            order2ExecVol: 0,
        };
        let order1TXID = '';
        let order2TXID = '';

        let limitIndex = 0;

        console.log('Price 1 Lowest: ' + price1);
        console.log('Time 1 to Wait: ' + timeToWait1);
        console.log('Price 2 Lowest: ' + price2);
        console.log('Time 2 to Wait: ' + timeToWait2);

        //process.exit(1);

        while (filledFullOrder === false && limitIndex < 62) {
            /* How long we have left in this minute */
            let currSeconds = (Date.now() / 1000.0) % 60;
            console.log('Curr seconds: ' + currSeconds);

            if (order1Complete === false) {
                orderVolObj['order1Vol'] = this.wageredFloat / price1;

                this.exchange.curr.addOrder(
                    {
                        nonce: Date.now().toString(),
                        pair: this.exchangeCoinId,
                        ordertype: 'take-profit',
                        type: 'sell',
                        volume: orderVolObj['order1Vol'],
                        price: price1.toFixed(1),
                    },
                    async (result) => {
                        console.log(
                            'Order 1 Complete: ' +
                                price1 +
                                ' ' +
                                orderVolObj['order1Vol']
                        );
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
                orderVolObj['order2Vol'] = this.wageredFloat / price2;

                /* Setup the second order */
                this.exchange.curr.addOrder(
                    {
                        nonce: Date.now().toString(),
                        pair: this.exchangeCoinId,
                        ordertype: 'take-profit',
                        type: 'sell',
                        volume: orderVolObj['order2Vol'],
                        price: price2.toFixed(1),
                    },
                    async (result) => {
                        order2TXID = result['txid'];
                        order2Complete = true;
                        console.log(
                            'Order 2 Complete: ' +
                                price2 +
                                ' ' +
                                orderVolObj['order2Vol']
                        );
                    }
                );
            } else if (
                order1Complete === true &&
                order2Complete === true &&
                currSeconds > timeToWait2 &&
                filledFullOrder === false
            ) {
                filledFullOrder = true;

                console.log('Cancel all orders and prepare market order.');
                /* Prepare a market order and cancel the two others */
                this.exchange.curr.cancelAllOrders(() => {
                    this.prepareMarketOrder(
                        type,
                        async () => {
                            this.state = eventConstants.FOUND_BEST_BUY;
                        },
                        orderVolObj['order1Vol'] + orderVolObj['order2Vol']
                    );
                });
                break;
            }

            /* Wait one second */
            await new Promise((r) => setTimeout(r, 1000));

            /* Query orders to see if they've filled */
            this.queryOrders(
                order1Complete,
                order1TXID,
                orderVolObj,
                'order1ExecVol',
                async () => {
                    this.queryOrders(
                        order2Complete,
                        order2TXID,
                        orderVolObj,
                        'order2ExecVol',
                        async () => {}
                    );
                }
            );

            limitIndex++;
        }
    }

    queryOrders(orderComplete, orderTXID, orderVolObj, execVolId, cb) {
        if (orderComplete) {
            this.exchange.curr.queryOrders(
                this.exchangeCoinId,
                orderTXID,
                (result) => {
                    orderVolObj[execVolId] = Number(result['vol_exec']);

                    if (
                        orderVolObj['order1ExecVol'] +
                            orderVolObj['order2ExecVol'] >
                        (0.99975 *
                            (orderVolObj['order1Vol'] +
                                orderVolObj['order2Vol'])) /
                            2.0
                    ) {
                        /* Both orders filled enough to equal our desired amount. Cancel partly filled now */
                        console.log(
                            'Cancel all orders and 2 partial orders = full order: ' +
                                this.orderVolume
                        );
                        this.exchange.curr.cancelAllOrders(() => {
                            filledOrder = true;
                            this.orderVolume =
                                orderVolObj['order1ExecVol'] +
                                orderVolObj['order2ExecVol'];
                        });
                    } else if (result['vol'] === result['vol_exec']) {
                        /* Cancel order2 because order1 has completed */
                        console.log(
                            'Cancel all orders and full order = filled: ' +
                                this.orderVolume
                        );
                        this.exchange.curr.cancelAllOrders(() => {
                            filledOrder = true;
                            this.orderVolume = Number(result['vol_exec']);
                        });
                    }
                }
            );
        }
    }

    prepareMarketOrder(type, cb, currVol = null) {
        /* We grab the current ticker price */

        //cb();
        //return;
        /* TO-DO: Ticker - update this to take into account the simulated timestamp I've added */
        this.exchange.curr.ticker(this.exchangeCoinId, async (result) => {
            console.log('Ticker: ', result);
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
            this.orderVolume = this.wageredFloat / currentClosePrice;

            console.log(
                `Prepare order: ${currentBidPrice} ${currentAskPrice} ${topLimitPrice} ${bottomLimitPrice}`
            );

            console.log({
                pair: this.exchangeCoinId,
                ordertype: 'market',
                type: type,
                volume: `${(
                    this.orderVolume - (currVol === null ? 0 : currVol)
                ).toFixed(8)}`,
                nonce: Date.now().toString(),
            });

            /* Note: '0' on a sell specifies 'sell all coin' */
            let marketVolume = 0;

            /* On a market buy, if we already have some bitcoin purchased, we only purchase the remaining volume to fulfill our current oer with the wagered amount (takes into account not fully selling all our coin the previous round.)
            if (type === 'buy') {
                marketVolume = `${(
                    this.orderVolume - (currVol === null ? 0 : currVol)
                ).toFixed(8)}`;
            }

            /* Initial purchase of coin */
            this.exchange.curr.addOrder(
                {
                    nonce: Date.now().toString(),
                    pair: this.exchangeCoinId,
                    ordertype: 'market',
                    type: type,
                    volume: marketVolume,
                },
                async (result) => {
                    /* Take profit order (immediate sell at market price once we hit limit) for top limit price (actual limit trade may not be filled - we may do this later if not making enough, with monitoring) */
                    this.prepareStopLossTakeProfit();
                    cb(result['txid']);
                }
            );
            this.initialTradeTimestamp = Date.now();
        });
    }

    prepareStopLossTakeProfit() {
        /* Take profit order (immediate sell at market price once we hit limit) for top limit price (actual limit trade may not be filled - we may do this later if not making enough, with monitoring) */
        /*this.exchange.curr.addOrder(
            {
                nonce: Date.now().toString(),
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
                    nonce: Date.now().toString(),
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
}

var args = process.argv.slice(2);
let logic = new BestTradeFinder(args[0]);

module.exports = BestTradeFinder;
