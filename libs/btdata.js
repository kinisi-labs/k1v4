
// primitive bluetooth uart based connection.
// data is in gDataStable;
// raw data in gBLE.jsonRec;

// global callback structure for uart / ble

var gUART= {
    connected:false, 
    uart:null, 
    callback:function(){}  // set this to desired jsondata callback

    this.start = function(cb) {
        
    }
};
var gDataStable = {}; // last full json record 
var gDataStorage = {max:100*40, data:[]}

UART.debug =1

var sim = bw.getURLParam("sim","false"); // sim=true or sim=true&simDataFile=filename
var simData=[]; // simulated data if loaded..

bw.getJSONFile("sensor-data.json",function(d){simData=d;})

// this is the raw callback from the UART 
var packetCallback = function(rawUartData) {
    gUART.raw = rawUartData;  // this is the current packet
    var decodedData = decodeJSONPacket(rawUartData,gBLE.buf);
    gUART.buf = decodeData.raw; // this is the current raw "assembled"  packet (over several callbacks)
    if (decodedData.ready = true) { // we have valid data
        gUART.callback({recdTimeStamp: (new Date()).getTime(), data: decodedData.jsonData});
    }
    else {
        if (UART.debug > 1)
            console.log (decodedData.ready) // spit out whatever the problem was if debug mode
    }

    //bw.DOM("#raw",gBLE.buf);
    updateData(gBLE.jsonRec); // callback with fully assembled json data available now.
    
}
if (sim != "false") {
    console.log("here")
    if (sim == "load") {
        bw.getJSONFile(bw.getURLParam("simData","sensor-data.json"),function(d){simData=d});
    }
    else {
        setInterval(function(){ // live random sim data
            var simData = {};
            updateData({});
        },40)
        gUART.connected = true;
        gUART.buf = "";
        gUART.jsonRec = {"recTime":(new Date()).getTime()};
    }
}
else
{
    console.log("connection ble");
    UART.connect(function(uartInstance){
        gUART.uart = uartInstance;
        gUART.uart.on("data",packetCallback); // 
        gUART.connected = true;     
        gUART.raw = "";
        gUART.jsonRec = {"recTime":(new Date()).getTime()};
    });
}
//


/***
 * primitive decode for assembly packets
 * 
 * @s (string)      : new string data from uart
 * @accum (string)  : assmebled string across packets
 * 
 * returns
 * {raw: <string>, jsonData{d:data, ready: true | false | error }}
 */
var decodeJSONPacket = function(s,accum)  {  // st, accumulated string...
    var i,delims = ["?>","<?"],jd={d:{},ready:false};  // delimiters for start and stop of JSON encoded string
    s = bw.toa(s,"string",s,""); // fix type assign if number or other item passed

    if (accum.indexof(delims[0]) <0) { // still looking for start..
        accum = s; 
        i = accum.indexOf(delims[0]); //start prefix found
        if (i>=0)
            accum = s.substr(i+2); // found start in new string
    } // we already have the beginning started
    else {
        i = s.indexOf(delims[1]); //end suffix found
        accum += (i<0) ? s : s.substr(0,i);
        if (i >= 0) {
            try {
                jd.d = JSON.parse(accum);
                js.ready= true;
            }
            catch (e) {jd.ready="error";}
        }
    }    
    return {raw: accum, jsonData : jd} ; //raw packet decode
}
