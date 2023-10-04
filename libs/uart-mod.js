/* Copyright 2020 Gordon Williams, gw@pur3.co.uk
   https://github.com/espruino/EspruinoWebTools


   2023: Max Morehead - Kinisi
*/

export default function createUartConnector(userBleCallback) {
  const bluetoothDevice = new p5ble();
  let bleCallback = userBleCallback;
  let rxCharacteristic;

  let NORDIC_SERVICE = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
  let NORDIC_TX = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
  let NORDIC_RX = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";
  let CHUNKSIZE = 20;

  let flowControl = true;
  let logLevel = 1;


  function log(level, ...args) {
    if (level <= logLevel) {
      console.log(...args);
    }
  }
  function ab2str(buf) {
    return String.fromCharCode.apply(null, new Uint8Array(buf));
  }

  function deviceConnect() {
    return new Promise((resolve, reject) => {
      bluetoothDevice.connect(NORDIC_SERVICE, (error, characteristics) => {
        if (error) {
          reject(error);
        } else {
          resolve(characteristics);
        }
      });
    });
  }

  async function connect() {
    let characteristics = await deviceConnect();
    console.log(characteristics);
    let rxListener = function (dataview) {
      if (flowControl) {
        for (var i = 0; i < dataview.length; i++) {
          var ch = dataview.getUint8(i);
          if (ch == 17) {
            // XON
            log(2, "XON received => resume upload");
            flowControlXOFF = false;
          }
          if (ch == 19) {
            // XOFF
            log(2, "XOFF received => pause upload");
            flowControlXOFF = true;
          }
        }
      }
      var str = ab2str(dataview.buffer);
      log(3, "Received " + JSON.stringify(str));
      if (bleCallback) {
        bleCallback(str);
      }
    };
    for (let characteristic of characteristics) {
      if (NORDIC_RX.localeCompare(characteristic.uuid) === 0) {
        rxCharacteristic = characteristic;
        break;
      }
    }
    if (!rxCharacteristic) {
      log(0, "Recieve characteristic not present");
    }
    bluetoothDevice.startNotifications(rxCharacteristic, rxListener, "custom");
  }


  async function disconnect() {
    bluetoothDevice.stopNotifications();
    rxCharacteristic = null;
    bluetoothDevice.disconnect();
  }

  return {
    connect: connect,
    disconnect: disconnect
  };
};
