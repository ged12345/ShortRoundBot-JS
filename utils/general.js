var crypto = require("crypto");

function encrypt512(key, str) {
    var hmac = crypto.createHmac("sha512", key);
    var signed = hmac.update(new Buffer(str, "utf-8")).digest("base64");
    return signed;
}

function generateRandomToken() {
    return Math.random().toString(36).slice(2);
}

module.exports = { encrypt512, generateRandomToken };
