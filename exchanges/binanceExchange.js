class BinanceExchange {
    constructor() {
        this.api = null;
    }

    /* Make sure every exchange class has the same unterface */
    initApi(apiKey, privApiKey, twoFaPass) {
        /* Initialise Binance API */
        // NO 2fa? Check this.
        const Binance = require('../coin-bot/node_modules/node-binance-api');
        this.api = new Binance().options({
            APIKEY: apiKey,
            APISECRET: privApiKey,
        });

        // TODO!
        // https://www.npmjs.com/package/node-binance-api
        // node-binance-api
    }

    OHLC(coinPair, interval, cb) {
        this.api.candlesticks(
            coinPair,
            `${interval}m`,
            (error, ticks, symbol) => {
                //console.info("candlesticks()", ticks);

                /* The timestamp is 1514764800000, which is longer (remove last 3 characters to match the Kraken format */
                for (var index = 0; index < ticks.length; index++) {
                    ticks[index][0] = ticks[index][0].slice(0, -3);
                }

                cb(ticks);
                /* Limit to 60 intervals */
            },
            { limit: 60 }
        );
    }

    ticker(coinPair, cb) {
        let closeAskBid = {
            a: 0,
            b: 0,
            c: 0,
        };

        this.api.prices(coinPair, (error, ticker) => {
            //console.info("Price of BNB: ", ticker.BNBBTC);
            closeAskBid['c'] = ticker.price;
            this.api.bookTickers('BNBBTC', (error, ticker) => {
                //console.info("bookTickers", ticker);
                closeAskBid['a'] = ticker.askPrice;
                closeAskBid['b'] = ticker.bidPrice;

                cb(closeAskBid);
            });
        });
    }

    cancelOrder(coinPair, txid, cb) {
        this.api.cancel(coinPair, txid, (error, response, symbol) => {
            console.info(symbol + ' cancel response:', response);

            cb(response);
        });
    }

    async cancelAllOrders(coinPair, cb) {
        await this.api.cancelAll(coinPair);
    }

    addOrder(orderDetails, cb) {
        let orderType = '';
        if (orderDetails.ordertype === 'stop-loss') {
            orderType = 'STOP_LOSS';
        } else if (orderDetails.ordertype === 'take-profit') {
            orderType = 'TAKE_PROFIT';
        } else if (orderDetails.ordertype === 'market') {
            orderType = 'MARKET';

            if (orderDetails.type === 'buy') {
                this.api.marketBuy(
                    orderDetails.pair,
                    orderDetails.volume,
                    (error, response) => {
                        cb(response);
                    }
                );
            } else if (orderDetails.type === 'sell') {
                this.api.marketSell(
                    orderDetails.pair,
                    orderDetails.volume,
                    (error, response) => {
                        cb(response);
                    }
                );
            }

            /* Don't go to the sell below */
            return;
        }

        this.api.sell(
            orderDetails.pair,
            orderDetails.volume,
            orderDetails.price,
            { stopPrice: orderDetails.price, type: orderType },
            (error, response) => {
                response['txid'] = response['orderId'];
                cb(response);
            }
        );
    }

    queryOrders(coinPair, txid, cb) {
        this.api.orderStatus(coinPair, txid, (error, orderStatus, symbol) => {
            //console.info(symbol+" order status:", orderStatus);
            let orderQuery = {};
            orderQuery[coinPair] = {
                status: '',
                cost: 0,
                fee: 0,
            };

            if (orderStatus['status'] === 'FILLED') {
                orderStatus['status'] = 'closed';
            } else {
                orderStatus['status'] = orderStatus['status'].toLowerCase();
            }

            orderQuery[coinPair]['status'] = orderStatus['status'];
            orderQuery[coinPair]['status'] =
                Number(orderStatus['price']) *
                Number(orderStatus['executedQty']);
            /* What about the fees? Should we do a seperate query?
            /sapi/v1/asset/tradeFee
            Maker or taker fees? The max is 0.1, so we'll use that as a max bound untl we can access this endpoint (Note: This changes if we trade long enough per month) */
            orderQuery[coinPair]['fee'] = 0.1 * Number(orderStatus['price']);

            cb(orderQuery);
        });
    }

    closedOrders(txid, cb) {
        this.api.
            .ClosedOrders()
            .then(async (result) => {
                cb(result);
            })
            .catch((err) => {
                console.error(err);
                return false;
            });
    }
}

module.exports = BinanceExchange;
