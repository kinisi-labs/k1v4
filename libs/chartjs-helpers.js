// chart-js wrapper / helper for real-time charts
// m a chatterjee defio@deftio.com
// may depend on bitwrench.js for some DOM functions 


// ===================================
// make a new chart

const  gchartJSDefaultOptions = {
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

// radar chart defaults
const radarConfigDefault = {
    type: 'radar',
    data: data,
    options: {
      elements: {
        line: {
          borderWidth: 3
        }
      }
    },
  };


// chart == chart object / DOM element can be div or canvas (native is canvas, supports)
// dims  == number of traes to support
// maxXLen == max number of data points to store in the chart object
// yrange == [min, max]  min/max of y axes (optional, example [-10, 10]
// options == full chartjs supported options


let newChartJSLineChart = function (domEl, dims, title, maxXLen, yrange = null, options = gchartJSDefaultOptions ) {

    let el = bw.DOM(domEl)
    if (el.length <1) {
        console.log ("bad DOM element selector");
        return;
    }
    el = el[0];
    if (bw.typeOf(el) != "htmlcanvaselement") {
        if (bw.typeOf(el) == "htmldivelement") {
            el.innerHTML  =bw.html({t:"canvas",a:{style:"height: 100%; width: 100%"}})
            el = el.firstChild;
        }
        else {
            console.log ("bad DOM element");
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
    chart.updateChart = function( values, render = true) {
        let i;
        if (values) {
            for (i = 0; i < this.data.datasets.length; i++) { // each trace
                let y=0;
                if (values[i].length > 1) {
                    if (i==0) {
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

let newChartJSRadarChart = function (domEl, dims, title, maxXLen, yrange = null, options = radarConfigDefault ) {

    let el = bw.DOM(domEl)
    if (el.length <1) {
        console.log ("bad DOM element selector");
        return;
    }
    el = el[0];
    if (bw.typeOf(el) != "htmlcanvaselement") {
        if (bw.typeOf(el) == "htmldivelement") {
            el.innerHTML  =bw.html({t:"canvas",a:{style:"height: 100%; width: 100%"}})
            el = el.firstChild;
        }
        else {
            console.log ("bad DOM element");
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
    chart.updateChart = function( values, render = true) {
        let i;
        if (values) {
            for (i = 0; i < this.data.datasets.length; i++) { // each trace
                let y=0;
                if (values[i].length > 1) {
                    if (i==0) {
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
