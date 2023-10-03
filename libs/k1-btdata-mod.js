import createUartConnector from "/libs/uart-mod.js";
import { bw } from "/libs/bitwrench-mod.js";
// primitive bluetooth uart based connection.
// data is in gDataStable;
// raw data in gBLE.jsonRec;

let gDataStorageCount = 0;

const createSleeveBluetoothConnector = function () {
  const gBLEcallback = function (d) {
    console.log("k1datastorage", gDataStorage);
    console.log("BLE Callback", d, gBLE.buf);
    gBLE.buf = asmPacket(d, gBLE.buf);
    gBLE.raw = d;
    try {
      // try JSON decode ...
      if (gBLE.buf[0] == "{" && gBLE.buf[gBLE.buf.length - 1] == "}") {
        gBLE.jsonRec["data"] = JSON.parse(gBLE.buf);
        var t = new Date().getTime();
        gBLE.jsonRec["delTime"] = t - gBLE.jsonRec["recTime"];
        gBLE.jsonRec["recTime"] = t;

        gDataStorage.packetInfo.numPackets =
          (gDataStorage.packetInfo.numPackets || 0) + 1;
        gDataStorage.packetInfo.numBytes =
          (gDataStorage.packetInfo.numBytes || 0) + gBLE.buf.length;
        gDataStorage.startTime = gDataStorage.startTime || new Date().getTime();
        gDataStorage.curTime = new Date().getTime();
        gDataStorage.packetInfo.elapsedTime =
          (gDataStorage.curTime - gDataStorage.startTime) / 1000;
        gDataStorage.packetInfo.avgPacketSize =
          gDataStorage.packetInfo.numBytes / gDataStorage.packetInfo.numPackets;
        gDataStorage.packetInfo.avgPacketsPerSec =
          gDataStorage.packetInfo.numPackets /
          gDataStorage.packetInfo.elapsedTime;
        gDataStorage.packetInfo.avgBytesPerSec =
          gDataStorage.packetInfo.numBytes /
          gDataStorage.packetInfo.elapsedTime;
        gDataStorage.deviceName = gDataStorage.deviceName || gBLE.deviceName;
      } else gBLE.jsonRec = {};
    } catch (e) {
      gBLE.jsonRec = {};
    }
    //bw.DOM("#raw",gBLE.buf);
    updateData(gBLE.jsonRec); // callback with fully assembled json data available now.
  };
  const UART = createUartConnector(gDataStorageCount > 0 ? (x) => console.log("TEST", x) : gBLEcallback);

  //BLE data fetch for k1
  let gBLE = { connected: false, buf: "" };
  let gDataStable = {}; // last full json record
  let gDataStorage = {
    max: 22 * 60 * 60,
    data: [],
    packetInfo: {},
    pageStartTime: new Date().getTime(),
    _count: gDataStorageCount
  };

  gDataStorageCount += 1;

  const doBLEPair = async function () {
    UART.debug = 2;
    console.log("attempting to connect...");
    await UART.connect();
    gBLE.connected = true;
  };

  const doBLEUnpair = async function (callback) {
    if (gBLE?.connected) {
      await UART.disconnect();
      gBLE = { connected: false };
      if (callback) {
        callback(gBLE);
      }
    }
  };

  const updateData = function (data) {
    if (gBLE.connected != false)
      if ("data" in gBLE.jsonRec) {
        if (Object.keys(gBLE.jsonRec).length > 0) var x;
        for (x in gBLE.jsonRec.data)
          gDataStable[x] = bw.jsonClone(gBLE.jsonRec.data[x]);

        var decData = bw.jsonClone(gDataStable);

        decData["recTime"] = new Date().getTime(); // ms received timestamp
        gDataStorage.data.push(decData);
        if (gDataStorage.data.length > gDataStorage.max)
          gDataStorage.data.shift(); //drop first
      }
  };


  const asmPacket = function (s, accum) {
    s = bw.toa(s, "string", s, "");
    accum = bw.toa(accum, "string", accum, "");

    accum += s;

    let i = accum.indexOf("?>");
    if (i >= 0) {
      accum = accum.substr(i);
      i = accum.indexOf("<?");

      if (i >= 0) {
        accum = accum.substr(2, i - 2);
      }
    }

    return accum;
  };

  function resetDataStorage() {
    console.log("resetting data storage");
    gDataStorage.pageStartTime = new Date().getTime();
    gDataStorage.data = [];
  }

  return {
    doBLEPair,
    doBLEUnpair,
    resetDataStorage,
    dataStorage: gDataStorage,
    dataStable: gDataStable,
  };
}

window.createSleeveBluetoothConnector = createSleeveBluetoothConnector;
console.log("Loaded sleeve connector");
export default createSleeveBluetoothConnector;
