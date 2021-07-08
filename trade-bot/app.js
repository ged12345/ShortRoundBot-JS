const MainLogic = require('./main_logic.js').MainLogic;
const queue = require('../utils/queue.js');
const sleep = require('../utils/general.js').sleep;

const main = new MainLogic();
let unassignedBot = false;

init();

async function init() {
    let heartbeatId = setInterval(async () => {
        main.processQueues();
    }, 100);
}

/* Run exit handler and cleanup */
function exitHandler(options, exitCode) {
    if (options.cleanup) {
        console.log('Performed bot cleanup.');
    }

    if (exitCode || exitCode === 0) console.log(exitCode);
    if (options.exit) {
        if (unassignedBot === false) {
            console.log(`Unassigning bot: ${main.id}`);
            main.cleanup((success) => {
                unassignedBot = success;
            });
        } else {
            process.exit();
        }
    }
}

//do something when app is closing
process.on('exit', exitHandler.bind(null, { cleanup: true }));

//catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, { exit: true }));

// catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR1', exitHandler.bind(null, { exit: true }));
process.on('SIGUSR2', exitHandler.bind(null, { exit: true }));

//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, { exit: true }));
