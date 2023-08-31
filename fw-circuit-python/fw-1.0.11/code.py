"""
Kinisi:  Prints data from each of the sensors.
K1 Prototype FW

2020-11-20 M A Chatterjee started
2020-12-03 M A Chatterjee for exception handling, two-way json

2023-07-26 M A Chatterjee fixed reboot errors, samples issue, now requires cp8
2023-08-25 M A Chatterjee Changed 2nd IMU to ICM-20948

2023-08-28 M A Morehead Add GPS

require circuit python 8.x or greater, adafruit libraries
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
import adafruit_icm20x_mod
from adafruit_icm20x_mod import MagDataRate, ICM20948

"""
import adafruit_bno08x
from adafruit_bno08x import (
    BNO_REPORT_ACCELEROMETER,
    BNO_REPORT_GYROSCOPE,
    BNO_REPORT_MAGNETOMETER,
    BNO_REPORT_ROTATION_VECTOR,
)
from adafruit_bno08x.i2c import BNO08X_I2C
"""

i2c = busio.I2C(board.SCL, board.SDA, frequency=4000000)


#from adafruit_lsm6ds.lsm6dsox import LSM6DSOX  # https://www.adafruit.com/product/4517 (not used)
from adafruit_ble import BLERadio
from adafruit_ble.advertising.standard import ProvideServicesAdvertisement
from adafruit_ble.services.nordic import UARTService

import adafruit_gps

"""
from microcontroller import watchdog as wdog
from watchdog import WatchDogMode


