const PLOTLY = require("../legacy/config/plotly-config.js");
let plotly = require("../coin-bot/node_modules/plotly")(
    PLOTLY.config.username,
    PLOTLY.config.apiKey
);

class Plotly {
    graphOptions = {
        filename: "coin-axes",
        fileopt: "overwrite",
        layout: {
            grid: {
                rows: 2,
                columns: 1,
                pattern: "independent",
                roworder: "top to bottom",
            },
            xaxis: { range: [0, 31] },
            yaxis: { range: [-2, 102] },
            xaxis2: { range: [0, 31] },
            yaxis2: { range: [-2, 102] },
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
                    opacity: 0.5,
                    layer: "below",
                },
                {
                    type: "line",
                    xref: "paper",
                    x0: 0,
                    y0: 66.66,
                    x1: 1,
                    y1: 66.66,
                    line: {
                        color: "rgb(255, 0, 0)",
                        width: 2,
                        dash: "dot",
                    },
                    opacity: 0.5,
                    layer: "below",
                },
                {
                    type: "line",
                    xref: "paper",
                    x0: 0,
                    y0: 33.33,
                    x1: 1,
                    y1: 33.33,
                    line: {
                        color: "rgb(255, 0, 0)",
                        width: 2,
                        dash: "dot",
                    },
                    opacity: 0.5,
                    layer: "below",
                },
                {
                    type: "line",
                    xref: "paper",
                    yref: "y2",
                    x0: 0,
                    y0: 20,
                    x1: 1,
                    y1: 20,
                    line: {
                        color: "rgb(255, 0, 0)",
                        width: 2,
                        dash: "dot",
                    },
                    opacity: 0.5,
                    layer: "below",
                },
                {
                    type: "line",
                    xref: "paper",
                    yref: "y2",
                    x0: 0,
                    y0: 80,
                    x1: 1,
                    y1: 80,
                    line: {
                        color: "rgb(255, 0, 0)",
                        width: 2,
                        dash: "dot",
                    },
                    opacity: 0.5,
                    layer: "below",
                },
            ],
        },
    };

    data = null;

    constructor(
        rsi_x1 = null,
        rsi_y1 = null,
        sto_x1 = null,
        sto_y1 = null,
        sto_x2 = null,
        sto_y2 = null
    ) {
        if (rsi_x1 === null) {
            this.data = [
                {
                    x: [
                        "2013-10-04 22:23:00",
                        "2013-10-04 22:23:30",
                        "2013-10-04 22:24:00",
                    ],
                    y: [1, 3, 6],
                    type: "line",
                    name: "RSI",
                    line: { shape: "spline", smoothing: 1.3 },
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
                    type: "line",
                    name: "Stochastic",
                    line: { shape: "spline", smoothing: 1.3 },
                },
            ];
        } else {
            this.data = [
                {
                    x: rsi_x1,
                    y: rsi_y1,
                    type: "scatter",
                    mode: "lines",
                    name: "RSI",
                    line: { shape: "spline", smoothing: 0.65 },
                },
                {
                    x: sto_x1,
                    y: sto_y1,
                    xaxis: "x2",
                    yaxis: "y2",
                    type: "scatter",
                    mode: "lines",
                    name: "Stochastic - kFast",
                    line: { shape: "spline", smoothing: 0.65 },
                },
                {
                    x: sto_x2,
                    y: sto_y2,
                    xaxis: "x2",
                    yaxis: "y2",
                    type: "scatter",
                    mode: "lines",
                    name: "Stochastic - dSlow",
                    line: { shape: "spline", smoothing: 0.65 },
                },
            ];
        }
    }

    plot() {
        plotly.plot(this.data, this.graphOptions, function (err, msg) {
            console.log(msg);
        });
    }
}

module.exports = {
    Plotly,
};
