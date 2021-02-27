const NETWORK = require("../legacy/config/network-config.js");
const MainLogic = require("./main_logic.js").MainLogic;
const queue = require("../utils/queue.js");
const network = require("../utils/network-calls.js");

const kraken = require("kraken-api-wrapper")(
    NETWORK.config.apiKey,
    NETWORK.config.privateApiKey
);
kraken.setOtp(NETWORK.config.twoFactor);

/* We need the bot config information to communicate with the exchange so it can do trades*/
/* Then we need the bot ID */
/* We also need the max fees for the exchange */
network.apiGet("http://localhost:3000/api/assign_bot").then((res) => {
    console.log(res);
    tradeToken = res.config;
});

/* We pass bot id , api details, and exchange fees */
const main = new MainLogic({
    id: res.config.id,
    api_config: res.config.api_config,
    fees: res.config.fees,
});

let heartbeatId = setInterval(async () => {
    main.processQueues();
}, 100);

/* Basic bot logic for now */
/*let tradeToken = null;
network
    .apiGet("http://localhost:3000/api/lock_bot?botId=1&coinId=1")
    .then((res) => {
        console.log(res);
        tradeToken = res.token;
        console.log(res.token);
        network
            .apiPost(`http://localhost:3000/api/release_bot`, {
                botId: 1,
                token: tradeToken,
            })
            .then((res) => {
                console.log(res);
            });
    });
*/
