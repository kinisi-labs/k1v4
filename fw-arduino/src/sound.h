#ifndef KINISI_SOUND_H
#define KINISI_SOUND_H

#include <Arduino.h>
#include <PDM.h>


class KinisiSound {
 private:
  static int readings;
  static int16_t sound_buffer[320];
  static volatile double last_sound;

  static void pdm_on_receive() {
    int bytesAvailable = PDM.available();

    PDM.read(sound_buffer, bytesAvailable);
    readings = bytesAvailable / 2;
    last_sound = normalized_rms();
  }

  static double normalized_rms() {
    int32_t sum = 0;
    for (int i = 0; i < readings; i++) {
      sum += sound_buffer[i];
    }

    int32_t avg = (sum + readings / 2) / readings;

    int64_t sq_sum = 0;

    for (int i = 0; i < readings; i++) {
      int32_t diff = sound_buffer[i] - avg;
      sq_sum += diff * diff;
    }

    return sqrt((double) sq_sum / (double) readings);
  }
 public:
  void setup();

  void loop(JsonDocument & s) {
    s["sn"] = last_sound;
  }

};

void KinisiSound::setup() {
  PDM.setBufferSize(sizeof(sound_buffer));
  PDM.onReceive(&KinisiSound::pdm_on_receive);
  PDM.begin(1, 16000);
}

int KinisiSound::readings = 0;
int16_t KinisiSound::sound_buffer[320] = { 0 };
volatile double KinisiSound::last_sound = 0.0;

#endif
