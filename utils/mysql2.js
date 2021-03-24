const { builtinModules } = require("module");
const mysqlCon = require("../coin-bot/node_modules/mysql2/promise");

class Mysql {
    constructor() {
        this.connection = mysqlCon.createPool({
            host: "192.168.1.104",
            user: "short_round",
            password: "54ngfr0!D",
            database: "short_round",
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
        });

        /*this.connection.connect((err) => {
            if (err) throw err;
            console.log("Mysql connection established on 192.168.1.104.");
        });*/
    }

    async getNumberOfBots() {
        const [rows, fields] = await this.connection.query(
            `SELECT COUNT(*) as count FROM bot WHERE assigned = 1`
        );

        //console.log("Data received from Db:");
        //console.log(rows[0]);

        return rows[0];
    }

    async assignBot() {
        const [rows, fields] = await this.connection.query(
            `SELECT * FROM bot WHERE assigned = "0" LIMIT 1`
        );

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
            const [rows, fields] = await this.connection.query(
                `UPDATE bot SET assigned = "1" WHERE bot_id = '${botId}'`
            );
            console.log("Data received from Db:");
            console.log(rows);
        }

        return [botId, botName];
    }

    async unassignBot(botId) {
        if (botId !== null) {
            /* Update bot as assigned */
            const [rows, fields] = await this.connection.query(
                `UPDATE bot SET assigned = "0" WHERE bot_id = '${botId}'`
            );

            console.log("Data received from Db:");
            console.log(rows);
        }
    }

    async checkSalt(salt) {
        if (salt !== null) {
            /* Update bot as assigned */
            const [rows, fields] = await this.connection.query(
                `SELECT * FROM bot_config WHERE salt='${salt}'`
            );

            console.log("Data received from Db:");
            console.log(rows);

            return rows.length > 0 ? true : false;
        }
    }

    async checkBotLock(botId) {
        let result = false;

        const [rows, fields] = await this.connection.query(
            `SELECT * FROM coin_bot_lock WHERE bot_id = ${mysqlCon.escape(
                botId
            )}`
        );
        console.log("Data received from Db:");
        console.log(rows);

        return rows.length > 0;
    }

    async addToken(botId, coinId, token) {
        const [rows, fields] = await this.connection.query(
            `INSERT INTO coin_bot_lock VALUES (DEFAULT, ${mysqlCon.escape(
                botId
            )}, ${mysqlCon.escape(coinId)}, ${mysqlCon.escape(token)})`
        );

        console.log("Data received from Db:");
        console.log(rows);
    }

    async removeToken(token) {
        const [rows, fields] = await this.connection.query(
            `DELETE FROM coin_bot_lock WHERE token = ${mysqlCon.escape(token)}`
        );
        console.log("Data received from Db:");
        console.log(rows);
    }

    async getCoinList() {
        const [rows, fields] = await this.connection.query(
            "SELECT id, coin_name, coin_id_kraken, coin_id_binance FROM coin"
        );
        /*console.log("Data received from Db:");
            console.log(rows);*/
        return rows;
    }

    async getCoinAdvice(coinId) {
        const [rows, fields] = await this.connection.query(
            `SELECT * FROM coin_advice WHERE coin_id = ${mysqlCon.escape(
                coinId
            )}`
        );
        console.log("Data received from Db:");
        console.log(rows);
        /* Need to calculate closest to current date and time instead */
        if (rows.length > 0) {
            return rows[0];
        } else {
            return null;
        }
    }

    async getBotConfig(botId) {
        const [rows, fields] = await this.connection.query(
            `SELECT bot_id, exchange_id, api_key, priv_api_key, 2fa_pass FROM bot_config WHERE bot_id = ${mysqlCon.escape(
                botId
            )} LIMIT 1`
        );

        console.log("Data received from Db:");
        console.log(rows);

        return rows[0];
    }

    async getExchangeFees(exchangeId) {
        const [rows, fields] = await this.connection.query(
            `SELECT * FROM exchange WHERE id = ${mysqlCon.escape(
                exchangeId
            )} LIMIT 1`
        );
        console.log("Data received from Db:");
        console.log(rows);

        return rows[0].exchange_fee;
    }

    async getCoinOHLC(coin_id) {
        const [rows, fields] = await this.connection.query(
            `SELECT * FROM coin_ohlc WHERE coin_id=${mysqlCon.escape(
                coin_id
            )} LIMIT 32`
        );
        /* TO DO: Replace 32 with our graph limit */

        return rows;
    }

    /* Coin Kraken API functions */
    async storeCoinOHLC(coin_id, results) {
        let timestamp = results[0];
        let timestampDate = new Date(timestamp * 1000);
        let stampFullDate = timestampDate
            .toLocaleDateString("en-AU")
            .slice(0, 10)
            .split("/")
            .reverse()
            .join("-");
        let stampFullTime = timestampDate.toLocaleTimeString("en-AU", {
            hour12: false,
        });

        const [rows, fields] = await this.connection.query(
            `INSERT INTO coin_ohlc VALUES (${coin_id}, '${stampFullTime}', '${stampFullDate}','${timestamp}',${results[1]},${results[2]},${results[3]},${results[4]},${results[5]},${results[6]},${results[7]}) ON DUPLICATE KEY UPDATE open=${results[1]}, high=${results[2]}, low=${results[3]}, close=${results[4]}, vwap=${results[5]}, volume=${results[6]}, count=${results[7]}`
        );
    }

    /* Coin Kraken API functions */
    async countCoinOHLC() {
        const [rows, fields] = await this.connection.query(
            `SELECT COUNT(*) as count FROM coin_ohlc`
        );

        //console.log("Data received from Db:");
        //console.log(rows[0]);

        return rows[0];
    }

    async cleanupCoinOHLC(coin_id, limitNum, cb) {
        const [rows, fields] = await this.connection.query(
            `DELETE FROM coin_ohlc
            WHERE timestamp IN
            (
                SELECT timestamp
                FROM
                    (
                        SELECT timestamp
                        FROM coin_ohlc
                        WHERE coin_id = ${mysqlCon.escape(coin_id)}
                        ORDER BY timestamp DESC
                        LIMIT ${mysqlCon.escape(limitNum)},60
                    ) a
            )`
        );
        //console.log("Data received from Db:");
        //console.log(rows);
    }

    async emptyCoinOHLC() {
        const [rows, fields] = await this.connection.query(
            "TRUNCATE TABLE coin_ohlc"
        );
    }

    /* Coin Processing functions */
    async getProcessedRSI(coin_id) {
        const [rows, fields] = await this.connection.query(
            `SELECT * from coin_processed_rsi WHERE coin_id=${mysqlCon.escape(
                coin_id
            )}`
        );
        return rows;
    }

    async storeProcessedRSI(coin_id, results) {
        let timestamp = results["timestamp"];
        let timestampDate = new Date(timestamp * 1000);
        let stampFullDate = timestampDate
            .toLocaleDateString("en-AU")
            .slice(0, 10)
            .split("/")
            .reverse()
            .join("-");
        let stampFullTime = timestampDate.toLocaleTimeString("en-AU", {
            hour12: false,
        });

        const [rows, fields] = await this.connection.query(
            `INSERT INTO coin_processed_rsi VALUES (${coin_id}, '${stampFullTime}', '${stampFullDate}','${timestamp}',${results["close"]},${results["lossOrGain"]},${results["aveGain"]},${results["aveLoss"]},${results["RS"]},${results["RSI"]}) ON DUPLICATE KEY UPDATE close=${results["close"]},loss_or_gain=${results["lossOrGain"]}, ave_gain=${results["aveGain"]}, ave_loss=${results["aveLoss"]}, RS=${results["RS"]}, RSI=${results["RSI"]}`
        );
    }

    async cleanupProcessedRSI(coin_id, limitNum) {
        const [rows, fields] = await this.connection.query(
            `DELETE FROM coin_processed_rsi
            WHERE timestamp IN
            (
                SELECT timestamp
                FROM
                    (
                        SELECT timestamp
                        FROM coin_processed_rsi
                        WHERE coin_id = ${mysqlCon.escape(coin_id)}
                        ORDER BY timestamp DESC
                        LIMIT ${mysqlCon.escape(limitNum)},60
                    ) a
            )`
        );
    }

    async emptyProcessRSI() {
        const [rows, fields] = await this.connection.query(
            "TRUNCATE TABLE coin_processed_rsi"
        );
    }

    async getProcessedStochastic(coin_id) {
        const [rows, fields] = await this.connection.query(
            `SELECT * from coin_processed_stochastic WHERE coin_id=${mysqlCon.escape(
                coin_id
            )}`
        );

        //console.log("Data received from Db:");
        //console.log(rows);

        return rows;
    }

    async storeProcessedStochastic(coin_id, results) {
        let timestamp = results["timestamp"];
        let timestampDate = new Date(timestamp * 1000);
        let stampFullDate = timestampDate
            .toLocaleDateString("en-AU")
            .slice(0, 10)
            .split("/")
            .reverse()
            .join("-");
        let stampFullTime = timestampDate.toLocaleTimeString("en-AU", {
            hour12: false,
        });

        const [rows, fields] = await this.connection.query(
            `INSERT INTO coin_processed_stochastic VALUES (${coin_id}, '${stampFullTime}', '${stampFullDate}','${timestamp}',${results["high"]},${results["low"]},${results["kFast"]},${results["dSlow"]},${results["kFull"]},${results["dFull"]}) ON DUPLICATE KEY UPDATE high=${results["high"]},low=${results["low"]},k_fast=${results["kFast"]},d_slow=${results["dSlow"]}, k_full=${results["kFull"]},d_full=${results["dFull"]}`
        );
    }

    async cleanupProcessedStochastic(coin_id, limitNum) {
        const [rows, fields] = await this.connection.query(
            `DELETE FROM coin_processed_stochastic
            WHERE timestamp IN
            (
                SELECT timestamp
                FROM
                    (
                        SELECT timestamp
                        FROM coin_processed_stochastic
                        WHERE coin_id = ${mysqlCon.escape(coin_id)}
                        ORDER BY timestamp DESC
                        LIMIT ${mysqlCon.escape(limitNum)},60
                    ) a
            )`
        );
    }

    async emptyProcessStochastic() {
        const [rows, fields] = await this.connection.query(
            "TRUNCATE TABLE coin_processed_stochastic"
        );
    }

    async getProcessedBollinger(coin_id) {
        const [rows, fields] = await this.connection.query(
            `SELECT * from coin_processed_bollinger WHERE coin_id=${mysqlCon.escape(
                coin_id
            )}`
        );

        //console.log("Data received from Db:");
        //console.log(rows);

        return rows;
    }

    async storeProcessedBollinger(coin_id, results) {
        let timestamp = results["timestamp"];
        let timestampDate = new Date(timestamp * 1000);
        let stampFullDate = timestampDate
            .toLocaleDateString("en-AU")
            .slice(0, 10)
            .split("/")
            .reverse()
            .join("-");
        let stampFullTime = timestampDate.toLocaleTimeString("en-AU", {
            hour12: false,
        });

        const [rows, fields] = await this.connection.query(
            `INSERT INTO coin_processed_bollinger VALUES (${coin_id}, '${stampFullTime}', '${stampFullDate}','${timestamp}',${results["close"]},${results["mean"]},${results["SD"]},${results["bWidth"]},${results["perB"]},${results["bolU"]},${results["bolD"]},${results["bolMA"]}) ON DUPLICATE KEY UPDATE close=${results["close"]},mean=${results["mean"]},SD=${results["SD"]},per_b=${results["perB"]},b_width=${results["bWidth"]},bol_u=${results["bolU"]},bol_d=${results["bolD"]},bol_ma=${results["bolMA"]}`
        );
    }

    async cleanupProcessedBollinger(coin_id, limitNum) {
        const [rows, fields] = await this.connection.query(
            `DELETE FROM coin_processed_bollinger
            WHERE timestamp IN
            (
                SELECT timestamp
                FROM
                    (
                        SELECT timestamp
                        FROM coin_processed_bollinger
                        WHERE coin_id = ${mysqlCon.escape(coin_id)}
                        ORDER BY timestamp DESC
                        LIMIT ${mysqlCon.escape(limitNum)},60
                    ) a
            )`
        );
    }

    async emptyProcessBollinger() {
        const [rows, fields] = await this.connection.query(
            "TRUNCATE TABLE coin_processed_bollinger"
        );
    }

    /* Coin Processing functions */
    async getProcessedSMA(coin_id) {
        const [rows, fields] = await this.connection.query(
            `SELECT * from coin_processed_sma WHERE coin_id=${mysqlCon.escape(
                coin_id
            )}`
        );
        return rows;
    }

    async storeProcessedSMA(coin_id, results) {
        let timestamp = results["timestamp"];
        let timestampDate = new Date(timestamp * 1000);
        let stampFullDate = timestampDate
            .toLocaleDateString("en-AU")
            .slice(0, 10)
            .split("/")
            .reverse()
            .join("-");
        let stampFullTime = timestampDate.toLocaleTimeString("en-AU", {
            hour12: false,
        });

        console.log(results);

        const [rows, fields] = await this.connection.query(
            `INSERT INTO coin_processed_sma VALUES (${coin_id}, '${stampFullTime}', '${stampFullDate}','${timestamp}',${results["close"]},${results["SMA"]},${results["EMA"]},${results["trend"]},${results["trend_weighting"]}) ON DUPLICATE KEY UPDATE close=${results["close"]},sma=${results["SMA"]}, ema=${results["EMA"]},trend=${results["trend"]},trend_weighting=${results["trend_weighting"]}`
        );
    }

    async cleanupProcessedSMA(coin_id, limitNum) {
        const [rows, fields] = await this.connection.query(
            `DELETE FROM coin_processed_sma
            WHERE timestamp IN
            (
                SELECT timestamp
                FROM
                    (
                        SELECT timestamp
                        FROM coin_processed_sma
                        WHERE coin_id = ${mysqlCon.escape(coin_id)}
                        ORDER BY timestamp DESC
                        LIMIT ${mysqlCon.escape(limitNum)},60
                    ) a
            )`
        );
    }

    async emptyProcessSMA() {
        const [rows, fields] = await this.connection.query(
            "TRUNCATE TABLE coin_processed_sma"
        );
    }
}

module.exports = {
    Mysql,
};
