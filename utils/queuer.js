const { repeat } = require("lodash");
const Queue = require("./queue.js");

class Queuer {
    constructor() {
        this.queueArr = Array();
        this.lastTimeElapsed = 0;
        this.currentQueueIndex = 0;
    }

    /* Queue up new queues, along with the interval of time they should be run at */
    enqueueQueue(queue, interval, repeat = false, runParallel = false) {
        this.queueArr[this.queueArr.length] = {
            queue: queue,
            repeat: repeat,
            runParallel: runParallel /* This allows us to run the queue every in parallel  interval MS */,
            lastParallelElapsed: 0,
            interval: interval,
        };
    }

    processQueues() {
        /* Empty queue array? We don't process */
        if (this.queueArr.length === 0) return;

        /* Process parallel queues */
        this.queueArr.forEach((queueEl) => {
            if (queueEl.runParallel === true) {
                if (this.hasParallelIntervalElapsed(queueEl)) {
                    this.processQueue(
                        queueEl.queue,
                        queueEl.repeat,
                        queueEl.lastParallelElapsed,
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
        return now > queue.lastParallelElapsed + queue.interval;
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

    /* Process the queue and then dequeue the current item */
    processQueue(queue, repeat, lastParallelElapsed = false, queueEl = null) {
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

        /* Update the current elapsed time since we've now processed the queue */
        if (lastParallelElapsed !== false) {
            queueEl.lastParallelElapsed = Date.now();
        } else {
            this.lastTimeElapsed = Date.now();
        }
    }
}

module.exports = {
    Queuer,
};
