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
            this.resetLock(name);
        }
    }

    addLocks(names) {
        names.forEach((name) => {
            /* If lock doesn't exist */
            if (typeof this.locks[name] !== undefined) {
                this.resetLock(name);
            }
        });
    }

    removeLock(name) {
        delete this.locks[name];
    }

    lock(name, coinId) {
        this.locks[name]["locked"] = true;
        this.locks[name]["coin"] = coinId;
    }

    async awaitLock(name, coinId) {
        if (this.locks[name]["coin"] === coinId) {
            await this.locks[name]["lock"];
        } else {
            return false;
        }
    }

    /* Need this form of a function because the 'this' points to the wrong 'this' (with non ES-6 syntax) */
    unlock = (name) => {
        this.locks[name]["tumbler"]();
        this.resetLock(name);
    };

    isLocked(name, coinId) {
        return (
            this.locks[name]["locked"] === true &&
            this.locks[name]["coin"] === coinId
        );
    }

    resetLock(name) {
        let tempTumbler = null;
        this.locks[name] = {
            tumbler: null,
            coin: -1,
            locked: false,
            lock: new Promise((resolve, reject) => {
                tempTumbler = resolve;
            }),
        };

        this.locks[name].tumbler = tempTumbler;
    }
}

module.exports = ProcessLocks;
