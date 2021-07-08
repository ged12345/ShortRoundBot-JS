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
            .OHLC({ pair: coinPair, interval: interval })
            .then(async (result) => {
                cb(result);
            })
            .catch((err) => console.error(err));
    }

    ticker(coinPair, cb) {
        this.api.Ticker({ pair: coinPair })
            .then(async (result) => {
                let closeAskBid = {
                    a: 0,
                    b: 0,
                    c: 0
                };

                closeAskBid["a"] = result["a"][0];
                closeAskBid["b"] = result["b"][0];
                closeAskBid["c"] = result["c"][0];

                cb(result);
            })
            .catch((err) => {
                console.error(err);
                return false;
            });
    }

    cancelOrder(coinPair, txid, cb) {
        this.api.CancelOrder({ txid: txid })
            .then(async (result) => {
                cb(result);
            })
            .catch((err) => {
                console.error(err);
                return false;
            })
    }

    addOrder(orderDetails, cb) {
        this.api.AddOrder(orderDetails)
            .then(async (result) => {
                cb(result)
            })
            .catch((err) => {
                console.error(err);
                return false;
            });
    }

    queryOrders(txid, cb) {
        this.api.QueryOrders({ txid: this.stopLossTXID })
            .then(async (result) => {
                cb(result)
            })
            .catch((err) => {
                console.error(err);
                return false;
            })

    }
}

module.exports = KrakenExchange;

