const queue = require("../utils/queue.js");

/* So for each coin, we need to populate a data structure with the following info.

// Update these every 30 mins.
Price Last 24-hr High
Price Last 24-hr Low

Price Now
Price List of the past 20 intervals of time - this is basically a FILO queue.
Price 10 mins ago
Price 30 mins ago
Price 1 Hr ago

We also need to work out percentages - how far we've risen or fall in the past 5 mins, past 10 mins, past 30 mins, past hour, past 3 hours

// Eventually, we'll do current buy or sell volume.

How do we get 10 mins and 1 hour ago?
*/

/* Ticker is up to the second. I need this. */

https://api.kraken.com/0/public/Ticker
/* The OHLC goes back 12 hours.  I can grab that once an hour to process. */
/* Will need these calls time-stamped so we can do a comparison between now and then */
