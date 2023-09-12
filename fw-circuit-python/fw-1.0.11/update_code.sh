#!/bin/bash

[[ -z "$KINISI_RSYNC" ]] && KINISI_RSYNC=false
[[ -z "$KINISI_CPY_VERSION" ]] && KINISI_CPY_VERSION=7

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
    wait_for_confirm "Device reboot and light is green"
    while true; do
        if [[ -e "$KINISI_MOUNT_LOCATION/FTHRSNSBOOT" && ! -f "$KINISI_MOUNT_LOCATION/CIRCUITPY" ]]; then
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
    if [[ $KINISI_CPY_VERSION = 7 ]]; then
        cp ../CircuitPython7/adafruit-circuitpython-feather_bluefruit_sense-en_US-7.2.4.uf2 "$KINISI_MOUNT_LOCATION/FTHRSNSBOOT"
    else
        cp ./adafruit-circuitpython-feather_bluefruit_sense-en_US-8.2.3.uf2 "$KINISI_MOUNT_LOCATION/FTHRSNSBOOT"
    fi
}

function update_code() {

    wait_for_confirm "Feather mounted and in safemode?"
    while true; do
        if [[ -e "$KINISI_MOUNT_LOCATION/CIRCUITPY" && ! -f "$KINISI_MOUNT_LOCATION/CIRCUITPY" ]]; then
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

    if [[ "$KINISI_CPY_VERSION" == 7 ]]; then
        LIB_FOLDER=./lib/
    else
        LIB_FOLDER=./lib7/
    fi

    if command -v rsync > /dev/null 2>&1 && [[ $KINISI_RSYNC == "true" ]]; then
        rsync -ric --delete "$LIB_FOLDER" "$KINISI_MOUNT_LOCATION/CIRCUITPY/lib"
    else
        rm -rf "$KINISI_MOUNT_LOCATION/CIRCUITPY/lib"
        cp -r "$LIB_FOLDER" "$KINISI_MOUNT_LOCATION/CIRCUITPY/lib"
    fi
    cp safemode.py "$KINISI_MOUNT_LOCATION/CIRCUITPY/"
    cp code.py "$KINISI_MOUNT_LOCATION/CIRCUITPY/"
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
        -a | --all ) IS_ALL=true;;
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

if [[ "$KINISI_WSL" == true ]]; then
    [[ -z "$KINISI_MOUNT_LOCATION" ]] && KINISI_MOUNT_LOCATION="/mnt"
    [[ -z "$KINISI_SERIAL_PORT_PREFIX" ]] && KINISI_SERIAL_PORT_PREFIX="/dev/ttyACM0"
fi

function mount_wsl() {
    if [[ "$KINISI_WSL" == true ]]; then
        if [[ ! -e "$1" ]]; then
            mkdir "$1"
        fi
        sudo mount -t drvfs D: "$1"
    fi
}

echo "Mount location: $KINISI_MOUNT_LOCATION"

if [[ "$IS_BOOTLOADER" == true ]]; then
    ACTIONS=("bootloader")
elif [[ "$IS_RUNTIME" == true ]]; then
    ACTIONS=("runtime")
elif [[ "$IS_ALL" == true ]]; then
    ACTIONS=("bootloader" "runtime" "code")
else
    ACTIONS=("code")
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


