# NRF52840 bootloader update

# install boot loader utility

pip3 install --user adafruit-nrfutil

# Put board in to bootloader update mode 
attach to usb port on laptop

double click the reset button on the board to enter bootloader mode

# find the device
```bash
ls /dev/cu*.
```
look for something like: /dev/cu.usbmodem14201


# update the device
```bash
adafruit-nrfutil --verbose dfu serial --package feather_nrf52840_sense_bootloader-0.7.0_s140_6.1.1.zip  -p /dev/cu.usbmodem14201 -b 115200 --singlebank --touch 1200
```

# note if getting errors like adafruit-nrfutil not found, run this
```bash
echo "export PATH=\"`python3 -m site --user-base`/bin:\$PATH\"" >> ~/.bashrc
source ~/.bashrc
```