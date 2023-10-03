/* Copyright 2020 Gordon Williams, gw@pur3.co.uk
   https://github.com/espruino/EspruinoWebTools
*/
export default function createUartConnector() {
  if (typeof navigator == "undefined") return;
  var isBusy;
  var queue = [];

  function ab2str(buf) {
    return String.fromCharCode.apply(null, new Uint8Array(buf));
  }
  function str2ab(str) {
    var buf = new ArrayBuffer(str.length);
    var bufView = new Uint8Array(buf);
    for (var i = 0, strLen = str.length; i < strLen; i++)
      bufView[i] = str.charCodeAt(i);
    return buf;
  }

  function handleQueue() {
    if (!queue.length) return;
    var q = queue.shift();
    log(3, "Executing " + JSON.stringify(q) + " from queue");
    if (q.type == "eval") uart.eval(q.expr, q.cb);
    else if (q.type == "write")
      uart.write(q.data, q.callback, q.callbackNewline);
    else log(1, "Unknown queue item " + JSON.stringify(q));
  }

  function log(level, s) {
    if (uart.log) uart.log(level, s);
  }

  var endpoints = [];
  var WebBluetooth = {
    name: "Kinisi Connect",
    description: "k1 / k1x series", //"Bluetooth LE devices",
    svg: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24"><path d="M0 0h24v24H0z" fill="none"/><path d="M17.71 7.71L12 2h-1v7.59L6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 11 14.41V22h1l5.71-5.71-4.3-4.29 4.3-4.29zM13 5.83l1.88 1.88L13 9.59V5.83zm1.88 10.46L13 18.17v-3.76l1.88 1.88z" fill="#ffffff"/></svg>',
    isSupported: function () {
      if (
        navigator.platform.indexOf("Win") >= 0 &&
        (navigator.userAgent.indexOf("Chrome/54") >= 0 ||
          navigator.userAgent.indexOf("Chrome/55") >= 0 ||
          navigator.userAgent.indexOf("Chrome/56") >= 0)
      )
        return "Chrome <56 in Windows has navigator.bluetooth but it's not implemented properly";
      if (
        window &&
        window.location &&
        window.location.protocol == "http:" &&
        window.location.hostname != "localhost"
      )
        return "Serving off HTTP (not HTTPS) - Web Bluetooth not enabled";
      if (navigator.bluetooth) return true;
      var iOS =
        /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      if (iOS) {
        return "To use Web Bluetooth on iOS you'll need the WebBLE App.\nPlease go to https://itunes.apple.com/us/app/webble/id1193531073 to download it.";
      } else {
        return "This Web Browser doesn't support Web Bluetooth.\nPlease see https://www.espruino.com/Puck.js+Quick+Start";
      }
    },
    connect: function (connection, callback, disconnectCallback) {
      var NORDIC_SERVICE = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
      var NORDIC_TX = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
      var NORDIC_RX = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";
      var CHUNKSIZE = 20;

      var btServer = undefined;
      var btService;
      var txCharacteristic;
      var rxCharacteristic;
      var txDataQueue = [];
      var flowControlXOFF = false;
      let gattDevice = null;
      let rxListener = undefined;

      let gattConnect = function (device, callback) {
        gattDevice = device;
        return new Promise((resolve) => {
          log(1, "Trying connect");
          resolve(device.gatt.connect());
        })
          .then(function (server) {
            log(1, "Connected");
            btServer = server;
            return server.getPrimaryService(NORDIC_SERVICE);
          })
          .then(function (service) {
            log(2, "Got service");
            btService = service;
            return btService.getCharacteristic(NORDIC_RX);
          })
          .then(function (characteristic) {
            rxCharacteristic = characteristic;
            log(2, "RX characteristic:" + JSON.stringify(rxCharacteristic));
            rxListener =
              function (event) {
                var dataview = event.target.value;
                if (uart.flowControl) {
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
                connection.emit("data", str);
              };
            rxCharacteristic.addEventListener(
              "characteristicvaluechanged",
              rxListener
            );
            window.rxCharacteristic = rxCharacteristic;
            return rxCharacteristic.startNotifications();
          })
          .then(function () {
            return btService.getCharacteristic(NORDIC_TX);
          })
          .then(function (characteristic) {
            txCharacteristic = characteristic;
            log(2, "TX characteristic:" + JSON.stringify(txCharacteristic));
          })
          .then(function () {
            connection.txInProgress = false;
            connection.isOpen = true;
            connection.isOpening = false;
            isBusy = false;
            queue = [];
            log(1, "callback");
            log(1, connection);
            callback(connection);
            connection.emit("open");
            // if we had any writes queued, do them now
            connection.write();
          });
      };

      connection.close = function (callback) {
        log(1, "Closing BT UART connection");
        connection.isOpening = false;
        if (connection.isOpen) {
          connection.isOpen = false;
          connection.emit("close");
        } else {
          if (callback) callback(null);
        }

        if (rxListener) {
          rxCharacteristic.removeEventListener("characteristicvaluechanged", rxListener);
        }

        if (gattDevice?.gatt.connected) {
          gattDevice.gatt.disconnect();
        }

        if (btServer) {
          btServer.disconnect();
          btServer = undefined;
          txCharacteristic = undefined;
          rxCharacteristic = undefined;
        }
      };

      connection.write = function (data, callback) {
        if (data)
          txDataQueue.push({
            data: data,
            callback: callback,
            maxLength: data.length,
          });
        if (connection.isOpen && !connection.txInProgress) writeChunk();

        function writeChunk() {
          if (flowControlXOFF) {
            // flow control - try again later
            setTimeout(writeChunk, 20);
            return;
          }
          var chunk;
          if (!txDataQueue.length) {
            uart.writeProgress();
            return;
          }
          var txItem = txDataQueue[0];
          uart.writeProgress(
            txItem.maxLength - txItem.data.length,
            txItem.maxLength,
          );
          if (txItem.data.length <= CHUNKSIZE) {
            chunk = txItem.data;
            txItem.data = undefined;
          } else {
            chunk = txItem.data.substr(0, CHUNKSIZE);
            txItem.data = txItem.data.substr(CHUNKSIZE);
          }
          connection.txInProgress = true;
          log(2, "Sending " + JSON.stringify(chunk));
          txCharacteristic
            .writeValue(str2ab(chunk))
            .then(function () {
              log(3, "Sent");
              if (!txItem.data) {
                txDataQueue.shift(); // remove this element
                if (txItem.callback) txItem.callback();
              }
              connection.txInProgress = false;
              writeChunk();
            })
            .catch(function (error) {
              log(1, "SEND ERROR: " + error);
              txDataQueue = [];
              connection.close();
            });
        }
      };

      navigator.bluetooth
        .requestDevice({
          filters: [
            { namePrefix: "Puck.js" },
            { namePrefix: "Pixl.js" },
            { namePrefix: "MDBT42Q" }, { namePrefix: "Bangle" },
            { namePrefix: "RuuviTag" },
            { namePrefix: "iTracker" },
            { namePrefix: "Thingy" },
            { namePrefix: "Espruino" },
            { services: [NORDIC_SERVICE] },
          ],
          optionalServices: [NORDIC_SERVICE],
        })
        .then(function (device) {
          log(1, "Device Name:       " + device.name);
          log(1, "Device ID:         " + device.id);
          connection.deviceName = device.name;
          // Was deprecated: Should use getPrimaryServices for this in future
          //log('BT>  Device UUIDs:      ' + device.uuids.join('\n' + ' '.repeat(21)));
          device.addEventListener("gattserverdisconnected", function () {
            log(1, "Disconnected (gattserverdisconnected)");
            if (connection.isOpen) {
              log(1, "Reconnecting");
              gattConnect(device, (d) => {
                log(2, "Reconnected to");
                log(2, d);
              });
            }
          });
          return gattConnect(device, callback);
        }).catch(function (error) {
          log(1, "ERROR: " + error);
          connection.close();
        });
      return connection;
    },
  };
  // ======================================================================
  endpoints.push(WebBluetooth);
  // ======================================================================
  function setConnectElement(connectElement) {
    endpoints.forEach(function (endpoint) {
      endpoint.connectElement = connectElement;
    });
  }

  var connection;
  function connect(callback, disconnectCallback) {
    var connection = {
      on: function (evt, cb) {
        this["on" + evt] = cb;
      },
      emit: function (evt, data) {
        if (this["on" + evt]) this["on" + evt](data);
      },
      isOpen: false,
      isOpening: true,
      txInProgress: false,
      deviceName: "",
    };

    endpoints.forEach(function (endpoint) {
      var supported = endpoint.isSupported();
      if (supported !== true)
        log(0, endpoint.name + " not supported, " + supported);
      //endpoint.connectElement.onclick = function (evt) {
      connection = endpoint.connect(connection, callback, disconnectCallback);
      //};
    });
    return connection;
  }

  function checkIfSupported() {
    var anySupported = false;
    endpoints.forEach(function (endpoint) {
      var supported = endpoint.isSupported();
      if (supported === true) anySupported = true;
      else log(0, endpoint.name + " not supported, " + supported);
    });
    return anySupported;
  }
  // ======================================================================
  /* convenience function... Write data, call the callback with data:
     callbackNewline = false => if no new data received for ~0.2 sec
     callbackNewline = true => after a newline */
  function write(data, callback, callbackNewline) {
    if (!checkIfSupported()) return;
    if (isBusy) {
      log(3, "Busy - adding write to queue");
      queue.push({
        type: "write",
        data: data,
        callback: callback,
        callbackNewline: callbackNewline,
      });
      return;
    }

    var cbTimeout;
    function onWritten() {
      if (callbackNewline) {
        connection.cb = function (d) {
          var newLineIdx = connection.received.indexOf("\n");
          if (newLineIdx >= 0) {
            var l = connection.received.substr(0, newLineIdx);
            connection.received = connection.received.substr(newLineIdx + 1);
            connection.cb = undefined;
            if (cbTimeout) clearTimeout(cbTimeout);
            cbTimeout = undefined;
            if (callback) callback(l);
            isBusy = false;
            handleQueue();
          }
        };
      }
      // wait for any received data if we have a callback...
      var maxTime = 300; // 30 sec - Max time we wait in total, even if getting data
      var dataWaitTime = callbackNewline
        ? 100 /*10 sec  if waiting for newline*/
        : 3; /*300ms*/
      var maxDataTime = dataWaitTime; // max time we wait after having received data
      cbTimeout = setTimeout(function timeout() {
        cbTimeout = undefined;
        if (maxTime) maxTime--;
        if (maxDataTime) maxDataTime--;
        if (connection.hadData) maxDataTime = dataWaitTime;
        if (maxDataTime && maxTime) {
          cbTimeout = setTimeout(timeout, 100);
        } else {
          connection.cb = undefined;
          if (callbackNewline) log(2, "write waiting for newline timed out");
          if (callback) callback(connection.received);
          isBusy = false;
          handleQueue();
          connection.received = "";
        }
        connection.hadData = false;
      }, 100);
    }

    if (connection && (connection.isOpen || connection.isOpening)) {
      if (!connection.txInProgress) connection.received = "";
      isBusy = true;
      return connection.write(data, onWritten);
    }

    connection = connect(function (uart) {
      if (!uart) {
        connection = undefined;
        if (callback) callback(null);
        return;
      }
      connection.received = "";
      connection.on("data", function (d) {
        connection.received += d;
        connection.hadData = true;
        if (connection.cb) connection.cb(d);
      });
      connection.on("close", function (d) {
        connection = undefined;
      });
      isBusy = true;
      connection.write(data, onWritten);
    });
  };

  function evaluate(expr, cb) {
    if (!checkIfSupported()) return;
    if (isBusy) {
      log(3, "Busy - adding eval to queue");
      queue.push({ type: "eval", expr: expr, cb: cb });
      return;
    }
    write(
      "\x10eval(process.env.CONSOLE).println(JSON.stringify(" + expr + "))\n",
      function (d) {
        try {
          var json = JSON.parse(d.trim());
          cb(json);
        } catch (e) {
          log(
            1,
            "Unable to decode " + JSON.stringify(d) + ", got " + e.toString(),
          );
          cb(
            null,
            "Unable to decode " + JSON.stringify(d) + ", got " + e.toString(),
          );
        }
      },
      true /*callbackNewline*/,
    );
  }

  // ----------------------------------------------------------

  var uart = {
    /// Are we writing debug information? 0 is no, 1 is some, 2 is more, 3 is all.
    debug: 3, //FIXME 1,
    /// Should we use flow control? Default is true
    flowControl: true,
    /// Used internally to write log information - you can replace this with your own function
    log: function (level, s) {
      if (level <= this.debug) console.log("<UART> " + s);
    },
    /// Called with the current send progress or undefined when done - you can replace this with your own function
    writeProgress: function (charsSent, charsTotal) {
      //console.log(charsSent + "/" + charsTotal);
    },
    /** Connect to a new device - this creates a separate
   connection to the one `write` and `eval` use. */
    connect: connect,
    /// Write to a device and call back when the data is written.  Creates a connection if it doesn't exist
    write: write,
    /// Evaluate an expression and call cb with the result. Creates a connection if it doesn't exist
    eval: evaluate,
    /// Write the current time to the device
    setTime: function (cb) {
      var d = new Date();
      var cmd = "setTime(" + d.getTime() / 1000 + ");";
      // in 1v93 we have timezones too
      cmd +=
        "if (E.setTimeZone) E.setTimeZone(" +
        d.getTimezoneOffset() / -60 +
        ");\n";
      write(cmd, cb);
    },
    /// Did `write` and `eval` manage to create a connection?
    isConnected: function () {
      return connection !== undefined;
    },
    /// get the connection used by `write` and `eval`
    getConnection: function () {
      return connection;
    },
    /// Close the connection used by `write` and `eval`
    close: function () {
      if (connection) connection.close();
    },
  };
  return uart;
};
