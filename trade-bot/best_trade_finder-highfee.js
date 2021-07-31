const API = require('../utils/api.js');
const eventConstants = require('./constants.js').BOT_EVENT;
const coinAdviceConstants = require('../coin-bot/constants.js').COIN_ADVICE;
const Exchange = require('../exchanges/exchange.js');

class BestTradeFinder {
    constructor(type) {
        /* Init the Exchange object */
        this.exchange = new Exchange();
        this.exchange.setCurrent('kraken');
        this.exchange.curr.initApi(
            'xqqQr3bPDV7UoYMIp7VxdKNL/qNCJGa4x46AKds8b80N6m20MclDUL9g',
            'FWcXq02U6hLCFqMDrltZfDufY9cv+zoTCpnu1715ugQxRB1D94vPtL2BaXE0ZqBB8RZxkVGCPUs3VQP+IkBcLw==',
            'Jinxed80!!Jinxed80!!'
        );

        this.wageredFloat = 10.0;
        this.state = eventConstants.SEEKING_COIN;
        this.exchangeCoinId = 'XXBTZUSD';

        this.botId = 1;

        this.filledOrder = false;
        this.partFilledOrder = false;

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

        /* Here we attempt a limit order 2/3 of the way towards the lowest price of this minute. Note: Will this keep being updated over this minute? We will have to re-check in a loop */

        /* Here we're looking for the best price to buy coin at */
        this.exchange.curr.OHLC(this.exchangeCoinId, 1, async (resultOHLC) => {
            this.exchange.curr.ticker(
                this.exchangeCoinId,
                async (resultTicker) => {
                    let currOhlcResult =
                        resultOHLC[this.exchangeCoinId].reverse();
                    //console.log(currOhlcResult[0]);
                    //console.log(resultTicker);
                    let currAsk = Number(resultTicker['a']);
                    let currBid = Number(resultTicker['b']);

                    /* We also need to check bid/ask spread as well via ticker */
                    let currClose = Number(currOhlcResult[0][4]);
                    let currLowest = Number(currOhlcResult[0][3]);
                    let currHighest = Number(currOhlcResult[0][2]);

                    let proMakerTimeFactor = 4;
                    /* Period to try and fill an order for */
                    let thirdRemainingPeriod = (60 - currSeconds) / 3.0;
                    let timeToWait1 =
                        currSeconds + thirdRemainingPeriod + proMakerTimeFactor;
                    let timeToWait2 =
                        currSeconds +
                        thirdRemainingPeriod * 2 -
                        proMakerTimeFactor;
                    let timeToWait3 = 58;

                    /* Check and see how big a spread between high and low - If this is bigger than a certain percentage, we aim for half of the highest to avoid trying to fill a price too high */

                    let priceRangeAmount = 0;

                    if (currHighest / currLowest - 1 > 0.01) {
                        priceRangeAmount =
                            (currHighest - currLowest / 2.0) / 3.0;
                    } else {
                        priceRangeAmount = (currHighest - currLowest) / 3.0;
                    }

                    if (type === 'buy') {
                        /* We try and drive the price to a 'Maker' price (we use the currBid price is this is lower than currLowest) */
                        var price1 =
                            currLowest - 0.1 > currBid
                                ? currBid - 0.1
                                : currLowest - 0.1;
                        var price2 = currLowest + priceRangeAmount;
                        var price3 = currLowest + priceRangeAmount * 2;
                    } else if (type === 'sell') {
                        /* We try and drive the price to a 'Taker' price (we use the currAsl price is this is higher than currHighest) */
                        var price1 =
                            currHighest + 0.1 < currAsk
                                ? currAsk + 0.1
                                : currHighest + 0.1;
                        var price2 = currHighest - priceRangeAmount;
                        var price3 = currHighest - priceRangeAmount * 2;
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
                        price2,
                        timeToWait3,
                        price3
                    );
                }
            );
        });

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
        let order1Complete = false;
        let order2Complete = false;
        let order3Complete = false;
        let orderVolObj = {
            order1Vol: 0,
            order2Vol: 0,
            order3Vol: 0,
            order1ExecVol: 0,
            order2ExecVol: 0,
            order3ExecVol: 0,
        };
        let order1TXID = '';
        let order2TXID = '';
        let order3TXID = '';

        let limitIndex = 0;

        console.log('Price 1 Lowest: ' + price1);
        console.log('Time 1 to Wait: ' + timeToWait1);
        console.log('Price 2 Lowest: ' + price2);
        console.log('Time 2 to Wait: ' + timeToWait2);
        console.log('Price 2 Lowest: ' + price2);
        console.log('Time 2 to Wait: ' + timeToWait2);

        //process.exit(1);

        while (
            (this.fullFilledOrder === false ||
                this.partFilledOrder === false) &&
            limitIndex < 80
        ) {
            /* How long we have left in this minute */
            let currSeconds = (Date.now() / 1000.0) % 60;
            console.log('Curr seconds: ' + currSeconds);

            if (order1Complete === false) {
                orderVolObj['order1Vol'] = this.wageredFloat / price1;

                console.log(price1.toFixed(1));
                console.log(orderVolObj['order1Vol']);

                this.exchange.curr.addOrder(
                    {
                        nonce: Date.now().toString(),
                        pair: this.exchangeCoinId,
                        ordertype: 'limit',
                        type: type,
                        volume: orderVolObj['order1Vol'].toFixed(8),
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
                currSeconds >= timeToWait1 &&
                this.partFilledOrder === false &&
                this.fullFilledOrder === false
            ) {
                this.exchange.curr.cancelAllOrders(() => {
                    orderVolObj['order2Vol'] = this.wageredFloat / price2;

                    /* Setup the second order */
                    this.exchange.curr.addOrder(
                        {
                            nonce: Date.now().toString(),
                            pair: this.exchangeCoinId,
                            ordertype: 'limit',
                            type: type,
                            volume: orderVolObj['order2Vol'].toFixed(8),
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
                });
            } else if (
                order2Complete === true &&
                order3Complete === false &&
                currSeconds >= timeToWait2 &&
                this.partFilledOrder === false &&
                this.fullFilledOrder === false
            ) {
                this.exchange.curr.cancelAllOrders(() => {
                    orderVolObj['order3Vol'] = this.wageredFloat / price3;

                    /* Setup the second order */
                    this.exchange.curr.addOrder(
                        {
                            nonce: Date.now().toString(),
                            pair: this.exchangeCoinId,
                            ordertype: 'limit',
                            type: type,
                            volume: orderVolObj['order3Vol'].toFixed(8),
                            price: price3.toFixed(1),
                        },
                        async (result) => {
                            order2TXID = result['txid'];
                            order2Complete = true;
                            console.log(
                                'Order 3 Complete: ' +
                                    price3 +
                                    ' ' +
                                    orderVolObj['order3Vol']
                            );
                        }
                    );
                });
            } else if (
                order3Complete === true &&
                currSeconds >= timeToWait3 &&
                (this.partFilledOrder === false ||
                    this.fullFilledOrder === false)
            ) {
                console.log('Cancel all orders and prepare market order.');
                /* Prepare a market order and cancel the two others */
                this.exchange.curr.cancelAllOrders(() => {
                    this.prepareMarketOrder(type, async () => {
                        this.state = eventConstants.FOUND_BEST_BUY;
                        this.fullFilledOrder = true;
                    });
                });
                break;
            }

            if (
                this.partFilledOrder === true ||
                this.fullFilledOrder === true
            ) {
                this.state = eventConstants.FOUND_BEST_BUY;
                break;
            }

            /* Wait two seconds */
            await new Promise((r) => setTimeout(r, 2000));

            /* Query orders to see if they've filled */

            if (order3Complete === true) {
                this.queryOrders(
                    order3Complete,
                    order3TXID,
                    orderVolObj,
                    'order3ExecVol',
                    async () => {}
                );
            } else if (order1Complete === true) {
                this.queryOrders(
                    order1Complete,
                    order1TXID,
                    orderVolObj,
                    'order1ExecVol',
                    async () => {}
                );
            } else if (order2Complete === true) {
                this.queryOrders(
                    order2Complete,
                    order2TXID,
                    orderVolObj,
                    'order2ExecVol',
                    async () => {}
                );
            }

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

                    if (orderVolObj[execVolId] > 0) {
                        /* Partly filled order on limit equal our desired amount.*/
                        console.log(
                            '1 partially filled order' + orderVolObj[execVolId]
                        );
                        this.partFilledOrder = true;
                        this.orderVolume = orderVolObj[execVolId];
                    } else if (result['vol'] === result['vol_exec']) {
                        console.log('Full order = filled: ' + this.orderVolume);
                        this.fullFilledOrder = true;
                        this.orderVolume = Number(result['vol_exec']);
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

            /* Initial purchase of coin */
            this.exchange.curr.addOrder(
                {
                    nonce: Date.now().toString(),
                    pair: this.exchangeCoinId,
                    ordertype: 'market',
                    type: type,
                    volume: `${(
                        this.orderVolume - (currVol === null ? 0 : currVol)
                    ).toFixed(8)}`,
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
