var crypto = require('crypto');

const algorithm = 'aes-256-ctr';
const iv = crypto.randomBytes(16);

function encryptCodeIn(str) {
    return str.replace('—', '-').replace('’', "'");
}

function encryptCodeOut(str) {
    return str.replace('-', '—').replace("'", '’');
}

function hash512(secretKey, str) {
    var hmac = crypto.createHmac('sha512', secretKey);
    var signed = hmac.update(new Buffer(str, 'utf-8')).digest('base64');
    return signed;
}

const encryptAES = (secretKey, text) => {
    const cipher = crypto.createCipheriv(algorithm, secretKey.slice(0, 32), iv);

    const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);

    return {
        iv: iv.toString('hex'),
        content: encrypted.toString('hex'),
    };
};

const decryptAES = (secretKey, hash) => {
    const decipher = crypto.createDecipheriv(
        algorithm,
        secretKey.slice(0, 32),
        Buffer.from(hash.iv, 'hex')
    );

    const decrpyted = Buffer.concat([
        decipher.update(Buffer.from(hash.content, 'hex')),
        decipher.final(),
    ]);

    return decrpyted.toString();
};

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
    hash512,
    encryptAES,
    decryptAES,
    generateRandomToken,
    rotateArray,
    sleep,
};
