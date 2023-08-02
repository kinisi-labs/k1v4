
// primitive bluetooth uart based connection.
// data is in gDataStable;
// raw data in gBLE.jsonRec;

//BLE data fetch for k1 
var gBLE = { connected: false };
var gDataStable = {}; // last full json record 
var gDataStorage = { max: 22 * 60 * 60, data: [], packetInfo: {}, pageStartTime: (new Date()).getTime() };

UART.debug = 1;

var sim = bw.getURLParam("sim", "false");
var simData;
var simDataTick = 0;

var doBLEConnect = function () {

    console.log("attempting to connect...");
    UART.connect(function (d) {
        gBLE = d;
        gBLE.connected = true;
        gBLE.on("data", gBLEcallback);
        gBLE.buf = "";
        gBLE.jsonRec = { "recTime": (new Date()).getTime() };
    });
};

if (sim != "false") {
    if (sim == "load") {
        bw.getJSONFile("sensor-data.json", function (d) {
            simData = d;

            gBLE.connected = true;
            gBLE.buf = "";
            gBLE.jsonRec = { "recTime": (new Date()).getTime() };
            setInterval(function () {
                gBLE.jsonRec.data =simData.data[simDataTick] ;
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
            }, 25);

        });
    }
    else {
        doBLEConnect();
    }
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

    var timingDiffs = function () {
        var x = gDataStorage.data.map(x => x.recTime);
        var y = bw.jsonClone(x);
        y.unshift(0);
        var z = x.map((a, i) => a - y[i]);
        z.shift();
        return z;
    }

    var gBLEcallback = function (d) {
        gBLE.buf = asmPacket(d, gBLE.buf);
        gBLE.raw = d;
        try { // try JSON decode ...
            if (gBLE.buf[0] == "{" && gBLE.buf[gBLE.buf.length - 1] == "}") {
                gBLE.jsonRec["data"] = JSON.parse(gBLE.buf);
                var t = (new Date()).getTime();
                gBLE.jsonRec["delTime"] = t - gBLE.jsonRec["recTime"];
                gBLE.jsonRec["recTime"] = t;

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
    var asmPacket = function (s, accum) {
        s = bw.toa(s, "string", s, "");
        accum = bw.toa(accum, "string", accum, "");
        var i = s.indexOf("?>"); //start prefix found
        if (i >= 0)
            accum = s.substr(i + 2);
        else {// not begin
            i = s.indexOf("<?"); //end suffix found
            if (i >= 0) // end found
                accum += s.substr(0, i);
            else // middle...
                accum += s;
        }
        return accum; //raw packet decode
    }

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
        gDataStorage.sessionName = bw.DOM("#sessionName")[0].value;
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


    function btnConnect() {
        doBLEConnect();
    }