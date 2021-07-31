const coinAdviceConstants = require('../coin-bot/constants.js').COIN_ADVICE;
const Exchange = require('../exchanges/exchange.js');
const Baudio = require('baudio');

class PriceAlert {
    constructor(args) {
        /* Init the Exchange object */
        this.exchange = new Exchange();
        this.exchange.setCurrent('kraken');

        let exchangeCoinId = 'XXBTZUSD';

        if (args.length === 3) {
            exchangeCoinId = args[2];
        }

        let matchClose = Number(args[1]);

        this.setupExchange();
        this.matchOrder(exchangeCoinId, matchClose);
    }

    async setupExchange() {
        this.exchange.curr.initApi(
            'Np2ome6dVCWO0VleWFxbFJF/HwwQZvK1sLaXQgvqtFFOmhqW1fbpaGlM',
            'v1QclXs1qahxpc1sYIOj2Yxvu+McEDXV/6Xeai3qO/QahYupRAl5CuxcWWx3Ppl7t1p21zA8L/Q8BmuQKEwERA==',
            'Jinxed80!!Jinxed80!!'
        );
    }

    async matchOrder(exchangeCoinId, matchClose) {
        /* If there's less than 10 seconds left, we perform a market price order */
        let runOnceFirstSecs = false;
        let runOnceSecondSecs = false;
        let matchedPrice = false;
        let timeToWait = 10;
        let recheckToWait = 10;

        do {
            let currSeconds = (Date.now() / 1000.0) % 60;

            if (currSeconds % timeToWait > 1 && currSeconds % timeToWait < 2) {
                runOnceFirstSecs = false;
            }

            if (
                matchedPrice === true &&
                currSeconds % recheckToWait > 1 &&
                currSeconds % recheckToWait < 2
            ) {
                runOnceSecondSecs = false;
                this.playTone();
                await this.sleep(2500);
            }

            if (
                matchedPrice === true &&
                runOnceSecondSecs === false &&
                currSeconds % recheckToWait > 0 &&
                currSeconds % recheckToWait < 0.1
            ) {
                this.exchange.curr.OHLC(exchangeCoinId, 1, async (result) => {
                    let currOhlcResult = result[exchangeCoinId].reverse();

                    let currClose = Number(currOhlcResult[0][4]);
                    if (currClose < matchClose) {
                        console.log('Below Curr Close: ' + currClose);
                        matchedPrice = false;
                    }
                });
                await this.sleep(500);
            }

            if (
                matchedPrice === false &&
                runOnceFirstSecs === false &&
                currSeconds % timeToWait > 0 &&
                currSeconds % timeToWait < 0.1
            ) {
                this.exchange.curr.OHLC(exchangeCoinId, 1, async (result) => {
                    let currOhlcResult = result[exchangeCoinId].reverse();

                    let currClose = Number(currOhlcResult[0][4]);

                    if (currClose >= matchClose) {
                        console.log('Above Curr Close: ' + currClose);
                        this.playTone();
                        matchedPrice = true;
                        await this.sleep(2000);
                    }
                });
                await this.sleep(500);
            }

            //await this.sleep(200);
        } while (true);
    }

    async sleep(waitTime) {
        await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    async playTone() {
        var b = Baudio(function (t, i) {
            var n = 28;
            var c = 10 * (1 + Math.sin(i / 20000) / 10000);

            return (
                Math.sin(
                    (t % 15) * 150 * (t % 30) * Math.floor(Math.sin(t) * 5)
                ) +
                ((t << 3) * (t & 0x7f)) / 256 +
                Math.sin(t * 9000) *
                    Math.max(0, Math.sin(t * n + c * Math.sin(t * 20)))
            );
        });
        b.play({ v: 0.12 });
    }
}

var args = process.argv.slice(1);
let logic = new PriceAlert(args);

module.exports = PriceAlert;