wdog.timeout=2.5 # Set a timeout of 2.5 seconds
wdog.mode = WatchDogMode.RAISE
wdog.feed()
"""
import microcontroller
import watchdog

import _bleio
import adafruit_hashlib
import digitalio

wdog = microcontroller.watchdog
wdog.timeout = 5
#wdog.mode = watchdog.WatchDogMode.RAISE

version = "1.0.12 (cp8)"
# incoming data
recvdata = ""   # rec data buffer from host
en_recvd = True # enable receive data from host


def get_ble_name():
    m = adafruit_hashlib.md5()
    mac_address = _bleio.adapter.address
    m.update(mac_address.address_bytes)
    full_digest = m.hexdigest()

    return "kinisi-labs-k1x-" + full_digest[-6:]

print (get_ble_name() + " running firmware: " + version)

def read_gps(s, last_print, debug_print):
    # Every second print out current location details if there's a fix.
    current = time.monotonic()
    if current - last_print >= 1.0:
        gps.update()
        last_print = current
        if not gps.has_fix:
            # Try again if we don't have a fix yet.
            if debug_print:
                print("Waiting for fix...")
            return last_print
        # We have a fix! (gps.has_fix is true)
        # Print out details about the fix like location, date, etc.
        s["g_lat"] = gps.latitude
        s["g_lon"] = gps.longitude
        s["g_fix"] = gps.fix_quality
        s["g_sat"] = gps.satellites
        s["g_alt"] = gps.altitude_m
        s["g_spd"] = gps.speed_knots
        s["g_tra"] = gps.track_angle_deg
        s["g_dil"] = gps.horizontal_dilution
        s["g_geo"] = gps.height_geoid
        timestamp = "{}-{}-{} {:02}:{:02}:{:02}".format(
                    gps.timestamp_utc.tm_year,  # Grab parts of the time from the
                    gps.timestamp_utc.tm_mon,  # struct_time object that holds
                    gps.timestamp_utc.tm_mday,  # the fix time.  Note you might
                    gps.timestamp_utc.tm_hour,  # not get all data like year, day,
                    gps.timestamp_utc.tm_min,  # month!
                    gps.timestamp_utc.tm_sec,
                )

        s["g_tsm"] = timestamp

        if debug_print:
            print("=" * 40)  # Print a separator line.
            print("Fix timestamp:", timestamp)
            print("Latitude: {0:.6f} degrees".format(gps.latitude))
            print("Longitude: {0:.6f} degrees".format(gps.longitude))
            #print(
            #    "Precise Latitude: {:2.}{:2.4f} degrees".format(
            #        gps.latitude_degrees, gps.latitude_minutes
            #    )
            #)
            #print(
            #    "Precise Longitude: {:2.}{:2.4f} degrees".format(
            #        gps.longitude_degrees, gps.longitude_minutes
            #    )
            #)
            print("Fix quality: {}".format(gps.fix_quality))
            # Some attributes beyond latitude, longitude and timestamp are optional
            # and might not be present.  Check if they're None before trying to use!
            if gps.satellites is not None:
                print("# satellites: {}".format(gps.satellites))
            if gps.altitude_m is not None:
                print("Altitude: {} meters".format(gps.altitude_m))
            if gps.speed_knots is not None:
                print("Speed: {} knots".format(gps.speed_knots))
            if gps.track_angle_deg is not None:
                print("Track angle: {} degrees".format(gps.track_angle_deg))
            if gps.horizontal_dilution is not None:
                print("Horizontal dilution: {}".format(gps.horizontal_dilution))
            if gps.height_geoid is not None:
                print("Height geoid: {} meters".format(gps.height_geoid))
    return last_print

try:
    # board init & setup
    lsm6ds33   = adafruit_lsm6ds.lsm6ds33.LSM6DS33(i2c)
    lis3mdl    = adafruit_lis3mdl.LIS3MDL(i2c)

    icm2        = adafruit_icm20x_mod.ICM20948(i2c)

    apds9960 = adafruit_apds9960.apds9960.APDS9960(i2c)
    bmp280 = adafruit_bmp280.Adafruit_BMP280_I2C(i2c)
    sht31d = adafruit_sht31d.SHT31D(i2c)
    microphone = audiobusio.PDMIn(board.MICROPHONE_CLOCK, board.MICROPHONE_DATA, sample_rate=16000, bit_depth=16)

    touch_sensor = digitalio.DigitalInOut(board.D13)
    touch_sensor.switch_to_input(digitalio.Pull.DOWN)

    uart_gps = busio.UART(board.TX, board.RX, baudrate=9600, timeout=10)

    # Create a GPS module instance.
    gps = adafruit_gps.GPS(uart_gps, debug=False)  # Use UART/pyserial
    # Turn on the basic GGA and RMC info (what you typically want)
    gps.send_command(b"PMTK314,0,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0")

    # Turn on just minimum info (RMC only, location):
    # gps.send_command(b'PMTK314,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0')
    # Turn off everything:
    # gps.send_command(b'PMTK314,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0')
    # Turn on everything (not all of it is parsed!)
    # gps.send_command(b'PMTK314,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0')

    # Set update rate to once a second (1hz) which is what you typically want.
    gps.send_command(b"PMTK220,1000")
    # Or decrease to once every two seconds by doubling the millisecond value.
    # Be sure to also increase your UART timeout above!
    # gps.send_command(b'PMTK220,2000')
    # You can also speed up the rate, but don't go too fast or else you can lose
    # data during parsing.  This would be twice a second (2hz, 500ms delay):
    # gps.send_command(b'PMTK220,500')


    ble = BLERadio()
    uart = UARTService()
    ble.name = get_ble_name()
    advertisement = ProvideServicesAdvertisement(uart)

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
    samples = array.array('H', [0] * 80)
    s["sn"]   = normalized_rms(samples)

    # local board acc/gyr/mags
    s["m0"]   = lis3mdl.magnetic
    s["a0"]   = lsm6ds33.acceleration
    s["g0"]   = lsm6ds33.gyro

    s["m1"]   = icm2.magnetic
    s["a1"]   = icm2.acceleration
    s["g1"]   = icm2.gyro

    recdcmd = {"env":True}

    printDbg = False
    run = True

    last_time = time.monotonic()
    while run:
        #wdog.feed()
        #microphone.record(samples, len(samples))

        s= {}
        s["i"] = ix # loop number
        ix+=1 # incr loop count

        # handle received commands from computer / attached BLE client

        envcmd = recdcmd.pop("env","false")
        if str(envcmd) == "true":  # these sensor are "slow" and are environmental so we don't need them as often
            s["v"]    = version
            s["tmp"]  = bmp280.temperature
            s["bar"]  = bmp280.pressure
            s["hum"]  = sht31d.relative_humidity
            s["alt"]  = bmp280.altitude

        #rms sound
        microphone.record(samples, len(samples))
        s["sn"]   = round(normalized_rms(samples),0)

        # local board acc/gyr/mags
        s["m0"]   = rnd_vec(lis3mdl.magnetic,2)
        s["a0"]   = rnd_vec(lsm6ds33.acceleration,2)
        s["g0"]   = rnd_vec(lsm6ds33.gyro,2)


        s["m1"]   = rnd_vec(icm2.magnetic,2)
        s["a1"]   = rnd_vec(icm2.acceleration,2)
        s["g1"]   = rnd_vec(icm2.gyro,2)

        s["tch"] = touch_sensor.value

        last_time = read_gps(s, last_time, printDbg)

        # print(len(json.dumps(s)))
        if printDbg:
            printDebugSensorPacket(s)

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

# debug sensor packet to serial
def printDebugSensorPacket(s):
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
