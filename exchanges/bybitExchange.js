const { SpotClient } = require('../coin-bot/node_modules/bybit-api');

class BybitExchange {
    constructor() {
        this.api = null;
    }

    /* Make sure every exchange class has the same interface */
    initApi(apiKey, privApiKey, twoFaPass) {
        /* Test or live */
        let useLivenet = true;

        /* Initialise Kraken API */
        this.api = new SpotClient(
            apiKey,
            privApiKey,

            // optional, uses testnet by default. Set to 'true' to use livenet.
            useLivenet

            // restClientOptions,
            // requestLibraryOptions
        );

        /* No two-factor for BitBy */
    }

    OHLC(coinPair, interval, cb) {
        interval = `${interval}m`;
        this.api
            .getCandles(coinPair, interval)
            .then((result) => {
                //console.log(`OHLC result: ${coinPair}:`, result);
                cb(result);
            })
            .catch((err) => {
                console.error(`OHLC error: ${coinPair}:`, err);
            });
    }

    ticker(coinPair, cb) {
        this.api
            .get24hrTicker(coinPaid)
            .then((result) => {
                console.log('Ticker result: ', result);

                let closeAskBid = {
                    a: 0,
                    b: 0,
                    c: 0,
                };

                closeAskBid['a'] = result[coinPair]['a'][0];
                closeAskBid['b'] = result[coinPair]['b'][0];
                closeAskBid['c'] = result[coinPair]['c'][0];

                cb(closeAskBid);
            })
            .catch((err) => {
                console.error('Ticker error: ', err);
            });
    }

    cancelOrder(coinPair, txid, cb) {
        this.api
            .CancelOrder({
                orderId: txid,
            })
            .then(async (result) => {
                cb(result);
            })
            .catch((err) => {
                console.error(err);
            });
    }

    async cancelAllOrders(coinPair, cb) {
        this.api
            .cancelOrderBatch({ symbol: coinPair })
            .then(async (result) => {
                cb(result);
            })
            .catch((err) => {
                console.error(err);
            });
    }

    addOrder(orderDetails, cb) {
        let orderDetailsAPI = orderDetails;
        /* symbol
        qty
        side: Buy, Sell
        type: MARKET, LIMIT, LIMIT_MAKER
        timeInForce: FOK (Fill Or Kill is good for scalping - order cancels if the limit price can't be immediately filled? May not work with our code.
        price
        )
        https://help.bybit.com/hc/en-us/articles/360039749233-What-Are-Time-In-Force-TIF-GTC-IOC-FOK-
        */
        orderDetailsAPI['nonce'] = (Date.now() * 1000).toString();

        this.api
            .AddOrder(orderDetailsAPI)
            .then(async (result) => {
                cb(result);
            })
            .catch((err) => {
                console.error(err);
                return false;
            });
    }

    queryOrders(txid, cb) {
        this.api
            .QueryOrders({
                nonce: (Date.now() * 1000).toString(),
                txid: this.stopLossTXID,
            })
            .then(async (result) => {
                cb(result);
            })
            .catch((err) => {
                console.error(err);
                return false;
            });
    }
}

module.exports = BybitExchange;
