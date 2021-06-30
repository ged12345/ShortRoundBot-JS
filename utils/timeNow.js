class TimeNow {
    static startTimeOffset = -1;
    static startTimestamp = 0;
    static intervalLock = 60 * 1000;
    static intervalDelay = 333;
    static forceIterate = false;
    static finishedIterate = false;
    static forceNowStartTimestamp = 0;
    static forceNowEndTimestamp = 0;

    static setStartTime(startTimestamp, intervalLock = 60) {
        TimeNow.intervalLock = intervalLock * 1000;
        TimeNow.startTimestamp = startTimestamp;
        TimeNow.startTimeOffset =
            Date.now() -
            (Date.now() % TimeNow.intervalLock) -
            startTimestamp * 1000;
    }

    static setStartEndIterateTime(
        startTimestamp,
        endTimestamp,
        intervalLock = 60,
        intervalDelay = 333
    ) {
        TimeNow.forceNowStartTimestamp = startTimestamp;
        TimeNow.forceNowEndTimestamp = endTimestamp;
        TimeNow.forceIterate = true;
        TimeNow.intervalLock = intervalLock * 1000;
        TimeNow.intervalDelay = intervalDelay;
    }

    static startIterate() {
        if (TimeNow.forceIterate !== true) {
            return;
        }

        setInterval(() => {
            if (TimeNow.finishedIterate !== true) {
                TimeNow.iterate();
            }
        }, TimeNow.intervalDelay);
    }

    static iterate() {
        /* Only force iterate until we hit our end timestamp if we have one */

        console.log('ITERATE');
        if (TimeNow.finishedIterate === true) {
            return;
        }
        TimeNow.forceNowStartTimestamp += TimeNow.intervalLock;

        if (TimeNow.forceNowStartTimestamp >= TimeNow.forceNowEndTimestamp) {
            TimeNow.finishedIterate = true;
        }
    }

    static now() {
        return TimeNow.nowMilliseconds();
    }

    /* Returns actual now minus the offset, so current time but that many minutes and hours ago - useful for the queuer */
    static nowOffset() {
        if (TimeNow.startTimeOffset === -1) {
            return Date.now();
        } else if (TimeNow.forceIterate) {
            return Date.now() - TimeNow.startTimeOffset;
        } else {
            return TimeNow.forceNowStartTimestamp + (Date.now() % intervalLock);
        }
    }

    static nowMilliseconds() {
        /* Return normal time in milliseconds if we haven't properly setup this class */
        if (TimeNow.startTimeOffset === -1) {
            return Date.now();
        } else if (TimeNow.forceIterate) {
            return TimeNow.forceNowStartTimestamp;
        } else {
            return (
                Date.now() -
                (Date.now() % TimeNow.intervalLock) -
                TimeNow.startTimeOffset
            );
        }
    }

    static nowSeconds() {
        return parseInt(TimeNow.nowMilliseconds() * 1000, 10);
    }
}

module.exports = TimeNow;
