const { builtinModules } = require("module");
/* Allows us to turn console.log on and off */
module.exports.logger = (function () {
    var oldConsoleLog = null;
    var pub = {};

    pub.enableLogger = function enableLogger() {
        if (oldConsoleLog == null) return;
        global["console"]["log"] = oldConsoleLog;
    };

    pub.disableLogger = function disableLogger() {
        oldConsoleLog = console.log;
        global["console"]["log"] = function () {};
    };

    return pub;
})();
