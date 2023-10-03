/* Copyright 2020 Gordon Williams, gw@pur3.co.uk
   https://github.com/espruino/EspruinoWebTools


   2023: Max Morehead - Kinisi
*/

export default function createUartConnector(userBleCallback) {
  let bluetoothDevice;
  console.log("Fble", userBleCallback);
  let bleCallback = userBleCallback;
  let logLevel = 1;
  let rxListener;
  let rxCharacteristic;

  let flowControl = true;
  let flowControlXOFF = false;

  let NORDIC_SERVICE = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
  let NORDIC_TX = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
  let NORDIC_RX = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";
  let CHUNKSIZE = 20;

  function log(level, ...args) {
    if (level <= logLevel) {
      console.log(...args);
    }
  }
  function ab2str(buf) {
    return String.fromCharCode.apply(null, new Uint8Array(buf));
  }

  async function onScanButtonClick() {
    let options = { filters: [
      { namePrefix: "kinisi" },
      { services: [NORDIC_SERVICE] },
    ] };

    bluetoothDevice = null;
    try {
      log(1, 'Requesting Bluetooth Device...');
      bluetoothDevice = await navigator.bluetooth.requestDevice(options);
      bluetoothDevice.addEventListener('gattserverdisconnected', onDisconnected);
      log(1, "Device Name:       " + bluetoothDevice.name);
      log(1, "Device ID:         " + bluetoothDevice.id);
      connect();
    } catch (error) {
      log(0, 'Error ' + error);
    }
  }

  async function connect() {

    log(1, 'Connecting to Bluetooth Device...');
    let server = await bluetoothDevice.gatt.connect();
    log(1, '> Bluetooth Device connected');
    let service = await server.getPrimaryService(NORDIC_SERVICE);
    log(1, 'Got service');
    rxCharacteristic = await service.getCharacteristic(NORDIC_RX);
    log(1, 'RX characteristic');

    rxListener = function(event) {
      var dataview = event.target.value;
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

    rxCharacteristic.addEventListener(
      "characteristicvaluechanged",
      rxListener
    );
    await rxCharacteristic.startNotifications();
  }

  function onDisconnectButtonClick() {
    if (rxListener) {
      rxCharacteristic.removeEventListener("characteristicvaluechanged", rxListener);
    }

    if (bluetoothDevice?.gatt.connected) {
      log(1, 'Disconnecting from Bluetooth Device...');
      bluetoothDevice.gatt.disconnect();
    } else {
      log(1, '> Bluetooth Device is already disconnected');
    }
  }

  function onDisconnected(event) {
    // Object event.target is Bluetooth Device getting disconnected.
    log(1, '> Bluetooth Device disconnected');
  }

  return {
    connect: onScanButtonClick,
    disconnect: onDisconnectButtonClick
  };
};
