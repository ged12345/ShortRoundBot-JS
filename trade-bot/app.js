const NETWORK = require('../legacy/config/network-config.js');
const MainLogic = require('./main_logic.js').MainLogic;
const queue = require('../utils/queue.js');
const sleep = require('../utils/general.js').sleep;

const kraken = require('kraken-api-wrapper')(
    NETWORK.config.apiKey,
    NETWORK.config.privateApiKey
);
kraken.setOtp(NETWORK.config.twoFactor);

const exchangeName = 'kraken';
//const exchangeName = 'binance';

const main = new MainLogic(kraken, exchangeName);
let unassignedBot = false;

init();

async function init() {
    let heartbeatId = setInterval(async () => {
        main.processQueues();
    }, 100);

    /*kraken
    .Ticker({ pair: "BTCUSD" })
    .then((result) => console.log(result))
    .catch((err) => console.error(err));

    kraken
    .OHLC({ pair: "BTCUSD", interval })
    .then((result) => console.log(result))
    .catch((err) => console.error(err));*/

    /* Basic bot logic for now */
    /*let tradeToken = null;
    network
        .apiGet("http://localhost:1408/api/lock_bot?botId=1&coinId=1")
        .then((res) => {
            console.log(res);
            tradeToken = res.token;
            console.log(res.token);
            network
                .apiPost(`http://localhost:1408/api/release_bot`, {
                    botId: 1,
                    token: tradeToken,
                })
                .then((res) => {
                    console.log(res);
                });
        });
    */
}

/* Run exit handler and cleanup */
function exitHandler(options, exitCode) {
    if (options.cleanup) {
        console.log('Performed bot cleanup.');
    }

    if (exitCode || exitCode === 0) console.log(exitCode);
    if (options.exit) {
        if (unassignedBot === false) {
            console.log(`Unassigning bot: ${main.id}`);
            main.cleanup((success) => {
                unassignedBot = success;
            });
        } else {
            process.exit();
        }
    }
}

//do something when app is closing
process.on('exit', exitHandler.bind(null, { cleanup: true }));

//catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, { exit: true }));

// catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR1', exitHandler.bind(null, { exit: true }));
process.on('SIGUSR2', exitHandler.bind(null, { exit: true }));

//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, { exit: true }));
