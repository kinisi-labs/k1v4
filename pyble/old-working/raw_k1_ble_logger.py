#!/usr/bin/env python3
"""
Example: K1 BLE Data Logger

Author:  manu
Date:    2025-01-15

Description:
  This script scans for BLE devices whose name contains 'Kinisi' (or whatever
  your device advertises itself as). Once found, it connects, subscribes
  to the "UART RX" characteristic (or whichever handle/UUID your device uses),
  and starts printing incoming data to console. You can also enable file
  logging to store the data for offline analysis.
"""

import asyncio
import json
import time
import sys
from bleak import BleakScanner, BleakClient

# ------------------------------------------------------------------------------
# Adjust these to match your device’s advertised name and characteristic UUIDs.
# For a Nordic UART Service (NUS)-like device, the standard:
#    NUS RX UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e" (notify)
#    NUS TX UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e" (write)
#
# But you should confirm with the device vendor or from nRFConnect app.
# ------------------------------------------------------------------------------
DEVICE_NAME_SUBSTRING = "Kinisi"   # or "K1X" or "K1" etc.
UART_RX_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"


# ------------------------------------------------------------------------------
# User Configurations
# ------------------------------------------------------------------------------
LOG_TO_FILE = True
LOGFILE_NAME = "k1_ble_log.jsonl"  # or "k1_ble_log.csv" etc.

# ------------------------------------------------------------------------------
# Global variables (for demonstration)
# ------------------------------------------------------------------------------
logfile_handle = None


def notification_handler(_: int, data: bytearray):
    """
    Handle incoming BLE notifications.

    Args:
        _ (int): Characteristic handle or ID. 
        data (bytearray): The raw bytes from the BLE device.
    """
    # Convert bytes to string; handle JSON or any protocol your device uses
    text = data.decode("utf-8", errors="ignore").strip()

    # Simple: just print it to console
    print(f"[NOTIFICATION] {text}")

    # Optionally log to file:
    if LOG_TO_FILE and logfile_handle:
        # If your device is sending JSON, you can directly store it,
        # or store as raw lines. 
        # Here we do a JSON-line approach:
        now_ts = time.time()
        record = {
            "timestamp": now_ts,
            "raw": text
        }
        logfile_handle.write(json.dumps(record) + "\n")
        logfile_handle.flush()


async def scan_for_device(name_substring: str, timeout: int = 5):
    """
    Scan for BLE devices and return the address of the first device
    whose name contains 'name_substring'.
    """
    print(f"Scanning for BLE devices for up to {timeout} seconds...")
    devices = await BleakScanner.discover(timeout=timeout)
    for d in devices:
        dev_name = d.name or "Unknown"
        if name_substring.lower() in dev_name.lower():
            print(f"Found matching device: {dev_name}, RSSI: {d.rssi}, Address: {d.address}")
            return d.address
    return None


async def run_ble_client():
    """
    Main runner for connecting to the K1 sleeve (or similar BLE device),
    subscribing to notifications, and streaming/logging data.
    """
    # 1) Scan for the device
    address = await scan_for_device(DEVICE_NAME_SUBSTRING, timeout=10)
    if not address:
        print("No matching device found. Exiting.")
        return

    print(f"Attempting to connect to {address} ...")

    # 2) Connect and subscribe
    async with BleakClient(address) as client:
        if not client.is_connected:
            print("Failed to connect. Exiting.")
            return
        print("Connected!")

        # Subscribe to the indicated characteristic
        try:
            await client.start_notify(UART_RX_UUID, notification_handler)
            print("Subscribed to notifications...")
        except Exception as e:
            print(f"Failed to start notify on {UART_RX_UUID}, error: {e}")
            return

        # Keep the script running to receive notifications
        print("Press Ctrl+C to stop.")
        while True:
            # If you want to write commands, you can do so as well:
            #   await client.write_gatt_char(UART_TX_UUID, b"some command")
            await asyncio.sleep(1.0)


def main():
    """
    Synchronous entry point. Sets up logging if desired,
    then starts the async BLE loop.
    """
    global logfile_handle

    # Open a file for logging, if enabled
    if LOG_TO_FILE:
        logfile_handle = open(LOGFILE_NAME, "a", encoding="utf-8")
        print(f"Logging data to {LOGFILE_NAME}...")

    # Run the asyncio event loop
    try:
        asyncio.run(run_ble_client())
    except KeyboardInterrupt:
        print("\nUser interrupted, closing...")
    finally:
        # Clean up
        if logfile_handle:
            logfile_handle.close()
        print("Done.")


if __name__ == "__main__":
    main()
