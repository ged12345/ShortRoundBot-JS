const { repeat } = require("lodash");
const Queue = require("./queue.js");

class Queuer {
    constructor() {
        this.queueArr = Array();
        this.lastTimeElapsed = Date.now();
        this.currentQueueIndex = 0;
    }

    /* Queue up new queues, along with the interval of time they should be run at */
    enqueueQueue(
        queue,
        interval,
        repeat = false,
        runParallel = false,
        lockToMinute = false,
        /* Always push running after minute is up */
        lockOffset = 1000
    ) {
        let now = Date.now();

        this.queueArr[this.queueArr.length] = {
            queue: queue,
            repeat: repeat,
            interval: interval /* In MS, as is Date.now() */,
            runParallel: runParallel /* This allows us to run the queue every in parallel  interval MS */,
            lastParallelElapsed: lockToMinute
                ? now + (60000 - (now % 60000)) + lockOffset
                : now,
            lockOffset: lockOffset,
            lockToMinute: lockToMinute,
        };
    }

    processQueues() {
        /* Empty queue array? We don't process */
        if (this.queueArr.length === 0) return;

        /* Process parallel queues */
        this.queueArr.forEach((queueEl) => {
            if (queueEl.runParallel === true && queueEl.lockToMinute === true) {
                if (this.hasParallelIntervalElapsed(queueEl)) {
                    let queueLen = queueEl.queue.length();
                    for (var i = 0; i < queueLen; i++) {
                        let lastElInQueue = false;
                        if (i === queueLen - 1) {
                            lastElInQueue = true;
                        }
                        this.processQueueParallel(
                            queueEl.queue,
                            queueEl.repeat,
                            queueEl,
                            true,
                            lastElInQueue
                        );
                    }
                }
            } else if (queueEl.runParallel === true) {
                if (this.hasParallelIntervalElapsed(queueEl)) {
                    this.processQueueParallel(
                        queueEl.queue,
                        queueEl.repeat,
                        queueEl
                    );
                }
            }
        });

        /* Process sequential queues */
        const currentQueue = this.queueArr[this.currentQueueIndex];
        if (!currentQueue.runParallel) {
            const currentQueueInterval = currentQueue.interval;
            if (this.hasQueueIntervalElapsed(currentQueueInterval)) {
                /* Here we process the queue, then move to the next queue for processing */
                this.processQueue(currentQueue.queue, currentQueue.repeat);
                this.incrementCurrentQueue();
            }
        }
    }

    /* Checks if the current queue interval has elapsed by looking at last time we ran a queue */
    hasQueueIntervalElapsed(queueInterval) {
        const now = Date.now();
        return now > this.lastTimeElapsed + queueInterval;
    }

    /* Checks if the current queue interval has elapsed by looking at the last bypass time we ran a queue */
    hasParallelIntervalElapsed(queue) {
        const now = Date.now();
        if (queue.lockToMinute === true) {
            return now > queue.lastParallelElapsed;
        } else {
            return now > queue.lastParallelElapsed + queue.interval;
        }
    }

    /* How we iterate through the queue and cycle back */
    incrementCurrentQueue() {
        /* If we have a parallel queue, keep incrementing the queue index */
        /* We also add a queue limiter that only allows one iteration through the queue, just in case we only have parallel queues. */
        let queueLengthLimitIndex = 0;

        do {
            this.currentQueueIndex++;

            if (this.currentQueueIndex >= this.queueArr.length) {
                this.currentQueueIndex = 0;
            }

            queueLengthLimitIndex++;
        } while (
            this.queueArr[this.currentQueueIndex].runParallel &&
            queueLengthLimitIndex < this.queueArr.length
        );
    }

    baseProcessQueue(queue, repeat) {
        if (queue.peek() !== null) {
            if (repeat === true) {
                queue.peek()();
                let repeatElement = queue.dequeue();
                queue.enqueue(repeatElement);
            } else {
                queue.peek()();
                queue.dequeue();
            }
        }
    }

    /* Process the queue and then dequeue the current item */
    processQueue(queue, repeat) {
        this.baseProcessQueue(queue, repeat);

        /* Update the current elapsed time since we've now processed the queue */
        let now = Date.now();

        this.lastTimeElapsed = now;
    }

    processQueueParallel(
        queue,
        repeat,
        queueEl = null,
        timeLock = false,
        lastTimeLock = false
    ) {
        this.baseProcessQueue(queue, repeat);

        /* Update the current elapsed time since we've now processed the queue */
        let now = Date.now();

        /*
        Lock to minute so we get information as close to 'close' as possible.
        Note: 60000 because 60 minutes, but in MS
        */
        if (
            (timeLock === true &&
                lastTimeLock === true &&
                queueEl.lockToMinute === true) ||
            (timeLock === false && queueEl.lockToMinute === true)
        ) {
            /* In MS, Rob */
            now = now + (60000 - (now % 60000)) + queueEl.lockOffset;
            if (queueEl.lockOffset < 0) {
                now += 60000;
            }
        }

        queueEl.lastParallelElapsed = now;
    }
}

module.exports = {
    Queuer,
};
