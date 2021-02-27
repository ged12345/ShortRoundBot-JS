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

                /* Should be one row returned */
                if (rows.length === 1) {
                    botId = rows[0].bot_id;
                } else {
                    botId = null;
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

                cb(botId);
            }
        );
    }

    unAssignBot(botId) {
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
}

module.exports = {
    Mysql,
};
