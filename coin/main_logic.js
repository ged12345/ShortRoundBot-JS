const queue = require("../utils/queue.js");

/* So for each coin, we need to populate a data structure with the following info.

// Update these every 30 mins.
Price Last 24-hr High
Price Last 24-hr Low

Price Now
Price List of the past 20 intervals of time - this is basically a FILO queue.
Price 10 mins ago
Price 1 Hr ago

// Eventually, we'll do current buy or sell volume.

How do we get 10 mins and 1 hour ago?
*/

/* The ticker info I can get every three hours. It doesn't change that often. */
https://api.kraken.com/0/public/Ticker
/* The OHLC goes back 12 hours.  I can grab that once an hour to process. */
/* Will need these calls time-stamped so we can do a comparison between now and then */
