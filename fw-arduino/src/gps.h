
#ifndef KINISI_GPS_H
#define KINISI_GPS_H

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

void addGpsDataToJson(JsonDocument & s, GpsData & data) {
    if (data.valid) {
        s["g_lat"] = data.g_lat;
        s["g_lon"] = data.g_lon;
        s["g_fix"] = data.g_fix;
        s["g_sat"] = data.g_sat;
        s["g_alt"] = data.g_alt;
        s["g_spd"] = data.g_spd;
        s["g_tra"] = data.g_tra;
        s["g_tsm"] = data.timestamp;
    }
}

void readGps(Adafruit_GPS & gps, GpsData & data, bool debugPrint) {
  gps.read();

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
        Serial.printf("Waiting for fix.... Quality: %d", gps.fixquality);
    }
  }
}

#endif
