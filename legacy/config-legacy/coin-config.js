module.exports = (function () {
    var config = {
        // Coin and stability level (5-1), with less stable coins being less preferred. O = do not buy.
        stableAltCoinCodes: {
            //BITCOIN
            XXBTZUSD: 5,
            // ETHERIUM
            XETHZUSD: 5,
            // RIPPLE
            XXRPZUSD: 4,
            // YFI
            YFIUSD: 4,
            // DOGE
            XDGUSD: 3,
            // LITECOIN
            XLTCZUSD: 3,
            // TETHER
            USDTZUSD: 2,
        },
        // In seconds
        OHLCCheckInt: 10800,
        // Order book isn't needed every second, just a snapshot we can operate from.
        OrderBookInt: 15,
    };
    function init() {}
    return { config: config, init: init };
})();
