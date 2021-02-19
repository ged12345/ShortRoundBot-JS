import NETWORK from "../config/network-config";
import { encrypt512 } from "../utils/general";

const fetch = require("node-fetch");

export const apiGet = async (url) => {
    fetch(url, {
        method: "get",
        headers: {
            "Content-Type": "application/json",
            'User-Agent':NETWORK.config.userAgent,
            "API-Key": NETWORK.config.apiKey,
            "API-Sign": encrypt512()
        },
    })
        .then((res) => res.text())
        .then((body) => console.log(body));
};

export const apiPost = async (url) => {
    fetch(url, {
        method: "post",
        body: JSON.stringify(body),
        headers: {
            "Content-Type": "application/json",
            'User-Agent':NETWORK.config.userAgent,
            "API-Key": NETWORK.config.apiKey,
            "API-Sign":
        },
    })
        .then((res) => res.text())
        .then((body) => console.log(body));
};
