var crypto = require("crypto");

function encryptCodeIn(str) {
    return str.replace("—", "-").replace("’", "'");
}

function encryptCodeOut(str) {
    return str.replace("-", "—").replace("'", "’");
}

function encrypt512(key, str) {
    var hmac = crypto.createHmac("sha512", key);
    var signed = hmac.update(new Buffer(str, "utf-8")).digest("base64");
    return signed;
}

function generateRandomToken() {
    return Math.random().toString(36).slice(2);
}

/* Can change array because it's pass by reference (not a primitive) */
function rotateArray(arr, numSteps) {
    for (var i = 0; i < numSteps; i++) {
        let lastEl = arr.pop();
        arr.unshift(lastEl);
    }
}

// sleep time expects milliseconds
function sleep(time) {
    return new Promise((resolve) => setTimeout(resolve, time));
}

module.exports = {
    encryptCodeIn,
    encryptCodeOut,
    encrypt512,
    generateRandomToken,
    rotateArray,
    sleep,
};
