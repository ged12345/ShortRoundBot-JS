class KrakenExchange {
    constructor() {
        this.api = null;
    }

    /* Make sure every exchange class has the same unterface */
    initApi(apiKey, privApiKey, twoFaPass) {
        /* Initialise Kraken API */
        this.api = require('../coin-bot/node_modules/kraken-api-wrapper')(
            apiKey,
            privApiKey
        );
        this.api.setOtp(twoFaPass);
    }

    OHLC(coinPair, interval, cb) {
        this.api
            .OHLC({
                nonce: (Date.now() * 1000).toString(),
                pair: coinPair,
                interval: interval,
            })
            .then(async (result) => {
                cb(result);
            })
            .catch((err) => console.error(err));
    }

    ticker(coinPair, cb) {
        this.api
            .Ticker({
                nonce: (Date.now() * 1000).toString(),
                pair: coinPair,
            })
            .then(async (result) => {
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
                console.error(err);
                return false;
            });
    }

    cancelOrder(coinPair, txid, cb) {
        this.api
            .CancelOrder({
                nonce: (Date.now() * 1000).toString(),
                txid: txid,
            })
            .then(async (result) => {
                cb(result);
            })
            .catch((err) => {
                console.error(err);
                return false;
            });
    }

    async cancelAllOrders(coinPair, cb) {
        let coinPairAPI = coinPair;
        coinPairAPI['nonce'] = (Date.now() * 1000).toString();
        this.api
            .CancelAll(coinPairAPI)
            .then(async (result) => {
                cb(result);
            })
            .catch((err) => {
                console.error(err);
                return false;
            });
    }

    addOrder(orderDetails, cb) {
        let orderDetailsAPI = orderDetails;
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

module.exports = KrakenExchange;
