#!/bin/bash

MOUNT_LOCATION=/run/media/max
BOOTLOADER_DISKNAME=/dev/sda
CIRCUITPY_DISKNAME=/dev/sda1

set -e
pushd "$(dirname "${BASH_SOURCE[0]}")"

#while true; do
#    read -p "Feather ready (light is green)? [Yn] " yn
#    case "$yn" in
#        [Yy]* ) break;;
#        "" ) break;;
#        * ) continue;;
#    esac
#done
#
#echo "Mounting disk for circuitpython upload"
#udisksctl mount -b "$BOOTLOADER_DISKNAME"
#sleep 1
#echo "Mounted"
#
#MNT_NAME=$(ls $MOUNT_LOCATION | tail -1)
#echo "Disk name $MNT_NAME"
#[[ -d "$MOUNT_LOCATION/$MNT_NAME" ]]
#cp ./adafruit-circuitpython-feather_bluefruit_sense-en_US-8.2.3.uf2 "$MOUNT_LOCATION/$MNT_NAME"

while true; do
    read -p "Feather ready (rebooted)? [Yn] " yn
    case "$yn" in
        [Yy]* ) break;;
        "" ) break;;
        * ) continue;;
    esac
done

CURRENT_MOUNTPOINT="$(lsblk -o MOUNTPOINT -nr $CIRCUITPY_DISKNAME)"

echo "Mounting disk for code upload"
if [[ -z "${CURRENT_MOUNTPOINT// }" ]]; then
    udisksctl mount -b "$CIRCUITPY_DISKNAME"
elif [[ "${CURRENT_MOUNTPOINT}" != "$MOUNT_LOCATION/CIRCUITPY" ]]; then
    udisksctl unmount -b "$CIRCUITPY_DISKNAME"
    udisksctl mount -b "$CIRCUITPY_DISKNAME"
fi

sleep 1
[[ -d "$MOUNT_LOCATION/CIRCUITPY" ]]
rm -rf "$MOUNT_LOCATION/CIRCUITPY/lib"
cp -r lib "$MOUNT_LOCATION/CIRCUITPY/"
cp code.py "$MOUNT_LOCATION/CIRCUITPY/"
udisksctl unmount -b "$CIRCUITPY_DISKNAME"



