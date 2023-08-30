
// primitive bluetooth uart based connection.
// data is in gDataStable;
// raw data in gBLE.jsonRec;

//BLE data fetch for k1 
var gDataStable = {}; // last full json record 
var gDataStorage = { max: 22 * 60 * 60, data: [], packetInfo: {}, pageStartTime: (new Date()).getTime() };

UART.debug = 1;

// load sim data from file
var simDataContainer = {
    loadSim: bw.getURLParam("sim", "false"),
    simData: null,
    simDataTick: 0
}
var sim = bw.getURLParam("sim", "false")


var doBLEConnect = function () {
    let handleBLE = { connected: false };
    console.log("attempting to connect...");

    // main connect code
    UART.connect(function (d) {
        handleBLE = d;
        handleBLE.connected = true;
        handleBLE.on("data", gBLEcallback);
        handleBLE.buf = "";
        handleBLE.jsonRec = { "recTime": (new Date()).getTime() };
        handleBLE.disConnect = function () {
            if (this.connected == true) {
                try {
                    this.close();
                }
                catch (e) {
                    console.log("error closing BLE connection");
                }
                this.connected = false;
            }
        }

    });
    return handleBLE;
};

if (sim != "false") {
    sim = ["load", "true"].indexOf(sim) >= 0 ? "k1x-sensor-data.json" : sim;
    bw.getJSONFile(sim, function (d) {
        simData = JSON.parse(d);
        gDataStorage.sessionHeight = simData.sessionHeight;
        gDataStorage.sessionWeight = simData.sessionWeight;
        gDataStorage.sessionName = simData.sessionName;
        bw.DOM("#sessionName")[0].value = simData.sessionName;
        bw.DOM("#sessionHeight")[0].value = simData.sessionHeight;
        bw.DOM("#sessionWeight")[0].value = simData.sessionWeight;
        gBLE.connected = true;
        gBLE.buf = "";
        gBLE.jsonRec = { "recTime": (new Date()).getTime() };
        setInterval(function () {
            gBLE.jsonRec.data = simData.data[simDataTick];
            gDataStorage.packetInfo.numPackets = (gDataStorage.packetInfo.numPackets || 0) + 1;
            gDataStorage.packetInfo.numBytes = (gDataStorage.packetInfo.numBytes || 0) + JSON.stringify(gBLE.jsonRec.data).length;
            gDataStorage.startTime = (gDataStorage.startTime || (new Date()).getTime());
            gDataStorage.curTime = (new Date()).getTime();
            gDataStorage.packetInfo.elapsedTime = (gDataStorage.curTime - gDataStorage.startTime) / 1000;
            gDataStorage.packetInfo.avgPacketSize = gDataStorage.packetInfo.numBytes / gDataStorage.packetInfo.numPackets;
            gDataStorage.packetInfo.avgPacketsPerSec = gDataStorage.packetInfo.numPackets / (gDataStorage.packetInfo.elapsedTime);
            gDataStorage.packetInfo.avgBytesPerSec = gDataStorage.packetInfo.numBytes / (gDataStorage.packetInfo.elapsedTime);

            updateData(simData.data[simDataTick]);
            simDataTick = (simDataTick + 1) % simData.data.length;
        }, 50);

    });
}
else {
    doBLEConnect();
}

var updateData = function (data) {

    if (gBLE.connected != false)
        if ("data" in gBLE.jsonRec) {
            if (Object.keys(gBLE.jsonRec).length > 0)
                var x;
            for (x in gBLE.jsonRec.data)
                gDataStable[x] = bw.jsonClone(gBLE.jsonRec.data[x]);

            var decData = bw.jsonClone(gDataStable);

            decData["recTime"] = (new Date()).getTime(); // ms received timestamp
            gDataStorage.data.push(decData);
            if (gDataStorage.data.length > gDataStorage.max)
                gDataStorage.data.shift(); //drop first
        }

}
/*
var timingDiffs = function () {
    var x = gDataStorage.data.map(x => x.recTime);
    var y = bw.jsonClone(x);
    y.unshift(0);
    var z = x.map((a, i) => a - y[i]);
    z.shift();
    return z;
}*/

