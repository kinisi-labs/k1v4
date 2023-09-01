#!/bin/bash

function wait_for_confirm() {
    while true; do
        read -p "$1 [Yn]: " yn
        case "$yn" in
            [Yy]* ) break;;
            "" ) break;;
            * ) continue;;
        esac
    done
}

function array_contains_element() {
    local ARRAY="$2"
    for x in "${ARRAY[@]}"; do
        if [[ "$x" == "$1" ]]; then
            return 0
        fi
    done
    return 1
}

function update_bootloader() {
    wait_for_confirm "Feather ready (light is green)?"

    while true; do
        POSSIBLE_SERIAL_PORTS=("$KINISI_SERIAL_PORT_PREFIX"*)
        if [[ ${#POSSIBLE_SERIAL_PORTS[@]} -eq 0 ]]; then
            echo "No serial device connected"
            wait_for_confirm "Is the NRFSense connected?"
        else
            echo "Enter number corresponding to serial port" 
            select opt in "${POSSIBLE_SERIAL_PORTS[@]}"; do
                if [[ -z "$opt" ]]; then
                    echo "Invalid entry"
                    break
                else
                    SERIAL_PORT="$opt"
                    break 2
                fi
            done
        fi
    done

    echo "Serial port $SERIAL_PORT"

    adafruit-nrfutil --verbose dfu serial --package ../bootloader-nrf52840sense-v0.70/feather_nrf52840_sense_bootloader-0.7.0_s140_6.1.1.zip  -p "$SERIAL_PORT" -b 115200 --singlebank --touch 1200
}

function update_runtime() {
    while true; do
        if [[ -d "$KINISI_MOUNT_LOCATION/FTHRSNSBOOT" ]]; then
            break
        else
            echo "Unable able to find drive in $KINISI_MOUNT_LOCATION. Files:"
            POSSIBLE_DRIVES=("$KINISI_MOUNT_LOCATION"/*)
            for file in "${POSSIBLE_DRIVES[@]}"; do
                echo "    $file"
            done
            wait_for_confirm "Feather ready (light is green)?"
        fi
    done
    cp ./adafruit-circuitpython-feather_bluefruit_sense-en_US-8.2.3.uf2 -t "$KINISI_MOUNT_LOCATION/FTHRSNSBOOT"
}

function update_code() {

    wait_for_confirm "Feather mounted and in safemode?"
    while true; do
        if [[ -d "$KINISI_MOUNT_LOCATION/CIRCUITPY" ]]; then
            break
        else
            echo "Unable able to find drive in $KINISI_MOUNT_LOCATION. Files:"
            POSSIBLE_DRIVES=("$KINISI_MOUNT_LOCATION"/*)
            for file in "${POSSIBLE_DRIVES[@]}"; do
                echo "    $file"
            done
            wait_for_confirm "Feather mounted and in safemode?"
        fi
    done

    if command -v rsync > /dev/null 2>&1; then
        rsync -ric --delete "./lib/" "$KINISI_MOUNT_LOCATION/CIRCUITPY/lib"
    else
        rm -rf "$KINISI_MOUNT_LOCATION/CIRCUITPY/lib"
        cp -r lib "$KINISI_MOUNT_LOCATION/CIRCUITPY/"
    fi
    cp code.py safemode.py -t "$KINISI_MOUNT_LOCATION/CIRCUITPY/"
}

set -e
shopt -s nullglob
pushd "$(dirname "${BASH_SOURCE[0]}")"

while true; do
    if [[ $# -eq 0 ]]; then
        break
    fi

    case "$1" in
        -b | --bootloader ) IS_BOOTLOADER=true;;
        -r | --runtime ) IS_RUNTIME=true;;
        -* | --* ) echo "Invalid option $1"; exit 1;;
        * ) echo "Invalid position argument $1"; exit 1;;
    esac
    shift
done

case "$(uname)" in
    "Linux" )
        [[ -z "$KINISI_MOUNT_LOCATION" ]] && KINISI_MOUNT_LOCATION="/run/media/$(whoami)"
        [[ -z "$KINISI_SERIAL_PORT_PREFIX" ]] && KINISI_SERIAL_PORT_PREFIX="/dev/ttyACM" ;;
    "Darwin" )
        [[ -z "$KINISI_MOUNT_LOCATION" ]] && KINISI_MOUNT_LOCATION="/Volumes"
        [[ -z "$KINISI_SERIAL_PORT_PREFIX" ]] && KINISI_SERIAL_PORT_PREFIX="/dev/cu.usbmodem" ;;
    * ) echo "Unsupported OS: $(uname)"; exit 1;;
esac

echo "Mount location: $KINISI_MOUNT_LOCATION"

if [[ "$IS_BOOTLOADER" == true ]]; then
    ACTIONS=("bootloader" "runtime" "code")
elif [[ "$IS_RUNTIME" == true ]]; then
    ACTIONS=("runtime" "code")
else
    while true; do
        POSSIBLE_DRIVES=("$KINISI_MOUNT_LOCATION"/*)
        if array_contains_element "$KINISI_MOUNT_LOCATION/FTHRSNSBOOT" \
                "${POSSIBLE_DRIVES[@]}"; then
            ACTIONS=("runtime" "code")
            break
        elif array_contains_element "$KINISI_MOUNT_LOCATION/CIRCUITPY" \
                "${POSSIBLE_DRIVES[@]}"; then
            ACTIONS=("code")
            break
        else
            echo "Unable to find mounted device"
            for file in "${POSSIBLE_DRIVES[@]}"; do
                echo "    $file"
            done
            wait_for_confirm "Device mounted?"
        fi
    done
fi

for action in "${ACTIONS[@]}"; do
    case "$action" in
        "bootloader" ) update_bootloader;;
        "runtime" ) update_runtime;;
        "code" ) update_code;;
        * ) echo "Invalid action $action"; exit 1;;
    esac
    sleep 1
done

#CURRENT_MOUNTPOINT="$(lsblk -o MOUNTPOINT -nr $CIRCUITPY_DISKNAME)"
#
#if [[ -z "${CURRENT_MOUNTPOINT// }" ]]; then
#    echo "Mounting disk for code upload"
#    udisksctl mount -b "$CIRCUITPY_DISKNAME"
#elif [[ "${CURRENT_MOUNTPOINT}" != "$MOUNT_LOCATION/CIRCUITPY" ]]; then
#    echo "remounting disk for code upload"
#    udisksctl unmount -b "$CIRCUITPY_DISKNAME"
#    udisksctl mount -b "$CIRCUITPY_DISKNAME"
#fi
#echo "Finished mount"


