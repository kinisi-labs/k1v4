#include <Wire.h>
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
#include "bleuart.h"
#include <cstring>


Adafruit_LSM6DS33 lsm6ds33;
Adafruit_LSM6DS33 lsm6ds33p2;
//Adafruit_ICM20948 icm20948;  // using the alternative address

Adafruit_APDS9960 apds9960;

Adafruit_BMP280 bmp280;

Adafruit_LIS3MDL lis3mdl;
Adafruit_LIS3MDL lis3mdlp2;

Adafruit_SHT31 sht31d;

// For the PDM microphone, you might need a specific library or some custom implementation. 
// There isn't a direct equivalent in the typical Arduino environment.

Adafruit_GPS gps(&Serial1);  // assuming you are connecting the gps to the default hardware serial
BleUart ble_uart;

struct GpsData {
  float g_lat;
  float g_lon;
  int g_fix;
  int g_sat;
  float g_alt;
  float g_spd;
  float g_tra;
  char timestamp[32];
  bool valid;
};

void readGps(bool debugPrint, long lastPrint, GpsData & data) {
  gps.read();

  long currentMillis = millis();
  if (gps.newNMEAreceived()) {
    gps.parse(gps.lastNMEA());

    if (gps.fix) {
      // Storing gps data to a 's' dictionary in Python. Here, you might want to use a struct or global variables.
      // For simplicity, I'll show this using global variables:
      data.g_lat = gps.latitudeDegrees;
      data.g_lon = gps.longitudeDegrees;
      data.g_fix = gps.fixquality;
      data.g_sat = gps.satellites;
      data.g_alt = gps.altitude;
      data.g_spd = gps.speed;
      data.g_tra = gps.angle;
      data.valid = true;
      // The remaining attributes you mentioned aren't standard in Adafruit_gps. They would require custom handling.

      char timestamp[32];
      sprintf(timestamp, "% 4d-%02d-%02d %02d:%02d:%02d",
              gps.year, gps.month, gps.day, gps.hour, gps.minute, gps.seconds);
      // Using a simple char array to store the timestamp. Adjust size if needed.

      if (debugPrint) {
        Serial.println("===============================");
        Serial.print("Fix timestamp: "); Serial.println(timestamp);
        Serial.print("Latitude: "); Serial.println(data.g_lat, 6);
        Serial.print("Longitude: "); Serial.println(data.g_lon, 6);
        Serial.print("Fix quality: "); Serial.println(data.g_fix);
        Serial.print("# satellites: "); Serial.println(data.g_sat);
        Serial.print("Altitude: "); Serial.println(data.g_alt);
        Serial.print("Speed: "); Serial.println(data.g_spd);
        Serial.print("Track angle: "); Serial.println(data.g_tra);
        // Print additional attributes if they are available in your gps library.
      }
    } else if (debugPrint) {
      Serial.println("Waiting for fix...");
    }
  }

}

long lastPrint;

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

  lastPrint = millis();
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

}

void addIMUDataToJson(JsonDocument & s, float * imu_data, char const * suffix) {
  const size_t NAME_BUF_LEN = 16;
  char name[NAME_BUF_LEN] = {'\0'};
  strncpy(name, "g", 2);
  JsonArray g_data = s.createNestedArray(strncat(name, suffix, NAME_BUF_LEN - 2));
  g_data.add(imu_data[0]);
  g_data.add(imu_data[1]);
  g_data.add(imu_data[2]);

  strncpy(name, "a", 2);
  JsonArray a_data = s.createNestedArray(strncat(name, suffix, NAME_BUF_LEN - 2));
  a_data.add(imu_data[3]);
  a_data.add(imu_data[4]);
  a_data.add(imu_data[5]);

 
  strncpy(name, "m", 2);
  JsonArray m_data = s.createNestedArray(strncat(name, suffix, NAME_BUF_LEN - 2));
  m_data.add(imu_data[6]);
  m_data.add(imu_data[7]);
  m_data.add(imu_data[8]);
}

void readLSM(float * imu_data, Adafruit_LSM6DS33 & accel_gyro, Adafruit_LIS3MDL & magnetometer) {
  accel_gyro.readGyroscope(imu_data[0], imu_data[1], imu_data[2]);
  accel_gyro.readAcceleration(imu_data[3], imu_data[4], imu_data[5]);

  magnetometer.read();
  imu_data[6] = magnetometer.x_gauss / 100.;
  imu_data[7] = magnetometer.y_gauss / 100.;
  imu_data[8] = magnetometer.z_gauss / 100.;
}

void readICM(float * imu_data, Adafruit_ICM20948 & imu) {
  sensors_event_t accel;
  sensors_event_t gyro;
  sensors_event_t mag;
  sensors_event_t temp;
  imu.getEvent(&accel, &gyro, &temp, &mag);
  imu_data[0] = gyro.gyro.x;
  imu_data[1] = gyro.gyro.y;
  imu_data[2] = gyro.gyro.z;

  imu_data[3] = accel.acceleration.x;
  imu_data[4] = accel.acceleration.y;
  imu_data[5] = accel.acceleration.z;

  imu_data[6] = mag.magnetic.x;
  imu_data[7] = mag.magnetic.y;
  imu_data[8] = mag.magnetic.z;
}

char uart_buf[1024];
void loop() {
  DynamicJsonDocument s(1024);
  float imu_data[9];
  readLSM(imu_data, lsm6ds33, lis3mdl);
  addIMUDataToJson(s, imu_data, "0");
  /*
  readICM(imu_data, icm20948);
  addIMUDataToJson(s, imu_data, "1");
  */
  readLSM(imu_data, lsm6ds33p2, lis3mdlp2);
  addIMUDataToJson(s, imu_data, "1");

  GpsData gps_data;
  readGps(true, lastPrint, gps_data);

  strncpy(uart_buf, "?>", 3);
  serializeJson(s, uart_buf + 2, sizeof(uart_buf) - 6);
  strncat(uart_buf, "<?", 3);
  Serial.println(uart_buf);

  ble_uart.write((uint8_t *) uart_buf, strnlen(uart_buf, sizeof(uart_buf)));
}
