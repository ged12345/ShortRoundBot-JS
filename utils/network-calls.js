const fetch = require("../trade-bot/node_modules/node-fetch");

const apiGet = async (url) => {
    return fetch(url, {
        method: "get",
        headers: {
            "Content-Type": "application/json",
        },
    })
        .then((res) => res.text())
        .then((body) => {
            return JSON.parse(body);
        });
};

const apiPost = async (url, body) => {
    return fetch(url, {
        method: "post",
        body: JSON.stringify(body),
        headers: {
            "Content-Type": "application/json",
        },
    })
        .then((res) => res.text())
        .then((body) => {
            return JSON.parse(body);
        });
};

module.exports = {
    apiGet,
    apiPost,
};
