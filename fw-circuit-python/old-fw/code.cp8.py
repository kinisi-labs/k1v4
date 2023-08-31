"""
Kinisi:  Prints data from each of the sensors.
K1 Prototype FW

M A Chatterjee
2020-11-20 started
2020-12-03 for exception handling, two-way json

require circuit python 8.x or greater, adafruit libraries

2023-07-26 : fixed reboot errors, samples issue

*****
    make sure this file is named
    code.py
    and in the the root dir
*****
"""
import sys
import time
import array
import math
import board
import busio
from board import *
import supervisor
import json

#hw specific
import audiobusio
import adafruit_apds9960.apds9960  # on board
import adafruit_bmp280             # on board
import adafruit_lis3mdl            # on board
import adafruit_lsm6ds.lsm6ds33    # on board
import adafruit_sht31d             # on board

import adafruit_bno08x
from adafruit_bno08x import (
    BNO_REPORT_ACCELEROMETER,
    BNO_REPORT_GYROSCOPE,
    BNO_REPORT_MAGNETOMETER,
    BNO_REPORT_ROTATION_VECTOR,
)
from adafruit_bno08x.i2c import BNO08X_I2C

i2c = busio.I2C(board.SCL, board.SDA, frequency=800000)


#from adafruit_lsm6ds.lsm6dsox import LSM6DSOX  # https://www.adafruit.com/product/4517 (not used)
from adafruit_ble import BLERadio
from adafruit_ble.advertising.standard import ProvideServicesAdvertisement
from adafruit_ble.services.nordic import UARTService


"""
from microcontroller import watchdog as wdog
from watchdog import WatchDogMode


wdog.timeout=2.5 # Set a timeout of 2.5 seconds
wdog.mode = WatchDogMode.RAISE
wdog.feed()
"""
import microcontroller
import watchdog

wdog = microcontroller.watchdog
wdog.timeout = 5
#wdog.mode = watchdog.WatchDogMode.RAISE

version = "1.0.9 (cp8)"
# incoming data
recvdata = ""   # rec data buffer from host
en_recvd = True # enable receive data from host

print ("kinisi k1x running firmware: " + version)

