const NETWORK = require("./config/network-config.js");
//const coin = require("./coin/main_logic.js");
const queue = require("./utils/queue.js");

const kraken = require("kraken-api-wrapper")(
    NETWORK.config.apiKey,
    NETWORK.config.privateApiKey
);
kraken.setOtp(NETWORK.config.twoFactor);

//const coinTracker = new coin();

/*botQueue.enqueue(async () => {
    kraken
        .Time()
        .then((result) => console.log(result))
        .catch((err) => console.error(err));
});

botQueue.enqueue(async () => {
    kraken
        .AssetPairs({ pair: "BTCUSD" })
        .then((result) => console.log(result))
        .catch((err) => console.error(err));
});*/

//const botQueue = new queue();
//botQueue.enqueue(async () => {
kraken
    .Depth({ pair: "USDTZUSD" })
    .then((result) => console.log(result))
    .catch((err) => console.error(err));
//});

/*
let heartbeatId = setInterval(async () => {
    if (Date.now() % 2) {
        //botQueue.dequeue()();
    } else {
        coinTracker.process();
        coinTracker.queue().dequeue()();
    }
}, 500);*/
