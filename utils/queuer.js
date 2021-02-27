const { repeat } = require("lodash");
const Queue = require("./queue.js");

class Queuer {
    constructor() {
        this.queueArr = Array();
        this.lastTimeElapsed = Date.now();
        this.currentQueueIndex = 0;
    }

    /* Queue up new queues, along with the interval of time they should be run at */
    enqueueQueue(queue, interval, repeat = false) {
        this.queueArr[this.queueArr.length] = {
            queue: queue,
            repeat: repeat,
            interval: interval,
        };
    }

    processQueues() {
        const currentQueue = this.queueArr[this.currentQueueIndex];
        const currentQueueInterval = currentQueue.interval;
        if (this.hasQueueIntervalElapsed(currentQueueInterval)) {
            /* Here we process the queue, then move to the next queue for processing */
            this.processQueue(currentQueue.queue, currentQueue.repeat);
            this.incrementCurrentQueue();
        }
    }

    /* Checks if the current queue interval has elapsed by looking at last time we ran a queue */
    hasQueueIntervalElapsed(queueInterval) {
        const now = Date.now();
        return now > this.lastTimeElapsed + queueInterval;
    }

    /* How we iterate through the queue and cycle back */
    incrementCurrentQueue() {
        this.currentQueueIndex++;
        if (this.currentQueueIndex >= this.queueArr.length) {
            this.currentQueueIndex = 0;
        }
    }

    /* Process the queue and then dequeue the current item */
    processQueue(queue, repeat) {
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
        this.lastTimeElapsed = Date.now();
    }
}

module.exports = {
    Queuer,
};
