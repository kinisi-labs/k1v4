/*********************************************************************
 This is an example for our nRF52 based Bluefruit LE modules

 Pick one up today in the adafruit shop!

 Adafruit invests time and resources providing this open source code,
 please support Adafruit and open-source hardware by purchasing
 products from Adafruit!

 MIT license, check LICENSE for more information
 All text above, and the splash screen below must be included in
 any redistribution
*********************************************************************/
#include <bluefruit.h>
#include <Adafruit_LittleFS.h>
#include <InternalFileSystem.h>
#include <cstring>
#include <cstdlib>
#include "md5.h"
#include "nrf51_to_nrf52840.h"

// callback invoked when central connects
static void connect_callback(uint16_t conn_handle)
{
  // Get the reference to current connection
  BLEConnection* connection = Bluefruit.Connection(conn_handle);

  char central_name[32] = { 0 };
  connection->getPeerName(central_name, sizeof(central_name));

  Serial.print("Connected to ");
  Serial.println(central_name);
}

/**
 * Callback invoked when a connection is dropped
 * @param conn_handle connection where this event happens
 * @param reason is a BLE_HCI_STATUS_CODE which can be found in ble_hci.h
 */
static void disconnect_callback(uint16_t conn_handle, uint8_t reason)
{
  (void) conn_handle;
  (void) reason;

  Serial.println();
  Serial.print("Disconnected, reason = 0x"); Serial.println(reason, HEX);
}

class BleUart {
 private:
    // BLE Service
    BLEDfu  bledfu;  // OTA DFU service
    BLEDis  bledis;  // device information
    BLEUart bleuart; // uart over ble
    BLEBas  blebas;  // battery

    char name_buf[32] = "kinisi-labs-k1x-";
    char full_id[33];

    void getMacAddress(uint8_t * mac_address) {
        uint32_t upper_mac = NRF_FICR->DEVICEADDR[1];
        uint32_t lower_mac = NRF_FICR->DEVICEADDR[0];
        mac_address[0] = (upper_mac >> 8) & 0xFF;
        mac_address[1] = upper_mac & 0xFF;
        mac_address[2] = (lower_mac >> 24) & 0xFF;
        mac_address[3] = (lower_mac > 16) & 0xFF;
        mac_address[4] = (lower_mac >> 8) & 0xFF;
        mac_address[5] = lower_mac & 0xFF;
    }

    void initializeFullId() {
        uint8_t mac_address[6];
        uint8_t md5_hash[16];
        getMacAddress(mac_address);
        md5Buffer(mac_address, 6, md5_hash);
        md5StringDigest(md5_hash, full_id);
    }

    void getShortId(char * buf) {
        strncpy(buf, full_id + 26, 7);
        buf[6] = '\0';
    }

    void startAdv(void)
    {
        // Advertising packet
        Bluefruit.Advertising.addFlags(BLE_GAP_ADV_FLAGS_LE_ONLY_GENERAL_DISC_MODE);
        Bluefruit.Advertising.addTxPower();

        // Include bleuart 128-bit uuid
        Bluefruit.Advertising.addService(bleuart);

        // Secondary Scan Response packet (optional)
        // Since there is no room for 'Name' in Advertising packet
        Bluefruit.ScanResponse.addName();
  
        /* Start Advertising
         * - Enable auto advertising if disconnected
         * - Interval:  fast mode = 20 ms, slow mode = 152.5 ms
         * - Timeout for fast mode is 30 seconds
         * - Start(timeout) with timeout = 0 will advertise forever (until connected)
         * 
         * For recommended advertising interval
         * https://developer.apple.com/library/content/qa/qa1931/_index.html   
         */
        Bluefruit.Advertising.restartOnDisconnect(true);
        Bluefruit.Advertising.setInterval(32, 244);    // in unit of 0.625 ms
        Bluefruit.Advertising.setFastTimeout(30);      // number of seconds in fast mode
        Bluefruit.Advertising.start(0);                // 0 = Don't stop advertising after n seconds  
    }


 public:

    void setup()
    {
        // Setup the BLE LED to be enabled on CONNECT
        // Note: This is actually the default behavior, but provided
        // here in case you want to control this LED manually via PIN 19
        Bluefruit.autoConnLed(true);

        // Config the peripheral connection with maximum bandwidth 
        // more SRAM required by SoftDevice
        // Note: All config***() function must be called before begin()
        Bluefruit.configPrphBandwidth(BANDWIDTH_MAX);

        Bluefruit.begin();
        Bluefruit.setTxPower(4);    // Check bluefruit.h for supported values

        initializeFullId();
        int len = strnlen(name_buf, 32);
        getShortId(name_buf + len);

        Bluefruit.setName(name_buf);
        //Bluefruit.setName(getMcuUniqueID()); // useful testing with multiple central connections
        Bluefruit.Periph.setConnectCallback(connect_callback);
        Bluefruit.Periph.setDisconnectCallback(disconnect_callback);

        // To be consistent OTA DFU should be added first if it exists
        bledfu.begin();

        // Configure and Start Device Information Service
        bledis.setManufacturer("Adafruit Industries");
        bledis.setModel("Bluefruit Feather52");
        bledis.begin();

        // Configure and Start BLE Uart Service
        bleuart.begin();

        // Start BLE Battery Service
        blebas.begin();
        blebas.write(100);

        // Set up and start advertising
        startAdv();

        Serial.println("Please use Adafruit's Bluefruit LE app to connect in UART mode");
        Serial.println("Once connected, enter character(s) that you wish to send");
    }


    void write(uint8_t * buf, size_t len)
    {
        // TODO: remove this hacky stuff by changing frontend
        char temp[256];
        int max_len = 224;
        for (int i = 0, cnt = 0; i < len; i += cnt) {
            cnt = len - i < max_len ? len - i : max_len;
            memcpy(temp, buf + i, cnt);
            bleuart.write( temp, cnt);
        }

    }

    void read(uint8_t * buf, size_t len) {
        bleuart.read(buf, len);
    }

};