var gBLEcallback = function (d) {
    gBLE.buf = asmPacket(d, gBLE.buf); // this contains the accumulated buffer
    gBLE.raw = d; // this is the current packet
    try { // try JSON decode ...
        if (gBLE.buf[0] == "{" && gBLE.buf[gBLE.buf.length - 1] == "}") {
            gBLE.jsonRec["data"] = JSON.parse(gBLE.buf);
            var t = (new Date()).getTime();
            gBLE.jsonRec["delTime"] = t - gBLE.jsonRec["recTime"];
            gBLE.jsonRec["recTime"] = t;

            // update packet info
            gDataStorage.packetInfo.numPackets = (gDataStorage.packetInfo.numPackets || 0) + 1;
            gDataStorage.packetInfo.numBytes = (gDataStorage.packetInfo.numBytes || 0) + gBLE.buf.length;
            gDataStorage.startTime = (gDataStorage.startTime || (new Date()).getTime());
            gDataStorage.curTime = (new Date()).getTime();
            gDataStorage.packetInfo.elapsedTime = (gDataStorage.curTime - gDataStorage.startTime) / 1000;
            gDataStorage.packetInfo.avgPacketSize = gDataStorage.packetInfo.numBytes / gDataStorage.packetInfo.numPackets;
            gDataStorage.packetInfo.avgPacketsPerSec = gDataStorage.packetInfo.numPackets / (gDataStorage.packetInfo.elapsedTime);
            gDataStorage.packetInfo.avgBytesPerSec = gDataStorage.packetInfo.numBytes / (gDataStorage.packetInfo.elapsedTime);

        }
        else
            gBLE.jsonRec = {}
    }
    catch (e) { gBLE.jsonRec = {} }
    //bw.DOM("#raw",gBLE.buf);
    updateData(gBLE.jsonRec); // callback with fully assembled json data available now.

}

// ========= packet assembly =========
var asmPacket = function (s, accum) {
    s = bw.toa(s, "string", s, "");
    accum = bw.toa(accum, "string", accum, "");
    var i = s.indexOf("?>"); //start prefix found
    if (i >= 0)
        accum = s.substr(i + 2); // trim off start prefix, begin accumulating
    else {// not begin
        i = s.indexOf("<?"); //end suffix found
        if (i >= 0) // end found
            accum += s.substr(0, i); // trim off end suffix, return accumulated
        else // middle...
            accum += s;
    }
    return accum; //raw packet decode
}

// ========= button functions =========
function btnGetInfo() {

}
function btnResetDataStorage() {
    console.log("resetting data storage")
    gDataStorage.pageStartTime = (new Date()).getTime()
    gDataStorage.data = [];

    gDataStorage.sessionName = bw.DOM("#sessionName")[0].value = "";
    gDataStorage.sessionHeight = bw.DOM("#sessionHeight")[0].value = "";
    gDataStorage.sessionWeight = bw.DOM("#sessionWeight")[0].value = "";
}
function btnSaveData() {
    // creates a time-stamped file to store on client computer
    gDataStorage.sessionName   = bw.DOM("#sessionName")[0].value;
    gDataStorage.sessionHeight = bw.DOM("#sessionHeight")[0].value;
    gDataStorage.sessionWeight = bw.DOM("#sessionWeight")[0].value;
    let exportData = JSON.stringify(gDataStorage, function (key, value) {
        // limit precision of floats
        if (typeof value === 'number') {
            return parseFloat(value.toFixed(4));
        }
        return value;
    });
    bw.saveClientFile("Kinisi-K1X-" + (new Date()).toISOString() + ".json", exportData);
}

function btnLoadData() {
    // loads a file from client computer
    var input = document.createElement('input');
    input.type = 'file';

    input.onchange = e => {
        // getting a hold of the file reference
        var file = e.target.files[0];

        // setting up the reader
        var reader = new FileReader();
        reader.readAsText(file, 'UTF-8');

        // here we tell the reader what to do when it's done reading...
        reader.onload = readerEvent => {
            var content = readerEvent.target.result;
            //console.log(content);
            // do the stuff in simData load section
            gDataStorage = JSON.parse(content);
            console.log(gDataStorage);
            console.log("... HERE ...")
            gDataStorage.packetInfo = { numBytes: 0, numPackets: 0 };
            gDataStorage.pageStartTime = (new Date()).getTime();

        }

    }

    input.click();

};

function btnConnect() {
    doBLEConnect();
}