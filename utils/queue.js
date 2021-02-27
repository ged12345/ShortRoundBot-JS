function Queue() {
    this.elements = [];
}

Queue.prototype.enqueue = function (e) {
    this.elements.push(e);
};

// remove an element from the front of the queue
Queue.prototype.dequeue = function () {
    if (this.elements.length > 0) return this.elements.shift();
    else return () => {};
};

// check if the queue is empty
Queue.prototype.isEmpty = function () {
    return this.elements.length == 0;
};

// get the element at the front of the queue
Queue.prototype.peek = function () {
    return !this.isEmpty() ? this.elements[0] : null;
};

Queue.prototype.length = function () {
    return this.elements.length;
};

module.exports = Queue;
