const standardiseOHLCResultBybit = (result) => {
    /* Mysql format */
    // open=${results[1]}, high=${results[2]}, low=${results[3]}, close=${results[4]}, vwap=${results[5]}, volume=${results[6]}, count=${results[7]

    /*
    startTime	long	Start time, unit in millisecond
    open	float	Open price
    high	float	High price
    low	float	Low price
    close	float	Close price
    volume	float	Trading volume
    endTime	long	End time, unit in millisecond
    quoteAssetVolume	float	Quote asset volume
    trades	integer	Number of trades
    takerBaseVolume	float	Taker buy volume in base asset
    takerQuoteVolume	float	Taker buy volume in quote asset

    */

    return [
        result[0] / 1000,
        result[1],
        result[2],
        result[3],
        result[4],
        0,
        result[5],
        result[8],
    ];
};

module.exports = { standardiseOHLCResultBybit };
