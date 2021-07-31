const coinAdviceConstants = require('../coin-bot/constants.js').COIN_ADVICE;
const MysqlCon = require('../utils/mysql2.js').Mysql;
const mysql = new MysqlCon();
const Baudio = require('baudio');

class PriceAlert {
    constructor(args) {
        let coinId = 1;

        if (args.length === 2) {
            coinId = args[1];
        }

        this.matchDefiniteBuy(coinId);
    }

    async matchDefiniteBuy(coinId) {
        /* If there's less than 10 seconds left, we perform a market price order */
        let runOnceFirstSecs = false;
        let runOnceSecondSecs = false;
        let matchedBuy = false;
        let timeToWait = 5;
        let recheckToWait = 5;

        do {
            let currSeconds = (Date.now() / 1000.0) % 60;

            if (currSeconds % timeToWait > 1 && currSeconds % timeToWait < 2) {
                runOnceFirstSecs = false;
            }

            if (
                matchedBuy === true &&
                currSeconds % recheckToWait > 1 &&
                currSeconds % recheckToWait < 2
            ) {
                runOnceSecondSecs = false;
                this.playTone();
                await this.sleep(1500);
            }

            if (
                matchedBuy === true &&
                runOnceSecondSecs === false &&
                currSeconds % recheckToWait > 0 &&
                currSeconds % recheckToWait < 0.1
            ) {
                let coinAdvice = await mysql.getCoinAdvice(coinId);

                let currAdviceResult =
                    coinAdvice[coinAdvice.length - 1]['advice'];
                let currBuyProbResult = Number(
                    coinAdvice[coinAdvice.length - 1]['buy_probability']
                );
                console.log(currAdviceResult + ' ' + currBuyProbResult);

                if (
                    (currAdviceResult === 'definite_buy' &&
                        currBuyProbResult < 105) ||
                    currAdviceResult !== 'definite_buy'
                ) {
                    console.log(
                        'Non-definite buy!' +
                            currAdviceResult +
                            ' ' +
                            currBuyProbResult
                    );
                    matchedBuy = false;
                }

                await this.sleep(500);
                runOnceSecondSecs = true;
            }

            if (
                matchedBuy === false &&
                runOnceFirstSecs === false &&
                currSeconds % timeToWait > 0 &&
                currSeconds % timeToWait < 0.1
            ) {
                let coinAdvice = await mysql.getCoinAdvice(coinId);

                let currAdviceResult =
                    coinAdvice[coinAdvice.length - 1]['advice'];
                let currBuyProbResult = Number(
                    coinAdvice[coinAdvice.length - 1]['buy_probability']
                );

                console.log(currAdviceResult + ' ' + currBuyProbResult);

                if (
                    currAdviceResult === 'definite_buy' &&
                    currBuyProbResult >= 105
                ) {
                    console.log(
                        'Definite buy!: ' +
                            currAdviceResult +
                            ' ' +
                            currBuyProbResult
                    );
                    this.playTone();
                    matchedBuy = true;
                    await this.sleep(500);
                }
                //await this.sleep(2500);
                runOnceFirstSecs = true;
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
                Math.sin(t * 1000) *
                    Math.max(0, Math.sin(t * n + c * Math.sin(t * 20)))
            );
        });
        b.play({ v: 0.25 });
    }
}

var args = process.argv.slice(1);
let logic = new PriceAlert(args);

module.exports = PriceAlert;
