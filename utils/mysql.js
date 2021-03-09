const { builtinModules } = require("module");
const mysqlCon = require("../coin-bot/node_modules/mysql");

class Mysql {
    constructor() {
        this.connection = mysqlCon.createConnection({
            host: "192.168.1.104",
            user: "short_round",
            password: "54ngfr0!D",
            database: "short_round",
        });

        this.connection.connect((err) => {
            if (err) throw err;
            console.log("Mysql connection established on 192.168.1.104.");
        });
    }

    assignBot(cb) {
        this.connection.query(
            `SELECT * FROM bot WHERE assigned = "0" LIMIT 1`,
            (err, rows) => {
                if (err) throw err;
                console.log("Data received from Db:");
                console.log(rows);

                let botId = null;
                let botName = null;

                /* Should be one row returned */
                if (rows.length === 1) {
                    botId = rows[0].bot_id;
                    botName = rows[0].bot_name;
                }

                if (botId !== null) {
                    /* Update bot as assigned */
                    this.connection.query(
                        `UPDATE bot SET assigned = "1" WHERE bot_id = '${botId}'`,
                        (err, rows) => {
                            if (err) throw err;
                            console.log("Data received from Db:");
                            console.log(rows);
                        }
                    );
                }

                cb(botId, botName);
            }
        );
    }

    unassignBot(botId) {
        if (botId !== null) {
            /* Update bot as assigned */
            this.connection.query(
                `UPDATE bot SET assigned = "0" WHERE bot_id = '${botId}'`,
                (err, rows) => {
                    if (err) throw err;
                    console.log("Data received from Db:");
                    console.log(rows);
                }
            );
        }
    }

    checkBotLock(botId, cb) {
        let result = false;

        this.connection.query(
            `SELECT * FROM coin_bot_lock WHERE bot_id = ${mysqlCon.escape(
                botId
            )}`,
            (err, rows) => {
                if (err) throw err;
                console.log("Data received from Db:");
                console.log(rows);

                cb(rows.length > 0);
            }
        );
    }

    addToken(botId, coinId, token) {
        this.connection.query(
            `INSERT INTO coin_bot_lock VALUES (DEFAULT, ${mysqlCon.escape(
                botId
            )}, ${mysqlCon.escape(coinId)}, ${mysqlCon.escape(token)})`,
            (err, rows) => {
                if (err) throw err;

                console.log("Data received from Db:");
                console.log(rows);
            }
        );
    }

    removeToken(token) {
        this.connection.query(
            `DELETE FROM coin_bot_lock WHERE token = ${mysqlCon.escape(token)}`,
            (err, rows) => {
                if (err) throw err;

                console.log("Data received from Db:");
                console.log(rows);
            }
        );
    }

    getCoinList(cb) {
        this.connection.query("SELECT id, coin_name FROM coin", (err, rows) => {
            if (err) throw err;

            console.log("Data received from Db:");
            console.log(rows);
            cb(rows);
        });
    }

    getCoinAdvice(coinId, cb) {
        this.connection.query(
            `SELECT * FROM coin_advice WHERE coin_id = ${mysqlCon.escape(
                coinId
            )}`,
            (err, rows) => {
                if (err) throw err;

                console.log("Data received from Db:");
                console.log(rows);
                /* Need to calculate closest to current date and time instead */
                if (rows.length > 0) {
                    cb(rows[0]);
                } else {
                    cb(null);
                }
            }
        );
    }

    getBotConfig(botId, cb) {
        this.connection.query(
            `SELECT * FROM bot_config WHERE bot_id = ${mysqlCon.escape(
                botId
            )} LIMIT 1`,
            (err, rows) => {
                if (err) throw err;

                console.log("Data received from Db:");
                console.log(rows);

                cb(rows[0]);
            }
        );
    }

    getExchangeFees(exchangeId, cb) {
        this.connection.query(
            `SELECT * FROM exchange WHERE id = ${mysqlCon.escape(
                exchangeId
            )} LIMIT 1`,
            (err, rows) => {
                if (err) throw err;

                console.log("Data received from Db:");
                console.log(rows);

                cb(rows[0].exchange_fee);
            }
        );
    }

    /* Coin Kraken API functions */
    storeCoinOHLC(coin_id, results, cb) {
        let timestamp = results[0];
        let timestampDate = new Date(timestamp * 1000);
        let stampFullDate = timestampDate
            .toLocaleDateString("en-US")
            .slice(0, 10)
            .split("/")
            .reverse()
            .join("-");
        let stampFullTime = timestampDate.toLocaleTimeString("en-US", {
            hour12: false,
        });

        this.connection.query(
            `INSERT INTO coin_ohlc VALUES (${coin_id}, '${stampFullTime}', '${stampFullDate}','${timestamp}',${results[1]},${results[2]},${results[3]},${results[4]},${results[5]},${results[6]},${results[7]}) ON DUPLICATE KEY UPDATE open=${results[1]}, high=${results[2]}, low=${results[3]}, close=${results[4]}, vwap=${results[5]}, volume=${results[6]}, count=${results[7]}`,
            (err, rows) => {
                if (err) throw err;

                console.log("Data received from Db:");
                console.log(rows);

                cb();
            }
        );
    }

    /* Coin Kraken API functions */
    countCoinOHLC(cb) {
        this.connection.query(
            `SELECT COUNT(*) as count FROM coin_ohlc`,
            (err, rows) => {
                if (err) throw err;

                console.log("Data received from Db:");
                console.log(rows[0]);

                cb(rows);
            }
        );
    }

    /* Coin Kraken API functions */
    cleanupCoinOHLC(limitNum, numRows, cb) {
        this.connection.query(
            `DELETE c FROM coin_ohlc as c JOIN ( SELECT timestamp as ts FROM coin_ohlc ORDER BY ts ASC LIMIT ${mysqlCon.escape(
                numRows - limitNum
            )} OFFSET ${mysqlCon.escape(
                limitNum - 1
            )}) AS ohlc_limit ON c.timestamp > ohlc_limit.ts`,
            (err, rows) => {
                if (err) throw err;

                console.log("Data received from Db:");
                console.log(rows);

                cb();
            }
        );
    }
}

module.exports = {
    Mysql,
};
