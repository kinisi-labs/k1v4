#include <Adafruit_LSM6DS33.h>
#include <Adafruit_ICM20X.h>
#include <Adafruit_ICM20948.h>
#include <Adafruit_APDS9960.h>
#include <Adafruit_BMP280.h>
#include <Adafruit_LIS3MDL.h>
#include <Adafruit_SHT31.h>
#include <Adafruit_GPS.h>
#include <Adafruit_TinyUSB.h>
#include <ArduinoJson.h>
#include <cstring>

#include "src/bleuart.h"
#include "src/gps.h"
#include "src/imu.h"
#include "src/arduino-timer/src/arduino-timer.h"

Timer<4, millis> timer;

Adafruit_LSM6DS33 lsm6ds33;
Adafruit_LSM6DS33 lsm6ds33p2;
//Adafruit_ICM20948 icm20948;

Adafruit_APDS9960 apds9960;

Adafruit_BMP280 bmp280;

Adafruit_LIS3MDL lis3mdl;
Adafruit_LIS3MDL lis3mdlp2;

Adafruit_SHT31 sht31d;

// For the PDM microphone, you might need a specific library or some custom implementation. 
// There isn't a direct equivalent in the typical Arduino environment.

Adafruit_GPS gps(&Serial1);  // assuming you are connecting the gps to the default hardware serial

BleUart ble_uart;
char uart_buf[1024];
GpsData gps_data;
StaticJsonDocument<2048> s;
const int TOUCH_SENSOR_PIN = 13;
const char * version = "1.1.0";
long packetCnt = 0;

bool readImusAndSerializeFunc(void *) {
  s["v"] = version;
  s["i"] = packetCnt;
  packetCnt++;

  s["tsm"] = millis();

  float imu_data0[9], imu_data1[9];
  readLSM(imu_data0, lsm6ds33, lis3mdl);
  /*
  readICM(imu_data, icm20948);
  addImuDataToJson(s, imu_data, "1");
  */
  readLSM(imu_data1, lsm6ds33p2, lis3mdlp2);

  addImuDataToJson(s, imu_data0, "0");
  addImuDataToJson(s, imu_data1, "1");

  bool touch = digitalRead(TOUCH_SENSOR_PIN);
  s["tch"] = touch;

  if (gps_data.valid) {
    Serial.println("GPS");
    addGpsDataToJson(s, gps_data);
    gps_data.valid = false;
  }

  strncpy(uart_buf, "?>", 3);
  serializeJson(s, uart_buf + 2, sizeof(uart_buf) - 6);
  strncat(uart_buf, "<?", 3);
  s.clear();

  //Serial.println(uart_buf);

  ble_uart.write((uint8_t *) uart_buf, strnlen(uart_buf, sizeof(uart_buf)));
  return true;
}

bool readGpsFunc(void *) {
  readGps(gps, gps_data, true);
  return true;
}

void setup() {
  Serial.begin(115200);
  Serial.println("Starting Kinisi v1 Sleeve");
  // Initialize devices
  lsm6ds33.begin_I2C();
  lis3mdl.begin_I2C();
  //icm20948.begin_I2C();
  lsm6ds33p2.begin_I2C(0x6B);
  lis3mdlp2.begin_I2C(0x1E);

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
  pinMode(TOUCH_SENSOR_PIN, INPUT_PULLUP);
}

unsigned long delay_ticks = 1;
void loop() {
  delay(delay_ticks);
  delay_ticks = timer.tick();
}
