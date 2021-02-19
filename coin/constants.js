/*
CRASHING is when there has been a huge drop in a coin so we avoid,
Also, if two or more drops depending on how much in the kitty (2 for a lack of funds - say half usual stake). We always sell on CRASHING.

SPIKING is for when a coin keeps going up. We compare vs 24-hr and all time high, and if it's not too high but increasing, we buy. (The next day will reset the 24-hr and all-time high, so th coin again becomes viable).
Over what time frame? 5 mins? Just a sharp peak?

LEVEL_OUT is for when the coin price is not moving far - we check every few minutes for current price and if it has only moved by 0.5% of current price, it's level.

WOBBLING_UP is when the coin has spiked by a small amount over a period of time (say 5 mins) and is trending upwards (averaged out)

WOBBLING_DOWN is when the coin has dropped by a small amount over a period of time (say 5 mins) and is trending downwards (averaged out)

*/

const COIN_STATUS = [
    "CRASHING",
    "SPIKING",
    "LEVEL_OUT",
    "WOBBLING_UP",
    "WOBBLING_DOWN ",
];

module.exports = [COIN_STATUS];
