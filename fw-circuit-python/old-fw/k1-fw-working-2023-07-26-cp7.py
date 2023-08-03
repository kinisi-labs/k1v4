"""
Kinisi:  Prints data from each of the sensors.
K1 Prototype FW

M A Chatterjee
2020-11-20 started
2020-12-03 for exception handling, two-way json

require circuit python 7.0x or greater, adafruit libraries

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
import supervisor
import json

#hw specific
import audiobusio
import adafruit_apds9960.apds9960
import adafruit_bmp280
import adafruit_lis3mdl
import adafruit_lsm6ds.lsm6ds33
import adafruit_sht31d
#from adafruit_lsm6ds.lsm6dsox import LSM6DSOX
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

version = "1.0.5"
# incoming data
recvdata = ""   # rec data buffer from host
en_recvd = True # enable receive data from host

try:
    # board init & setup
    i2c = board.I2C()
    lsm6ds33   = adafruit_lsm6ds.lsm6ds33.LSM6DS33(i2c)
    lsm6ds33p2 = adafruit_lsm6ds.lsm6ds33.LSM6DS33(i2c,0x6B)

    apds9960 = adafruit_apds9960.apds9960.APDS9960(i2c)

    bmp280 = adafruit_bmp280.Adafruit_BMP280_I2C(i2c)

    lis3mdl = adafruit_lis3mdl.LIS3MDL(i2c)
    lis3mdlp2 = adafruit_lis3mdl.LIS3MDL(i2c,0x1E)

    sht31d = adafruit_sht31d.SHT31D(i2c)
    microphone = audiobusio.PDMIn(board.MICROPHONE_CLOCK, board.MICROPHONE_DATA,
                                  sample_rate=16000, bit_depth=16)

    ble = BLERadio()
    uart = UARTService()
    ble.name = "kinisi-labs-k1x"

    advertisement = ProvideServicesAdvertisement(uart)
    
    samples = array.array('H', [0] * 160)

    def normalized_rms(values):
        minbuf = int(sum(values) / len(values))
        if (len(values)<1):
            return 0
        return int(math.sqrt(sum(float(sample - minbuf) *
                                 (sample - minbuf) for sample in values) / len(values)))

    apds9960.enable_proximity = True
    apds9960.enable_color = True

    # Set this to sea level pressure in hectoPascals at your location for accurate altitude reading.
    bmp280.sea_level_pressure = 1013.25

    ix = 0 # packet number
    print("Kinisi: Waiting to connect")  # serial port
    iscon = 0  # is connected
    s = {}
    # initial values
    s["v"]    = version
    s["prx"]  = apds9960.proximity
    s["col"]  = apds9960.color_data
    s["tmp"]  = bmp280.temperature
    s["bar"]  = bmp280.pressure
    s["hum"]  = sht31d.relative_humidity
    s["alt"]  = bmp280.altitude

    #rms sound
    s["sn"]   = normalized_rms(samples)

    # local board acc/gyr/mags
    s["m0"]   = lis3mdl.magnetic
    s["a0"]   = lsm6ds33.acceleration
    s["g0"]   = lsm6ds33.gyro

    # 2nd board acc/gyro/mags
    s["m1"]   = lis3mdlp2.magnetic
    s["a1"]   = lsm6ds33p2.acceleration
    s["g1"]   = lsm6ds33p2.gyro





    recdcmd = {"env":True}

    printDbg = False
    run = True



    while run:
        #wdog.feed()
        samples = array.array('H', [0] * 160)
        microphone.record(samples, len(samples))
        s= {}
        s["i"] = ix # loop number
        ix+=1 # incr loop count
        s["t"] = time.monotonic_ns() # time stamp
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
        s["sn"]   = normalized_rms(samples)

        # local board acc/gyr/mags
        #s["m0"]   = lis3mdl.magnetic
        s["a0"]   = lsm6ds33.acceleration
        s["g0"]   = lsm6ds33.gyro

        # 2nd board acc/gyro/mags
        #s["m1"] = lis3mdlp2.magnetic
        s["a1"] = lsm6ds33p2.acceleration
        s["g1"] = lsm6ds33p2.gyro

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
        s["tx"] = time.monotonic_ns() # transmit timestamp
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
                uart.write("?>"+json.dumps(s)+"<?") # encode data with packet delims TODO: improve
            except :
                print("err ble.connect" )
                supervisor.reload() # reboot if exception
        else:
            iscon=0
            
except Exception as e:
    print("err main" , e)
    supervisor.reload() #reboot if exceptions

