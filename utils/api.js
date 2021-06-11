const networkCalls = require('./network-calls.js');

/* Move all the api calls into this one location */
/* Trade Bot API */
const lockBot = async (botId, lockCoinId, cb) => {
    networkCalls
        .apiPost(`http://localhost:1408/api/lock_bot`, {
            botId: botId,
            coinId: lockCoinId,
        })
        .then((res) => {
            //console.log(res);
            cb(res.token);
        });
};

const releaseBot = async (botId, token, cb) => {
    networkCalls
        .apiPost(`http://localhost:1408/api/release_bot`, {
            botId: botId,
            token: token,
        })
        .then((res) => {
            //console.log(res);
            cb();
        });
};

const getAdvice = async (code, name, cb) => {
    /* We start calling in the advice every half second */
    networkCalls
        .apiGet(`http://localhost:1408/api/advice?code=${code}&name=${name}`)
        .then((res) => {
            //console.log(res);
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
            //console.log(res);
            cb(res);
        });
};

const numAssignedBots = async (code, cb) => {
    networkCalls
        .apiGet('http://localhost:1408/api/num_assigned_bots', {
            code: code,
        })
        .then((res) => {
            //console.log(res);
            cb(res.numOfBots);
        });
};

const assignBot = async (code, name, cb) => {
    networkCalls
        .apiPost('http://localhost:1408/api/assign_bot', {
            code: code,
            name: name,
        })
        .then((res) => {
            //console.log(res);
            cb(res);
        });
};

const unassignBot = async (botId, cb) => {
    networkCalls
        .apiPost(`http://localhost:1408/api/unassign_bot`, {
            botId: botId,
        })
        .then((res) => {
            //console.log(res);
            cb(true);
        });
};

const getBotInfo = async (botId, cb) => {
    networkCalls
        .apiGet(`http://localhost:1408/api/get_bot_info?botId=${botId}`)
        .then((res) => {
            //console.log(res);
            cb(true);
        });
};

const setBotInfo = async (botId, botInfo, cb) => {
    networkCalls
        .apiPost(`http://localhost:1408/api/unassign_bot`, {
            botId: botId,
            botInfo: botInfo,
        })
        .then((res) => {
            //console.log(res);
            cb(true);
        });
};

module.exports = {
    lockBot,
    releaseBot,
    getAdvice,
    getLockedAdvice,
    numAssignedBots,
    assignBot,
    unassignBot,
    getBotInfo,
    setBotInfo,
};
