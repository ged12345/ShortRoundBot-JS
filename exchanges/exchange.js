const KrakenExchange = require('./krakenExchange.js');
const BinanceExchange = require('./binanceExchange.js');
const BybitExchange = require('./bybitExchange.js');

class Exchange {
    constructor() {
        this.constants = {
            KRAKEN: {
                name: 'kraken',
                exchange: new KrakenExchange(),
            },
            BINANCE: {
                name: 'binance',
                exchange: new BinanceExchange(),
            },
            BYBIT: {
                name: 'bybit',
                exchange: new BybitExchange(),
            },
        };

        this.name = '';
        this.curr = null;
    }

    setCurrent(exchange) {
        if (exchange === 'kraken') {
            this.curr = this.constants.KRAKEN.exchange;
            this.name = this.constants.KRAKEN.name;
        } else if (exchange === 'binance') {
            this.curr = this.constants.BINANCE.exchange;
            this.name = this.constants.BINANCE.name;
        } else if (exchange === 'bybit') {
            this.curr = this.constants.BYBIT.exchange;
            this.name = this.constants.BYBIT.name;
        }
    }
}

module.exports = Exchange;
