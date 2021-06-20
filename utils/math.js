const { TREND_SHAPE } = require('../coin-bot/constants');
const { calculateTrendShape } = require('./trend');

function calculateGraphGradientsTrendsPerChange(
    pointArr,
    isValuePercentage = false,
    debug = ''
) {
    if (pointArr.length <= 1) {
        return null;
    }

    let gradientArr = [];
    let trendArr = [];
    let shape = TREND_SHAPE.FLAT;

    pointArr.forEach((currPt, index) => {
        if (index > 0) {
            /* Remember: X-axis is an arbitrary 1 unit, so the slope just equals the y-value, unless we're taking into account multiple points. */
            let lastPt = pointArr[index - 1];

            /* We normalise the gradient to being a value from 1 to -1. We do this by finding the angle and then dividing by 90 deg. */
            /* Formula: 𝛼 = arctan(𝑚)/ 90 deg  (arc tan returns radians, so conversion was required of 2/PI)*/
            let normGradient =
                (Math.atan((currPt - lastPt) / 1.0) * 2) / Math.PI;
            gradientArr.push(normGradient);

            if (gradientArr.length > 1) {
                let gradient1 = gradientArr[gradientArr.length - 2];
                let gradient2 = normGradient;
                calculateGradientValues(gradient1, gradient2, trendArr);
            }
        }
    });

    currShape = calculateTrendShape(trendArr);
    perChangeArr = [];

    /* Percentage change between each point in the PointArr (0-100)*/
    if (isValuePercentage) {
        perChangeArr[0] =
            Number(pointArr[0]) !== Number(0.0)
                ? (pointArr[1] / pointArr[0] - 1.0) * 100
                : 0;
        perChangeArr[1] =
            Number(pointArr[1]) !== Number(0.0)
                ? (pointArr[2] / pointArr[1] - 1.0) * 100
                : 0;
        perChangeArr[2] =
            Number(pointArr[2]) !== Number(0.0)
                ? (pointArr[3] / pointArr[2] - 1.0) * 100
                : 0;
        if (debug !== '') {
            console.log(debug, ' ', pointArr);
        }
    } else {
        if (debug !== '') {
            console.log(debug, ' ', pointArr);
        }
        perChangeArr[0] = pointArr[1] - pointArr[0];
        perChangeArr[1] = pointArr[2] - pointArr[1];
        perChangeArr[2] = pointArr[3] - pointArr[2];
    }

    /*
    TO-DO:
    Once we've calulated all the normalised gradients, we should perhaps create a second array with 3 values that indicates from constant whether sloping up, sloping down, or sideways/straight horizontal. Or perhaps a grouping function? Perhaps create a helped function elsewhere?
    */
    return [gradientArr, trendArr, currShape, perChangeArr];
}

function calculateGradientValues(gradient1, gradient2, trendArr) {
    /* we need to cover flat gradient and then slope too (hence the two additional checks below */
    if (
        (gradient1 > 0 && gradient2 > 0) ||
        (gradient1 === 0 && gradient2 > 0) ||
        (gradient1 > 0 && gradient2 === 0)
    ) {
        /* Gradients are too different but still trending up */
        if ((gradient1 + gradient2) / 2 <= 0.25) {
            // Weakest upward trend
            trendArr.push(0.25);
        } else if ((gradient1 - gradient2) / 2 <= 0.5) {
            // Weakish upward trend
            trendArr.push(0.5);
        } else if ((gradient1 - gradient2) / 2 <= 0.75) {
            // Less strong upward trend
            trendArr.push(0.75);
        } else {
            // Strong upward trend
            trendArr.push(1);
        }
    } else if (
        (gradient1 < 0 && gradient2 < 0) ||
        (gradient1 === 0 && gradient2 < 0) ||
        (gradient1 < 0 && gradient2 === 0)
    ) {
        /* Gradients are too different but still trending down */
        if ((gradient1 + gradient2) / 2 >= -0.25) {
            // Weak downward trend
            trendArr.push(-0.25);
        } else if ((gradient1 + gradient2) / 2 >= -0.5) {
            // Weak downward trend
            trendArr.push(-0.5);
        } else if ((gradient1 + gradient2) / 2 >= -0.75) {
            // Weak downward trend
            trendArr.push(-0.75);
        } else {
            // Strong downward trend
            trendArr.push(-1);
        }
    } else if (
        /* If we're very close to a horizontal line here */
        Math.abs(gradient1) < 0.3 &&
        Math.abs(gradient2) < 0.3
    ) {
        // Sideways trend
        trendArr.push(0);
    } else if (gradient1 < 0 && gradient2 > 0) {
        // No trend - probably an upward u-bend shape
        trendArr.push(Number.MAX_SAFE_INTEGER);
    } else if (gradient1 > 0 && gradient2 < 0) {
        // No trend - probably a downward u-bend shape
        trendArr.push(Number.MIN_SAFE_INTEGER);
    }
}

/* We're basically calculating a profit heuristic. If we're not profitting enough, sell coin and move on. We should, however, hold onto a coin for a minimum amount of time, otherwise we're just selling over and over without taking a little risk. We only definitey sell when the coin value has dropped. */
function calculateSellUrgencyFactor(
    initialClose,
    currentClose,
    initialTimestamp,
    currTimestamp,
    minCoinAppreciationPercentPerMin,
    maxTradeTime
) {
    /* We return a sell urgency factor here, from 0.0 to 1.0 */
    let sellUrgencyFactor = 0.0;
    let closeInterval = currentClose - initialClose;
    let timestampInterval = currTimestamp - initialTimestamp;
    let timePassedInSecs = timestampInterval / 1000.0;

    /* We let the price go into the negative briefly, but not too deeply. We have our stop-loss set as a just in case, but we my want to sell if there is a clear downtrend establishing */
    if (closeInterval < 0 && timePassedInSecs <= 60) {
        sellUrgencyFactor = 0.25;
    } else if (
        closeInterval < 0 &&
        timePassedInSecs > 60 &&
        timePassedInSecs <= 120
    ) {
        sellUrgencyFactor = 0.55;
    } else if (closeInterval < 0 && timePassedInSecs > 120) {
        sellUrgencyFactor = 0.75;
    } else if (
        closeInterval > 0 &&
        closeInterval <
            initialClose +
                initialClose *
                    minCoinAppreciationPercentPerMin *
                    (timePassedInSecs / 60.0)
    ) {
        sellUrgencyFactor = 0.5;
    } else if (closeInterval > 0 && timePassedInSecs > maxTradeTime) {
        /* Sell, as we've held onto this coin too long */
        sellUrgencyFactor = 1.0;
    }

    return sellUrgencyFactor;
}

function getRandomInt(max) {
    return Math.floor(Math.random() * max);
}

module.exports = {
    calculateGraphGradientsTrendsPerChange,
    calculateSellUrgencyFactor,
    getRandomInt,
};