try:
    # board init & setup
   # i2c = busio.I2C(SCL,SDA,frequency=800000)
    lsm6ds33   = adafruit_lsm6ds.lsm6ds33.LSM6DS33(i2c)

    #lsm6ds33p2 = adafruit_lsm6ds.lsm6ds33.LSM6DS33(i2c,0x6B)


    bno = BNO08X_I2C(i2c)
    bno2 = BNO08X_I2C(i2c,address=0x4b)


    bno.enable_feature(BNO_REPORT_ACCELEROMETER)
    bno.enable_feature(BNO_REPORT_GYROSCOPE)
    bno.enable_feature(BNO_REPORT_MAGNETOMETER)
    bno.enable_feature(BNO_REPORT_ROTATION_VECTOR)


    bno2.enable_feature(BNO_REPORT_ACCELEROMETER)
    bno2.enable_feature(BNO_REPORT_GYROSCOPE)
    bno2.enable_feature(BNO_REPORT_MAGNETOMETER)
    bno2.enable_feature(BNO_REPORT_ROTATION_VECTOR)

    # apds9960 = adafruit_apds9960.apds9960.APDS9960(i2c)

    bmp280 = adafruit_bmp280.Adafruit_BMP280_I2C(i2c)

    lis3mdl = adafruit_lis3mdl.LIS3MDL(i2c)
    # lis3mdlp2 = adafruit_lis3mdl.LIS3MDL(i2c,0x1E)

    sht31d = adafruit_sht31d.SHT31D(i2c)
    microphone = audiobusio.PDMIn(board.MICROPHONE_CLOCK, board.MICROPHONE_DATA,
                                  sample_rate=16000, bit_depth=16)

    ble = BLERadio()
    uart = UARTService()
    ble.name = "kinisi-labs-k1x"

    advertisement = ProvideServicesAdvertisement(uart)

    samples = array.array('H', [0] * 80)


    def normalized_rms(values):
        minbuf = int(sum(values) / len(values))
        if (len(values)<1):
            return 0
        return int(math.sqrt(sum(float(sample - minbuf) *
                                 (sample - minbuf) for sample in values) / len(values)))

    def rnd_vec(x,p):
        return [ round(elem, p) for elem in x ]


    # Set this to sea level pressure in hectoPascals at your location for accurate altitude reading.
    bmp280.sea_level_pressure = 1013.25

    ix = 0 # packet number
    print("Kinisi: Waiting to connect")  # serial port
    iscon = 0  # is connected
    s = {}
    # initial values
    s["v"]    = version
    """
    s["prx"]  = apds9960.proximity
    s["col"]  = apds9960.color_data
    s["tmp"]  = bmp280.temperature
    s["bar"]  = bmp280.pressure
    s["hum"]  = sht31d.relative_humidity
    s["alt"]  = bmp280.altitude
    """
    #rms sound
    s["sn"]   = normalized_rms(samples)

    # local board acc/gyr/mags
    s["m0"]   = lis3mdl.magnetic
    s["a0"]   = lsm6ds33.acceleration
    s["g0"]   = lsm6ds33.gyro

    # 2nd board acc/gyro/mags K1 used LIS3MDL / LSM6DS33 (now deprecated hardware)
    #s["m1"]   = lis3mdlp2.magnetic
    #s["a1"]   = lsm6ds33p2.acceleration
    #s["g1"]   = lsm6ds33p2.gyro

    #accel_x, accel_y, accel_z = bno.acceleration  # pylint:disable=no-member
    #print("X: %0.6f  Y: %0.6f Z: %0.6f  m/s^2" % (accel_x, accel_y, accel_z))

    s["m1"]   = bno.magnetic
    s["a1"]   = bno.acceleration
    s["g1"]   = bno.gyro

    # print (s)


    recdcmd = {"env":True}

    printDbg = False
    run = True


    samples = array.array('H', [0] * 80)

    while run:
        #wdog.feed()
        microphone.record(samples, len(samples))
        #s= {}
        s["i"] = ix # loop number
        ix+=1 # incr loop count
        #s["t"] = time.monotonic_ns() # time stamp
        #envcmd = True
        #print ("64:" + str(recdcmd))
        #if ble.connected:
        envcmd = recdcmd.pop("env","false")
        if str(envcmd) == "true":  # these sensor are "slow" and are environmental so we don't need them as often
            s["v"]    = version
            #s["prx"]  = apds9960.proximity
            #s["col"]  = apds9960.color_data
            s["tmp"]  = bmp280.temperature
            s["bar"]  = bmp280.pressure
            s["hum"]  = sht31d.relative_humidity
            s["alt"]  = bmp280.altitude

        #rms sound
        s["sn"]   = round(normalized_rms(samples),0)

        # local board acc/gyr/mags
        s["m0"]   = rnd_vec(lis3mdl.magnetic,2)
        s["a0"]   = rnd_vec(lsm6ds33.acceleration,2)
        s["g0"]   = rnd_vec(lsm6ds33.gyro,2)


        #s["m0"]   = rnd_vec(bno.magnetic,2)
        #s["a0"]   = rnd_vec(bno.acceleration,2)
        #s["g0"]   = rnd_vec(bno.gyro,2)

        s["m1"]   = rnd_vec(bno2.magnetic,2)
        s["a1"]   = rnd_vec(bno2.acceleration,2)
        s["g1"]   = rnd_vec(bno2.gyro,2)

        """
        s["m0"]   = lis3mdl.magnetic
        s["a0"]   = lsm6ds33.acceleration
        s["g0"]   = lsm6ds33.gyro

        #s["m1"]   = bno.magnetic
        #s["a1"]   = bno.acceleration
        #s["g1"]   = bno.gyro
        """
        # 2nd board acc/gyro/mags
        #s["m1"] = rnd_vec(lis3mdlp2.magnetic,2)
        #s["a1"] = rnd_vec(lsm6ds33p2.acceleration,2)
        #s["g1"] = rnd_vec(lsm6ds33p2.gyro,2)



        #quat_i, quat_j, quat_k, quat_real = bno.quaternion

        # print(len(json.dumps(s)))
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
        #s["tx"] = time.monotonic_ns() # transmit timestamp
        if ble.connected:
            if (iscon == 0):
                print("Connected")
                iscon += 1
            #input from host (slow..)
            try :
                if (en_recvd == True):
                    if uart.in_waiting:
                        recvdata = uart.read(256)
                        if recvdata :
                            recvdata = recvdata.decode("utf8")
                            print("recd: " + recvdata )# write to console... use only for debugging
                            if recvdata == "stop":
                                en_recvd = False
                            try:
                                recdcmd = {}
                                recdcmd =  json.loads(recvdata)
                                #print ("146"+str(recdcmd) + str(type(recdcmd)))
                                if (not isinstance(recdcmd,dict)):
                                   recdcmd = {}
                            except :
                                print("err recd cmd over ble" + ex)
                                recdcmd ={}
                uart.write("?>"+json.dumps(s,separators=(',', ':'))+"<?") # encode data with packet delims TODO: improve
            except :
                print("err ble.connect" )
                supervisor.reload() # reboot if exception
        else:
            iscon=0

except Exception as e:
    print("err main" , e)
    supervisor.reload() #reboot if exceptions

