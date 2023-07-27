
// primitive bluetooth uart based connection.
// data is in gDataStable;
// raw data in gBLE.jsonRec;

//BLE data fetch for k1 
var gBLE= {connected:false};
var gDataStable = {}; // last full json record 
var gDataStorage = {max:100*40, data:[]}

UART.debug =1

var sim = bw.getURLParam("sim","false");
var simData;
bw.getJSONFile("sensor-data.json",function(d){simData=d;})
if (sim != "false") {
    console.log("here")
    if (sim == "load") {
        //load from file
    }
    else {
        setInterval(function(){
            var simData = {};
            updateData({});
        },40)
        gBLE.connected = true;
        gBLE.buf = "";
        gBLE.jsonRec = {"recTime":(new Date()).getTime()};
    }
}
else
{
    console.log("connection ble");
    UART.connect(function(d){
        gBLE=d;
        gBLE.connected = true;
        gBLE.on("data",gBLEcallback);
        gBLE.buf = "";
        gBLE.jsonRec = {"recTime":(new Date()).getTime()};
    });
}
var updateData = function(data) {
    //bw.DOM("#humidity-value")[0].innerHTML = bw.htmlJSON(data);
    if (gBLE.connected != false)
    if ("data"in gBLE.jsonRec ) {
        if (Object.keys(gBLE.jsonRec).length>0)
        var x;
        for (x in gBLE.jsonRec.data) 
          gDataStable[x]= bw.jsonClone(gBLE.jsonRec.data[x]);
        
        var decData = bw.jsonClone(gDataStable);
        decData["recTime"] = (new Date()).getTime(); // ms received timestamp
        gDataStorage.data.push( decData);
        if (gDataStorage.data.length > gDataStorage.max)
            gDataStorage.data.shift(); //drop first
    }

  }

var timingDiffs = function () {
    var x =gDataStorage.data.map(x=>x.recTime);
    var y = bw.jsonClone(x);
    y.unshift(0);
    var z = x.map((a,i)=>a-y[i]);
    z.shift();
    return z;
}

var gBLEcallback = function(d) {
    gBLE.buf = asmPacket(d,gBLE.buf);
    gBLE.raw = d;
    try { // try JSON decode ...
        if (gBLE.buf[0] == "{" && gBLE.buf[gBLE.buf.length-1]=="}") {
            gBLE.jsonRec["data"] = JSON.parse(gBLE.buf);
            var t = (new Date()).getTime();
            gBLE.jsonRec["delTime"] = t - gBLE.jsonRec["recTime"];
            gBLE.jsonRec["recTime"] = t;
            bw.DOM("#dec",bw.htmlJSON(gBLE.jsonRec));
        }
        else
            gBLE.jsonRec = {}
    }
    catch(e) {gBLE.jsonRec = {}}
    //bw.DOM("#raw",gBLE.buf);
    updateData(gBLE.jsonRec); // callback with fully assembled json data available now.
    
}
var asmPacket= function(s,accum)  {
    s = bw.toa(s,"string",s,"");
    accum = bw.toa(accum ,"string",accum ,"");
    var i = s.indexOf("?>"); //start prefix found
    if (i>=0)
        accum = s.substr(i+2);
    else {// not begin
        i = s.indexOf("<?"); //end suffix found
        if (i>=0) // end found
            accum += s.substr(0,i);
        else // middle...
            accum += s;
    }
    return accum; //raw packet decode
}
