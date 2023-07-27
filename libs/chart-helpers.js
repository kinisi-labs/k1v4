/*
 chart-helpers.js
 m a chatterjee revised 2022
 simple hack to wrap plotlyjs charts for streaming
 */


// global var for plotly management...
var gPlotlyItems = {maxXlen : 100}; // maxXLen is when it starts scrolling


function newPlotlyLineChart (domID,dims, layout) {
    let i,b = Array(dims).fill(0);
    for (i=0;i<b.length;i++)
        b[i] = {y:[],type:'line'};
    i = 20;
    gPlotlyItems[domID]={
        cnt:0,
        layout:{
            "displaylogo": false,
            "modeBarButtonsToRemove": ['pan2d','lasso2d'],
            "margin" : {t:i,b:i,r:i,l:i}, 
            "showlegend":false,
            "xaxis" : {
                range:[0,gPlotlyItems.maxXlen],
                showTickLabels: false
            },
            "yaxis" : {
                automargin: true
            }
        }
    }; 
    layout = bw.toa(layout,"object",layout,{});
    
    for (i in layout) { // over ride the defaults 
        gPlotlyItems[domID].layout[i] = layout[i];
    }
    return  Plotly.newPlot(domID,b,gPlotlyItems[domID].layout );
}

function updatePlotlyLineChart(domID,data) {
    data = bw.toa(data,"array",data,[data]);
    let gpi = gPlotlyItems[domID];
    
    Plotly.extendTraces(
        domID,
        { y: data.map(x=>[x])}, 
        Array.from(Array(data.length).keys())
        );

    // Plotly.relayout is what enables scrolling 
    gpi.cnt ++;
    if(gpi.cnt > gPlotlyItems.maxXlen) {
        gpi.layout.xaxis.range= [gpi.cnt-gPlotlyItems.maxXlen,gpi.cnt];
        Plotly.relayout(domID,gpi.layout);
    }
}