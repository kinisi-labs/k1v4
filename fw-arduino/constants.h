
#ifndef KINISI_CONSTANTS_H
#define KINISI_CONSTANTS_H

constexpr int IMU_UPDATE_PERIOD_MS = 25;
constexpr int SOUND_UPDATE_PERIOD_MS = IMU_UPDATE_PERIOD_MS;
constexpr int GPS_UPDATE_PERIOD_MS = 1000;
constexpr int SOUND_BUFFER_SIZE = 16 * SOUND_UPDATE_PERIOD_MS;
const char * FW_VERSION = "1.1.4";
const char * HW_VERSION = "k1x-1.0";

#endif
