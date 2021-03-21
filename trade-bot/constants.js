/* Shhhhhhh */
const BOT_CODE = {
    primer:
        "KGndibcY5EX3kwcIa+rsQNz2WsDrI31wo9SRYFS3N—g4L1Gfepbc0t4CC61GMzkc/gK+2nNeqpDVO5D87’YB32w==",
};

/* HOLDING - Have bought, is not selling yet.
   SEEKING_COIN - No coins, looking for a reliable coin trending upwards.
   LOOKING_TO_BUY means we've found a coin and are waiting to purchase. There will be a limit on this before we go back to SEEKING_COIN. */
const BOT_EVENT = {
    SEEKING_COIN: "seeking_coin", // Looking for advice
    SHAKING_HANDS: "shaking_hands", // Lock token exchange
    TRADE_LOCKED: "trade_locked",
    PREPARING_TRADE: "preparing_trade",
    LOOKING_TO_BUY: "looking_to_buy",
    HOLDING: "holding",
    LOOKING_TO_SELL: "looking_to_sell", // For "CRASHING" - we just shortcut and sell at whatevr price
    IMMEDIATE_SELL: "immediate_sell",
    WAITING_FOR_ORDER: "waiting_for_order", // Waiting for an order to go through and finish.
};

/* These are per a coin, so we will have an array of each coin and the bot's current stance.

RISK_AVERSE is very conservative plays - wait until a coin has drop low compared to its 24-hour and all-time low point (not too low as it may be crashing), then buy,
and then sell at a more bottom heavy spread (+2% = sell 20%, and another 20% for each +2%).
EAGER_TO_PLAY -
*/

const BOT_COIN_STANCE = ["RISK_AVERSE", "EAGER_TO_PLAY", "AVOID"];

module.exports = {
    BOT_CODE,
    BOT_EVENT,
    BOT_COIN_STANCE,
};
