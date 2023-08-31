#!/bin/bash

MOUNT_LOCATION=/run/media/max
BOOTLOADER_DISKNAME=/dev/sda
CIRCUITPY_DISKNAME=/dev/sda1

set -e
pushd "$(dirname "${BASH_SOURCE[0]}")"

while true; do
    read -p "Feather ready (light is green)? [Yn] " yn
    case "$yn" in
        [Yy]* ) break;;
        "" ) break;;
        * ) continue;;
    esac
done
adafruit-nrfutil --verbose dfu serial --package ../bootloader-nrf52840sense-v0.70/feather_nrf52840_sense_bootloader-0.7.0_s140_6.1.1.zip  -p /dev/ttyACM0 -b 115200 --singlebank --touch 1200

echo "Mounting disk for circuitpython upload"
sleep 2
udisksctl mount -b "$BOOTLOADER_DISKNAME"
sleep 1
echo "Mounted"

MNT_NAME=$(ls $MOUNT_LOCATION | tail -1)
echo "Disk name $MNT_NAME"
[[ -d "$MOUNT_LOCATION/$MNT_NAME" ]]
cp ./adafruit-circuitpython-feather_bluefruit_sense-en_US-8.2.3.uf2 "$MOUNT_LOCATION/$MNT_NAME"

while true; do
    read -p "Feather ready (rebooted)? [Yn] " yn
    case "$yn" in
        [Yy]* ) break;;
        "" ) break;;
        * ) continue;;
    esac
done
echo "Mounting disk for code upload"
udisksctl mount -b "$CIRCUITPY_DISKNAME"
sleep 1
[[ -d "$MOUNT_LOCATION/CIRCUITPY" ]]
rm -rf "$MOUNT_LOCATION/CIRCUITPY/lib"
cp -r lib "$MOUNT_LOCATION/CIRCUITPY/"
cp code.py "$MOUNT_LOCATION/CIRCUITPY/"
udisksctl unmount -b "$CIRCUITPY_DISKNAME"



