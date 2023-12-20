// chart-js wrapper / helper for real-time charts
// m a chatterjee defio@deftio.com
// may depend on bitwrench.js for some DOM functions 


// ===================================
// make a new chart

const gchartJSDefaultOptions = {
    type: 'line',
    options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
            duration: 0 // Disable animation for smoother real-time updates
        },
        scales: {
            y: {
                beginAtZero: true,
                //min: -100,  
                //max: 100
            }
        },
        legend: {
            display: false,
            labels: {
                usePointStyle: false,
            },
        },
        plugins: {
            title: {
                display: false,
                color: "#aaa"
            },
            legend: {
                display: false
            },
        }
    }
}


// chart == chart object / DOM element can be div or canvas (native is canvas, supports)
// dims  == number of traes to support
// maxXLen == max number of data points to store in the chart object
// yrange == [min, max]  min/max of y axes (optional, example [-10, 10]
// options == full chartjs supported options


let newChartJSLineChart = function (domEl, dims, title, maxXLen, yrange = null, options = gchartJSDefaultOptions) {

    let el = bw.DOM(domEl)
    if (el.length < 1) {
        console.log("bad DOM element selector");
        return;
    }
    el = el[0];
    if (bw.typeOf(el) != "htmlcanvaselement") {
        if (bw.typeOf(el) == "htmldivelement") {
            el.innerHTML = bw.html({ t: "canvas", a: { style: "height: 100%; width: 100%" } })
            el = el.firstChild;
        }
        else {
            console.log("bad DOM element");
            return;
        }
    }

    let ctx = bw.DOM(el)[0].getContext('2d');

    let chartOpts = JSON.parse(JSON.stringify(options));
    let xdatasets = new Array(dims).fill(0).map(
        (_, i) => {
            let x =
            {
                "label": 'series-' + i,
                "data": [],
                "borderColor": ['cyan', 'red', 'green', 'orange', 'cyan', 'yellow', 'teal'][i % 7],
                "pointRadius": 0,
                "borderWidth": 1,
                "fill": false
            }
            return x;
        });
    chartOpts["data"] = {
        labels: Array.from({ length: maxXLen }, (_, i) => i),
        datasets: JSON.parse(JSON.stringify(xdatasets)),

    }
    if (title != "" || title != null) {
        chartOpts.options.plugins.title.text = title;
        chartOpts.options.plugins.title.display = true;
    }

    if (bw.typeOf(yrange) == "array") {
        chartOpts.options.scales.y.min = yrange[0];
        chartOpts.options.scales.y.max = yrange[1];
    }
    // create a new chart object
    const chart = new Chart(ctx, chartOpts);
    chart.xw_maxLength = maxXLen;

    // Function to update the chart with new data for each trace
    chart.updateChart = function (values, render = true) {
        let i;
        if (values) {
            for (i = 0; i < this.data.datasets.length; i++) { // each trace
                let y = 0;
                if (values[i].length > 1) {
                    if (i == 0) {
                        this.data.labels.push(values[i][0]);
                        if (this.data.labels.length > this.xw_maxLength) {
                            this.data.labels.shift();
                        }
                    }
                    y = values[i][1];
                }
                else {
                    y = values[i];
                }

                this.data.datasets[i].data.push(y);

                if (this.data.datasets[i].data.length > this.xw_maxLength) {
                    this.data.datasets[i].data.shift();
                }
            }
        }

        if (render)
            chart.update();
    }

    return chart;
}


// ===================================

// Configurations for the radar chart
const radarDefaultConfig = {
    type: 'radar',
    data: {
        labels: ['Thich Accel', 'Calf Accel', 'Total Accel', 'Thigh Force', 'Calf Force', 'Total Force'],
        datasets: [{
            label: '',
           // display: false,
            data: [0, 0, 0, 0, 0, 0],
            fill: true,
            backgroundColor: 'rgba(55  , 99, 132, 0)',
            borderColor: 'rgb(0, 99, 132)', // line color
            pointBackgroundColor: '#00CC00',
            boxWidth: 0,
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: 'rgb(255, 99, 132)'
        }]
    },
    options: {
        elements: {
            line: {
                borderWidth: 1.5,
                fill: true,
                backgroundColor: 'rgba(55  , 99, 132, 0)',
                color: 'rgb(0, 99, 192)' // line color
            }
        },
        scales: {
            r: {
                min: 0,
                max: 100,
                ticks: {
                    stepSize: 20
                },  grid: {
                    color: '#004444'  // grid line color 
                }
            }
        }
    }

};

function rangeMapper(x, xmin, xmax, ymin, ymax, constant = 9) {
    // Ensure x is within the range [xmin, xmax]
    x = Math.max(xmin, Math.min(x, xmax));

    // Normalize x to a value between 0 and 1
    const normalizedX = (x - xmin) / (xmax - xmin);

    // Apply a logarithmic transformation to normalizedX
    // Using the provided constant (default 9) in the logarithm
    const transformedX = Math.log(1 + constant * normalizedX) / Math.log(1 + constant);

    // Map the transformedX to the range [ymin, ymax]
    const y = ymin + transformedX * (ymax - ymin);

    return y;
}

let newChartJSRadarChart = function (domEl, labels, title, maxXLen, yrange = null, options = radarDefaultConfig) {
    // Initialize the radar chart
    let el = bw.DOM(domEl)
    if (el.length < 1) {
        console.log("bad DOM element selector");
        return;
    }
    el = el[0];
    if (bw.typeOf(el) != "htmlcanvaselement") {
        if (bw.typeOf(el) == "htmldivelement") {
            el.innerHTML = bw.html({ t: "canvas", a: { style: "height: 100%; width: 100%" } })
            el = el.firstChild;
        }
        else {
            console.log("bad DOM element");
            return;
        }
    }

    let ctx = bw.DOM(el)[0].getContext('2d');

    let chartOpts = JSON.parse(JSON.stringify(options));
    options.data.labels = labels;
    options.plugins     = { legend: { display: false } } 
    // options.data.datasets[0].label = false;
    options.options.scales.r.ticks.showLabelBackdrop = false;
    // options.options.scales.r.title = title;
    //  options.data.ticks.display = false;
    // options.data.labels.boxSize=0;
    console.log(options);

    //options.options.scales.display = false;
    const chart = new Chart(ctx, radarDefaultConfig);
    chart.options.plugins.title.text = title;
    chart.options.plugins.title.color = "#ccc";
    chart.options.plugins.title.display = true;
    chart.options.plugins.legend.display = false;
    chart.options.plugins.legend.labels.color="red";
    //====
   
    //====
    // Function to update the chart with new data for each trace
    chart.updateChart = function (values, render = true) {
        let i;
        if (values) {
            for (i = 0; i < values.length; i++) {
                chart.data.datasets[0].data[i] = rangeMapper(values[i], -10, 10, 0, 100, 3);
            };
        }
        if (render)
            chart.update();
    }
    return chart;
}
