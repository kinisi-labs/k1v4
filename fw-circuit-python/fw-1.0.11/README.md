# fw 1.0.11 Circuit Python


# HW Requirements
* Adafruit Feather Sense nrf52840
* ICM 20948 via i2c 


# SW Requirements
* Circuit Python 8

# Install Circuit Python 8 
This requires the bootloader to be atleast 0.61 or greater.  You can check this by reading the 
INFO_UF2.txt in bootloader mode.

To get to bootloader mode, plug in the feather sense and double click the bootloader button (one closer to the usb-port on the board)


## Update the bootloader
See instuctions in the folder: bootloader-nrf52840sense-v0.70

The readme is here: 
[update-bootloader](../bootloader-nrf52840sense-v0.70/README.md)


# Update Firmware
copy code.py to the CIRCUITPY drive
copy (recursively) the lib folder to the CIRCUITPY drive
Note that this code uses the modified Adafruit_ICM20x_mod.py instead of the Adafruit_ICM20x.mpy

If you have trouble copying code.py to the drive, try putting the device into safe mode. Do this by tapping the reset button, and then tapping it a second time once the LED turns yellow. In safe mode, no code is run, so you'll have to reset the device when you are ready to run the code.

# Update Script
Instead of the manually update instructions you can run
```
    ./update_code.sh -b
```
to update the bootloader, runtime, and code. If you want to update the runtime and code, run
```
    ./update_code.sh -r
    # or
    ./update_code.sh # if in bootloader mode when the script starts, i.e. double tap the reset button and LED turns green
```
To update just the code, run `./update_code.sh`. It's most reliable to update the code while in safe mode.

The code update will be faster if you install rsync (otherwise the lib folder is deleted and recopied).

