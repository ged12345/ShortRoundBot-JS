const Queuer = require("../utils/queuer.js").Queuer;
const Queue = require("../utils/queue.js");

this.mainQueuer = new Queuer();
/* This is the queue to check coin bot, whether locked or not */
this.coinAdviceQueue = new Queue();
/* This is the queue to check for the bots current trades, whether they've completed etc. */
this.tradeOrderQueue = new Queue();

/* Test the queuing index */
test("Check queue array length #1", () => {
    expect(this.mainQueuer.queueArr.length).toEqual(0);
});

test("Check queue array length #2", () => {
    this.mainQueuer.enqueueQueue(this.coinAdviceQueue, 500);
    expect(this.mainQueuer.queueArr.length).toEqual(1);
});

test("Check queue array length #3", () => {
    this.mainQueuer.enqueueQueue(this.tradeOrderQueue, 500);
    expect(this.mainQueuer.queueArr.length).toEqual(2);
});

/* Test the existence of the queues */
test("Check queue equality #1 - index 0", () => {
    expect(this.mainQueuer.queueArr[0].queue).toEqual(this.coinAdviceQueue);
});

test("Check queue equality #2 - index 1", () => {
    expect(this.mainQueuer.queueArr[1].queue).toEqual(this.tradeOrderQueue);
});

/* For check time elapsed start */
let lastTimeElapsedStart = Date.now();

/* Test the queuing index */
test("Check queue index #1", () => {
    expect(this.mainQueuer.currentQueueIndex).toEqual(0);
});
// Usage!
sleep(500).then(() => {
    this.mainQueuer.processQueues();
    test("Check queue index #2", () => {
        expect(this.mainQueuer.currentQueueIndex).toEqual(1);
    });

    test("Check time elapsed #1", () => {
        expect(this.mainQueuer.lastTimeElapsed).toBeGreater(
            lastTimeElapsedStart
        );
    });
    lastTimeElapsedStart = Date.now();
});

sleep(1000).then(() => {
    this.mainQueuer.processQueues();

    test("Check queue index #3", () => {
        expect(this.mainQueuer.currentQueueIndex).toEqual(0);
    });

    test("Check time elapsed #2", () => {
        expect(this.mainQueuer.lastTimeElapsed).toBeGreater(
            lastTimeElapsedStart
        );
    });
});

/* Utility functions */

// sleep time expects milliseconds
function sleep(time) {
    return new Promise((resolve) => setTimeout(resolve, time));
}
