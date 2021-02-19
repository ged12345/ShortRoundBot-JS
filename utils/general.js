var crypto = require("crypto");

export function encrypt512(key, str) {
    var hmac = crypto.createHmac("sha512", key);
    var signed = hmac.update(new Buffer(str, "utf-8")).digest("base64");
    return signed;
}
