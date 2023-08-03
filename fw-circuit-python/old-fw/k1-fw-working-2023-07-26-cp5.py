"""Kinisi:  Prints data from each of the sensors."""
"""Working as of 2023-07-26 """
import time
import array
import math
import board
import supervisor

import audiobusio
import adafruit_apds9960.apds9960
import adafruit_bmp280
import adafruit_lis3mdl
import adafruit_lsm6ds.lsm6ds33
import adafruit_sht31d
from adafruit_lsm6ds.lsm6dsox import LSM6DSOX
import json
from adafruit_ble import BLERadio
from adafruit_ble.advertising.standard import ProvideServicesAdvertisement
from adafruit_ble.services.nordic import UARTService


i2c = board.I2C()
lsm6ds33   = adafruit_lsm6ds.lsm6ds33.LSM6DS33(i2c)
lsm6ds33p2 = adafruit_lsm6ds.lsm6ds33.LSM6DS33(i2c,0x6B)


apds9960 = adafruit_apds9960.apds9960.APDS9960(i2c)

ble = BLERadio()
uart = UARTService()
ble.name = "kinisi-k1"
advertisement = ProvideServicesAdvertisement(uart)

bmp280 = adafruit_bmp280.Adafruit_BMP280_I2C(i2c)

lis3mdl = adafruit_lis3mdl.LIS3MDL(i2c)
lis3mdlp2 = adafruit_lis3mdl.LIS3MDL(i2c,0x1E)


sht31d = adafruit_sht31d.SHT31D(i2c)
microphone = audiobusio.PDMIn(board.MICROPHONE_CLOCK, board.MICROPHONE_DATA,
                              sample_rate=16000, bit_depth=16)

def normalized_rms(values):
    minbuf = int(sum(values) / len(values))
    return int(math.sqrt(sum(float(sample - minbuf) *
                             (sample - minbuf) for sample in values) / len(values)))

apds9960.enable_proximity = True
apds9960.enable_color = True

# Set this to sea level pressure in hectoPascals at your location for accurate altitude reading.
bmp280.sea_level_pressure = 1013.25

ix = 0 # packet number
print("Kinisi: Waiting to connect")
iscon = 0  # is connected
s = {}
printDbg = False
run = True
while run:
    samples = array.array('H', [0] * 160)
    microphone.record(samples, len(samples))
    s["i"] = ix


    s["t"] = time.monotonic_ns()
    if (ix % 64) == 0:
        s["prx"]  = apds9960.proximity
        s["col"]  = apds9960.color_data
        s["tmp"]  = bmp280.temperature
        s["bar"]  = bmp280.pressure
        s["hum"]  = sht31d.relative_humidity
        s["alt"]  = bmp280.altitude
    s["m0"]   = lis3mdl.magnetic
    s["a0"]   = lsm6ds33.acceleration
    s["g0"]   = lsm6ds33.gyro

    s["m1"] = lis3mdlp2.magnetic
    s["a1"] = lsm6ds33p2.acceleration
    s["g1"] = lsm6ds33p2.gyro

    s["sn"]   = normalized_rms(samples)

    ix+=1
#   print(len(json.dumps(s)))
    if printDbg:
        print("\nSensors")
        print("---------------------------------------------")
        print("Proximity:", s["prx"])
        print("Red: {}, Green: {}, Blue: {}, Clear: {}".format(* s["col"]))
        print("Temperature: {:.1f} C".format(s["tmp"]))
        print("Barometric pressure:", s["bar"])
        print("Altitude: {:.1f} m".format(s["alt"]))
        print("Magnetic: {:.3f} {:.3f} {:.3f} uTesla".format(* s["m0"]))
        print("Acceleration: {:.2f} {:.2f} {:.2f} m/s^2".format(* s["a0"]))
        print("Gyro: {:.2f} {:.2f} {:.2f} dps".format(* s["g0"]))
        print("Humidity: {:.1f} %".format(s["hum"]))
        print("Sound level:", s["sn"])


    if (not ble.connected):
        ble.start_advertising(advertisement)

    while not ble.connected:
        pass
    s["tx"] = 0
    ot = s["tx"]
    s["tx"] = time.monotonic_ns()
    s["td"] = s["tx"] - s["t"]
    s["ot"] = s["tx"] - ot
    if ble.connected:
        if (iscon == 0):
            print("Connected")
            iscon += 1

        #udatain = uart.readline()
        #if udatain:
        #    print(udatain)

            """
            try:
                result = str(eval(s))
            except Exception as e:
                result = repr(e)
            uart.write(result.encode("utf-8"))
            """
        try :
            uart.write("?>"+json.dumps(s)+"<?")
        except : 
            supervisor.reload()
    else:
        iscon=0


