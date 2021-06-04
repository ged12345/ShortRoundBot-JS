function calculateGraphGradients(pointArr) {
    if (pointArr.length <= 1) {
        return null;
    }

    let gradientArr = [];
    let trendArr = [];

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
                if (gradient1 > 0 && gradient2 > 0) {
                    /* Gradients are too different but still trendinf up */
                    if (Math.abs(gradient1 - gradient2) > 0.1705) {
                        // Weak upward trend
                        trendArr.push(0.5);
                    } else {
                        // Strong upward trend
                        trendArr.push(1);
                    }
                } else if (gradient1 < 0 && gradient2 < 0) {
                    /* Gradients are too different but still trending up */
                    if (Math.abs(gradient1 - gradient2) > 0.1705) {
                        // Weak downward trend
                        trendArr.push(-0.5);
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
                } else {
                    // No trend
                    trendArr.push(null);
                }
            }
        }
    });

    /*
    TO-DO:
    Once we've calulated all the normalised gradients, we should perhaps create a second array with 3 values that indicates from constant whether sloping up, sloping down, or sideways/straight horizontal. Or perhaps a grouping function? Perhaps create a helped function elsewhere?
    */
    return [gradientArr, trendArr];
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

module.exports = { calculateGraphGradients, calculateSellUrgencyFactor };
