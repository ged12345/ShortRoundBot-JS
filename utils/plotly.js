const PLOTLY = require("../legacy/config/plotly-config.js");
let plotly = require("../coin-bot/node_modules/plotly")(
    PLOTLY.config.username,
    PLOTLY.config.apiKey
);

class Plotly {
    layout = {
        grid: {
            rows: 2,
            columns: 1,
            pattern: "independent",
            roworder: "top to bottom",
        },
        shapes: [
            {
                type: "line",
                xref: "paper",
                x0: 0,
                y0: 50.0,
                x1: 1,
                y1: 50.0,
                line: {
                    color: "rgb(0, 0, 255)",
                    width: 2,
                    dash: "dot",
                },
            },
        ],
    };

    graphOptions = {
        filename: "coin-axes",
        fileopt: "overwrite",
        layout: layout,
    };

    constructor(rsi_x1 = null, rsi_y1 = null, sto_x1 = null, sto_y1 = null) {
        if (rsi_x1 === null) {
            data = [
                {
                    x: [
                        "2013-10-04 22:23:00",
                        "2013-10-04 22:23:30",
                        "2013-10-04 22:24:00",
                    ],
                    y: [1, 3, 6],
                    type: "scatter",
                    name: "RSI",
                },
                {
                    x: [
                        "2013-10-04 22:23:00",
                        "2013-10-04 22:23:30",
                        "2013-10-04 22:24:00",
                    ],
                    y: [4, 8, 12],
                    xaxis: "x2",
                    yaxis: "y2",
                    type: "scatter",
                    name: "Stochastic",
                },
            ];
        } else {
            data = [
                {
                    x: rsi_x1,
                    y: rsi_y1,
                    type: "scatter",
                    name: "RSI",
                },
                {
                    x: sto_x1,
                    y: sto_y1,
                    xaxis: "x2",
                    yaxis: "y2",
                    type: "scatter",
                    name: "Stochastic",
                },
            ];
        }
    }

    plot() {
        plotly.plot(data, graphOptions, function (err, msg) {
            console.log(msg);
        });
    }
}
