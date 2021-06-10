const { TREND_SHAPE } = require('../coin-bot/constants.js');

function calculateTrendShape(trendArr) {
    /* trendArr is of the 3 different gradients and the general assessment of these values */

    //let gradientArr = trendArr[0];
    //let basicTrendArr = trendArr[1];
    let basicTrendArr = trendArr;

    /* Flat start */
    if (basicTrendArr[0] === 0) {
        if (basicTrendArr[1] === 0) {
            return TREND_SHAPE.FLAT;
        } else if (basicTrendArr[1] > 0 && basicTrendArr[1] <= 0.5) {
            return TREND_SHAPE.FLAT_TO_SLOPING_UP;
        } else if (basicTrendArr[1] > 0.5 && basicTrendArr[1] <= 1) {
            return TREND_SHAPE.FLAT_TO_SPIKING_UP;
        } else if (basicTrendArr[1] < 0 && basicTrendArr[1] >= -0.5) {
            return TREND_SHAPE.FLAT_TO_SLOPING_DOWN;
        } else if (basicTrendArr[1] < -0.5 && basicTrendArr[1] >= -1) {
            return TREND_SHAPE.FLAT_TO_DROPPING_DOWN;
        }
    } else if (basicTrendArr[1] === 0) {
        if (basicTrendArr[0] > 0 && basicTrendArr[0] <= 0.5) {
            return TREND_SHAPE.SLOPING_UP_TO_FLAT;
        } else if (basicTrendArr[0] > 0.5 && basicTrendArr[0] <= 1) {
            return TREND_SHAPE.SPIKING_UP_TO_FLAT;
        } else if (basicTrendArr[0] < 0 && basicTrendArr[0] >= -0.5) {
            return TREND_SHAPE.SLOPING_DOWN_TO_FLAT;
        } else if (basicTrendArr[0] < -0.5 && basicTrendArr[0] >= -1) {
            return TREND_SHAPE.DROPPING_DOWN_TO_FLAT;
        }
    } else if (basicTrendArr[0] === Number.MAX_SAFE_INTEGER) {
        // End of an upward u bend and then a slope up
        if (basicTrendArr[1] > 0.5) {
            return TREND_SHAPE.UPWARD_UBEND_HARD;
        } else if (basicTrendArr[1] > 0) {
            return TREND_SHAPE.UPWARD_UBEND_SOFT;
        } else if (basicTrendArr[1] === Number.MIN_SAFE_INTEGER) {
            return TREND_SHAPE.UPSIDE_DOWN_N;
        }
    } else if (basicTrendArr[0] === Number.MIN_SAFE_INTEGER) {
        // End of a downward u bend and then a slope down
        if (basicTrendArr[1] < -0.5) {
            return TREND_SHAPE.DOWNWARD_UBEND_HARD;
        } else if (basicTrendArr[1] < 0) {
            return TREND_SHAPE.DOWNWARD_UBEND_SOFT;
        } else if (basicTrendArr[1] === Number.MAX_SAFE_INTEGER) {
            return TREND_SHAPE.RIGHT_SIDE_N;
        }
    } else if (basicTrendArr[1] === Number.MAX_SAFE_INTEGER) {
        // Start of u bend and then a slope up
        if (basicTrendArr[0] < -0.5) {
            return TREND_SHAPE.UPWARD_UBEND_HARD;
        } else if (basicTrendArr[0] < 0) {
            return TREND_SHAPE.UPWARD_UBEND_SOFT;
        }
    } else if (basicTrendArr[1] === Number.MIN_SAFE_INTEGER) {
        // Start of u bend and then a slope down
        if (basicTrendArr[0] > 0.5) {
            return TREND_SHAPE.DOWNWARD_UBEND_HARD;
        } else if (basicTrendArr[0] > 0) {
            return TREND_SHAPE.DOWNWARD_UBEND_SOFT;
        }
    } else if ((basicTrendArr[0] + basicTrendArr[1]) / 2.0 >= 0.75) {
        return TREND_SHAPE.SPIKING_UP;
    } else if ((basicTrendArr[0] + basicTrendArr[1]) / 2.0 > 0) {
        return TREND_SHAPE.SLOPING_UP;
    } else if ((basicTrendArr[0] + basicTrendArr[1]) / 2.0 <= -0.85) {
        return TREND_SHAPE.CRASHING;
    } else if ((basicTrendArr[0] + basicTrendArr[1]) / 2.0 <= -0.5) {
        return TREND_SHAPE.DROPPING_DOWN;
    } else if ((basicTrendArr[0] + basicTrendArr[1]) / 2.0 < 0) {
        return TREND_SHAPE.SLOPING_DOWN;
    }
}

module.exports = { calculateTrendShape };
