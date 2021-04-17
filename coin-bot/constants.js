/*
CRASHING is when there has been a huge drop in a coin so we avoid,
Also, if two or more drops depending on how much in the kitty (2 for a lack of funds - say half usual stake). We always sell on CRASHING.

SPIKING is for when a coin keeps going up. We compare vs 24-hr and all time high, and if it's not too high but increasing, we buy. (The next day will reset the 24-hr and all-time high, so th coin again becomes viable).
Over what time frame? 5 mins? Just a sharp peak?

LEVEL_OUT is for when the coin price is not moving far - we check every few minutes for current price and if it has only moved by 0.5% of current price, it's level.

WOBBLING_UP is when the coin has spiked by a small amount over a period of time (say 5 mins) and is trending upwards (averaged out)

WOBBLING_DOWN is when the coin has dropped by a small amount over a period of time (say 5 mins) and is trending downwards (averaged out)

*/

const COIN_STATUS = {
    CRASHING: "crashing",
    SPIKING: "spiking",
    SIDEWAYS: "sideways",
    WOBBLING_UP: "wobbling_up",
    WOBBLING_DOWN: "wobbling_down",
};

const COIN_ADVICE = {
    DEFINITE_BUY: "definite_buy",
    POSSIBLE_BUY: "possible_buy",
    IMMEDIATE_SELL: "immediate_sell",
    DEFINITE_SELL: "definite_sell",
    POSSIBLE_SELL: "possible_sell",
    HOLD: "hold",
};

module.exports = { COIN_STATUS, COIN_ADVICE };
