class ProcessLocks {
    constructor(locks = null) {
        this.locks = {};

        if (locks !== null) {
            this.addLocks(locks);
        }
    }

    addLock(name) {
        /* If lock doesn't exist */
        if (typeof this.locks[name] !== undefined) {
            this.locks[name] = { coin: -1, locked: false };
        }
    }

    addLocks(names) {
        names.forEach((name) => {
            /* If lock doesn't exist */
            if (typeof this.locks[name] !== undefined) {
                this.locks[name] = { coin: -1, locked: false };
            }
        });
    }

    removeLock(name) {
        delete this.locks[name];
    }

    lock(name, coinId) {
        this.locks[name]["coin"] = coinId;
    }

    unlock(name) {
        this.locks[name] = { coin: -1, locked: false };
    }

    isLocked(name) {
        return this.locks[name]["locked"] === true;
    }
}

module.exports = ProcessLocks;
