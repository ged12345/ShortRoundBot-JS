const KrakenExchange = require("./krakenExchange.js");
const BinanceExchange = require("./binanceExchange.js");

class Exchange {
    constructor() {
        this.constants = { 
            KRAKEN: { 
                name: "kraken",
                exchange: new KrakenExchange()
            }, 
            BINANCE: { 
                name: "binance",
                exchange: new BinanceExchange() 
            } 
        };
        
        this.name = "";
        this.curr = null;
    }

    setCurrent(exchange) {
        if(exchange === "kraken") {
            this.curr = this.constants.KRAKEN.exchange;
            this.name = this.constants.KRAKEN.name;
        } else if(exchange === "binance") {
            this.curr = this.constants.BINANCE.exchange;
            this.name = this.constants.BINANCE.name;
        }
    }

}

module.exports = Exchange;
