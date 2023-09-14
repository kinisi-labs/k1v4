#include <Arduino.h>
#include <Adafruit_APDS9960.h>
#include <Adafruit_BMP280.h>
#include <Adafruit_SHT31.h>
#include <Adafruit_GPS.h>
#include <Adafruit_TinyUSB.h>
#include <ArduinoJson.h>
#include <cstring>


#include "src/bleuart.h"
#include "src/gps.h"
#include "src/imu.h"
#include "src/arduino-timer/src/arduino-timer.h"
#include "src/sound.h"


Timer<4, millis> timer;

KinisiImu kinisi_imu;
KinisiSound kinisi_sound;

//Adafruit_APDS9960 apds9960;

//Adafruit_BMP280 bmp280;

//Adafruit_SHT31 sht31d;

// For the PDM microphone, you might need a specific library or some custom implementation. 
// There isn't a direct equivalent in the typical Arduino environment.

Adafruit_GPS gps(&Serial1);  // assuming you are connecting the gps to the default hardware serial

BleUart ble_uart;
char uart_buf[1024];
GpsData gps_data;
StaticJsonDocument<2048> s;
const int TOUCH_SENSOR_PIN = 13;
const char * version = "1.1.1";
long packetCnt = 0;

bool readImusAndSerializeFunc(void *) {
  s["v"] = version;
  s["i"] = packetCnt;
  packetCnt++;

  s["t_s"] = millis();

  kinisi_imu.loop(s);
  kinisi_sound.loop(s);

  bool touch = digitalRead(TOUCH_SENSOR_PIN);
  s["tch"] = touch;

  if (gps_data.valid || gps_data.fix_valid) {
    addGpsDataToJson(s, gps_data);
    gps_data.valid = false;
    gps_data.fix_valid = false;
  }

  strncpy(uart_buf, "?>", 3);
  serializeJson(s, uart_buf + 2, sizeof(uart_buf) - 6);
  strncat(uart_buf, "<?", 3);
  s.clear();

  ble_uart.write((uint8_t *) uart_buf, strnlen(uart_buf, sizeof(uart_buf)));
  return true;
}

bool readGpsFunc(void *) {
  readGps(gps, gps_data, false);
  return true;
}

void setup() {
  Serial.begin(115200);
  delay(3000);
  Serial.println("Starting Kinisi v1 Sleeve");

  // Initialize devices
  kinisi_imu.setup();

  //apds9960.begin();

  //bmp280.begin();


  //sht31d.begin();

  // For the PDM microphone, initialize it here, if there's a library or method you are using.
  gps.begin(9600);
  // uncomment this line to turn on RMC (recommended minimum) and GGA (fix data) including altitude
  gps.sendCommand(PMTK_SET_NMEA_OUTPUT_RMCGGA);
  // uncomment this line to turn on only the "minimum recommended" data
  //gps.sendCommand(PMTK_SET_NMEA_OUTPUT_RMCONLY);
  // For parsing data, we don't suggest using anything but either RMC only or RMC+GGA since
  // the parser doesn't care about other sentences at this time
  // Set the update rate
  gps.sendCommand(PMTK_SET_NMEA_UPDATE_1HZ); // 1 Hz update rate
  // For the parsing code to work nicely and have time to sort thru the data, and
  // print it out we don't suggest using anything higher than 1 Hz

  // Request updates on antenna status, comment out to keep quiet
  gps.sendCommand(PGCMD_ANTENNA);

  delay(1000);

  // Ask for firmware version
  Serial1.println(PMTK_Q_RELEASE);

  ble_uart.setup();

  timer.every(20, readImusAndSerializeFunc);
  timer.every(1000, readGpsFunc);
  gps_data.valid = false;
  gps_data.fix_valid = false;
  pinMode(TOUCH_SENSOR_PIN, INPUT_PULLUP);

  kinisi_sound.setup();
}

unsigned long delay_ticks = 1;
void loop() {
  gps.read();
  delay_ticks = timer.tick();
}
