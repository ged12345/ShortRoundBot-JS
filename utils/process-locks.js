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
            this.locks[name] = { coin: -1, locked: false, lock: new Promise() };
        }
    }

    addLocks(names) {
        names.forEach((name) => {
            /* If lock doesn't exist */
            if (typeof this.locks[name] !== undefined) {
                this.locks[name] = {
                    coin: -1,
                    locked: false,
                    lock: new Promise(),
                };
            }
        });
    }

    removeLock(name) {
        delete this.locks[name];
    }

    lock(name, coinId) {
        this.locks[name]["coin"] = coinId;
    }

    async awaitLock(name) {
        await this.locks[name]["lock"];
    }

    unlock(name) {
        this.locks[name]["lock"].resolve();
        this.locks[name] = { coin: -1, locked: false, lock: new Promise() };
    }

    isLocked(name) {
        return this.locks[name]["locked"] === true;
    }
}

module.exports = ProcessLocks;
