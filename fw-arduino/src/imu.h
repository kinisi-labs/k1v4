
#ifndef KINISI_IMU_H
#define KINISI_IMU_H

#include <Adafruit_ICM20948.h>
#include <Adafruit_ICM20X.h>
#include <Adafruit_LIS3MDL.h>
#include <Adafruit_LSM6DS33.h>
#include <ArduinoJson.h>

class KinisiImu {
 private:
  bool icm_init = false;
  bool lsm_init = false;

  Adafruit_LSM6DS33 lsm6ds33;
  Adafruit_LSM6DS33 lsm6ds33p2;
  Adafruit_ICM20948 icm20948;

  Adafruit_LIS3MDL lis3mdl;
  Adafruit_LIS3MDL lis3mdlp2;

  void addImuDataToJson(JsonDocument & s, float * imu_data, char const * suffix);
  void readICM(float * imu_data, Adafruit_ICM20948 & imu);
  void readLSM(float * imu_data, Adafruit_LSM6DS33 & accel_gyro, Adafruit_LIS3MDL & magnetometer);

 public:
  void setup() {
    lsm6ds33.begin_I2C();
    lis3mdl.begin_I2C();
    icm_init = icm20948.begin_I2C();
    if (!icm_init) {
      lsm_init = lsm6ds33p2.begin_I2C(0x6B);
      if (lsm_init) {
        lsm_init = lis3mdlp2.begin_I2C(0x1E); 
      }
    }
  }

  void loop(JsonDocument & s) {
    float imu_data0[9], imu_data1[9];
    readLSM(imu_data0, lsm6ds33, lis3mdl);
    if (icm_init) {
      readICM(imu_data1, icm20948);
      addImuDataToJson(s, imu_data1, "1");
    } else if (lsm_init) {
      readLSM(imu_data1, lsm6ds33p2, lis3mdlp2); 
      addImuDataToJson(s, imu_data1, "1");
    } else {
    }

    addImuDataToJson(s, imu_data0, "0");
  }

};

void KinisiImu::addImuDataToJson(JsonDocument & s, float * imu_data, char const * suffix) {
  const size_t NAME_BUF_LEN = 16;
  char name[NAME_BUF_LEN] = {'\0'};
  strncpy(name, "g", 2);
  JsonArray g_data =
      s.createNestedArray(strncat(name, suffix, NAME_BUF_LEN - 2));
  g_data.add(imu_data[0]);
  g_data.add(imu_data[1]);
  g_data.add(imu_data[2]);

  strncpy(name, "a", 2);
  JsonArray a_data =
      s.createNestedArray(strncat(name, suffix, NAME_BUF_LEN - 2));
  a_data.add(imu_data[3]);
  a_data.add(imu_data[4]);
  a_data.add(imu_data[5]);

  strncpy(name, "m", 2);
  JsonArray m_data =
      s.createNestedArray(strncat(name, suffix, NAME_BUF_LEN - 2));
  m_data.add(imu_data[6]);
  m_data.add(imu_data[7]);
  m_data.add(imu_data[8]);
}

  void KinisiImu::readLSM(float *imu_data, Adafruit_LSM6DS33 &accel_gyro,
             Adafruit_LIS3MDL &magnetometer) {
  sensors_event_t accel;
  sensors_event_t gyro;
  sensors_event_t mag;
  sensors_event_t temp;
  accel_gyro.getEvent(&accel, &gyro, &temp);

  magnetometer.getEvent(&mag);
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

void KinisiImu::readICM(float *imu_data, Adafruit_ICM20948 &imu) {
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

#endif
