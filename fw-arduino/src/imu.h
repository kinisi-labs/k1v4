
#ifndef KINISI_IMU_H
#define KINISI_IMU_H

#include <ArduinoJson.h>
#include <Adafruit_LSM6DS33.h>
#include <Adafruit_LIS3MDL.h>
#include <Adafruit_ICM20X.h>
#include <Adafruit_ICM20948.h>

void addImuDataToJson(JsonDocument & s, float * imu_data, char const * suffix) {
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

#endif
