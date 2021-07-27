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
            'xqqQr3bPDV7UoYMIp7VxdKNL/qNCJGa4x46AKds8b80N6m20MclDUL9g',
            'FWcXq02U6hLCFqMDrltZfDufY9cv+zoTCpnu1715ugQxRB1D94vPtL2BaXE0ZqBB8RZxkVGCPUs3VQP+IkBcLw==',
            'Jinxed80!!Jinxed80!!'
        );
    }

    async matchOrder(exchangeCoinId, matchClose) {
        /* If there's less than 10 seconds left, we perform a market price order */
        let runOnceFirstSecs = false;
        let runOnceSecondSecs = false;
        let matchedPrice = false;
        let timeToWait = 10;
        let recheckToWait = 30;

        do {
            let currSeconds = (Date.now() / 1000.0) % 60;

            if (currSeconds % timeToWait > 1 && currSeconds % timeToWait < 2) {
                runOnceFirstSecs = false;
            } else if (
                matchedPrice === true &&
                currSeconds % recheckToWait > 0 &&
                currSeconds % recheckToWait < 0.1
            ) {
                runOnceSecondSecs = false;
            }

            if (
                (matchedPrice === false &&
                    runOnceFirstSecs === false &&
                    currSeconds % timeToWait > 0 &&
                    currSeconds % timeToWait < 0.1) ||
                matchedPrice === true ||
                (matchedPrice === true &&
                    runOnceSecondSecs === false &&
                    currSeconds % recheckToWait > 0 &&
                    currSeconds % recheckToWait < 0.1)
            ) {
                /* Here we attempt a limit order 2/3 of the way towards the lowest price of this minute. Note: Will this keep being updated over this minute? We will have to re-check in a loop */
                //console.log(currSeconds);
                /* Here we're looking for the best price to buy coin at */
                if (matchedPrice === true) {
                    this.playTone();
                }

                if (matchedPrice === true && runOnceSecondSecs === false) {
                    this.exchange.curr.OHLC(
                        exchangeCoinId,
                        1,
                        async (result) => {
                            let currOhlcResult =
                                result[exchangeCoinId].reverse();

                            let currClose = Number(currOhlcResult[0][4]);
                            if (currClose < matchClose) {
                                console.log('Below Curr Close: ' + currClose);
                                matchedPrice = false;
                            }
                        }
                    );
                } else if (matchedPrice === false) {
                    this.exchange.curr.OHLC(
                        exchangeCoinId,
                        1,
                        async (result) => {
                            let currOhlcResult =
                                result[exchangeCoinId].reverse();

                            let currClose = Number(currOhlcResult[0][4]);

                            if (currClose >= matchClose) {
                                console.log('Above Curr Close: ' + currClose);
                                this.playTone();
                                matchedPrice = true;
                                await this.sleep(2000);
                            }
                        }
                    );
                }

                await this.sleep(2500);
                runOnceSecondSecs = true;
                runOnceFirstSecs = true;
            }
            await this.sleep(200);
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
