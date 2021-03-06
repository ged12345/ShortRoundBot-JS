const networkCalls = require("./network-calls.js");

/* Move all the api calls into this one location */
/* Trade Bot API */
const lockBot = async (botId, lockCoinId, cb) => {
    networkCalls
        .apiPost(`http://localhost:1408/api/lock_bot`, {
            botId: botId,
            coinId: lockCoinId,
        })
        .then((res) => {
            console.log(res);
            cb(res.token);
        });
};

const getAdvice = async (cb) => {
    /* We start calling in the advice every half second */
    networkCalls.apiGet(`http://localhost:1408/api/advice`).then((res) => {
        console.log(res);
        cb(res);
    });
};

const getLockedAdvice = async (botId, token, cb) => {
    /* We start calling in the advice every half second */
    networkCalls
        .apiGet(
            `http://localhost:1408/api/locked_advice?botId=${botId}&token=${token}`
        )
        .then((res) => {
            console.log(res);
            cb(res);
        });
};

const assignBot = async (cb) => {
    networkCalls.apiGet("http://localhost:1408/api/assign_bot").then((res) => {
        console.log(res);
        cb(res);
    });
};

const unassignBot = async (botId, cb) => {
    networkCalls
        .apiPost(`http://localhost:1408/api/unassign_bot`, {
            botId: botId,
        })
        .then((res) => {
            cb(true);
            console.log(res);
        });
};

module.exports = {
    lockBot,
    getAdvice,
    getLockedAdvice,
    assignBot,
    unassignBot,
};
