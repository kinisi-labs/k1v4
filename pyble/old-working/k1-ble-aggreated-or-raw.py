#!/usr/bin/env python3
"""
K1 BLE Data Logger

Author:   Manu
Date:     2025-01-15
Requires: bleak (pip install bleak)

Usage Examples:
  python k1_ble.py
    - Connects to a 'Kinisi' BLE device,
    - Uses aggregator mode by default,
    - Rounds floats to 6 digits,
    - Writes JSON lines to a file named [Last 6 Of BLE Address].jsonl,
    - Prints records to console in normal scrolling mode.

  python k1_ble.py --mode raw --prec 4 --logfile my_data.jsonl
    - Connect in raw mode (no record aggregation),
    - Round floats to 4 digits (in aggregator mode, has no effect in raw mode),
    - Write output to my_data.jsonl.

  python k1_ble.py --show-last-packet
    - Continuously overwrite the same console line with the last record,
      instead of scrolling.
"""

import argparse
import asyncio
import json
import time
from bleak import BleakScanner, BleakClient

# --------------------------------------------------------------------
# Configuration: Adjust these for your device
# --------------------------------------------------------------------
DEVICE_NAME_SUBSTRING = "Kinisi"
UART_RX_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"  # Nordic UART RX (Notify)

# --------------------------------------------------------------------
# Global state
# --------------------------------------------------------------------
args = None             # Parsed command-line args
accumulator = ""        # Used only in aggregator mode
logfile_handle = None   # File handle for output logging


# --------------------------------------------------------------------
# Utilities
# --------------------------------------------------------------------
def round_floats(obj, decimals):
    """
    Recursively round all float values in a nested dict/list to 'decimals' digits.
    Only used in aggregator mode, where we parse JSON.
    """
    if isinstance(obj, float):
        return round(obj, decimals)
    elif isinstance(obj, list):
        return [round_floats(x, decimals) for x in obj]
    elif isinstance(obj, dict):
        return {k: round_floats(v, decimals) for k, v in obj.items()}
    return obj

def extract_records(acc):
    """
    Extract one or more records from the accumulator, where each record is
    delimited by '?>' (start) and '<?' (end).
    
    Returns: (list_of_record_strings, leftover_buffer)
      - list_of_record_strings: All the fully assembled record bodies
      - leftover_buffer: Whatever remains after extracting the records
    """
    records = []
    while True:
        start_idx = acc.find("?>")
        if start_idx < 0:
            break
        end_idx = acc.find("<?", start_idx + 2)
        if end_idx < 0:
            break

        # The record is between ?> and <?
        record_str = acc[start_idx+2:end_idx]
        records.append(record_str)

        # Remove everything up to and including '<?' from the accumulator
        acc = acc[end_idx+2:]
    return records, acc

def log_and_print(text_out: str):
    """
    Print text to console, optionally overwriting the last line if --show-last-packet
    is set, and also write to the logfile if open.
    """
    if args.show_last_packet:
        # Overwrite the same line in console
        print(f"\r{text_out}", end='', flush=True)
    else:
        print(text_out)

    if logfile_handle:
        logfile_handle.write(text_out + "\n")
        logfile_handle.flush()

def handle_aggregated_packet(record_str: str):
    """
    Given the raw JSON chunk from '?> ... <?', parse it, round floats,
    then write to log in JSON-lines format.
    """
    now_ts = time.time()

    # Attempt to parse as JSON
    try:
        parsed = json.loads(record_str)
    except json.JSONDecodeError:
        # If parse fails, store the raw string but note error
        entry = {
            "timestamp": now_ts,
            "raw_record": record_str,
            "parse_error": True
        }
    else:
        # If parsed successfully, round floats
        parsed_rounded = round_floats(parsed, args.prec)
        entry = {
            "timestamp": now_ts,
            "raw_record": parsed_rounded
        }

    text_out = json.dumps(entry, ensure_ascii=False)
    log_and_print(text_out)

def handle_raw_packet(packet_str: str):
    """
    In 'raw' mode, we do not aggregate or parse JSON. We simply store each
    notification as-is.
    """
    now_ts = time.time()
    entry = {
        "timestamp": now_ts,
        "raw_string": packet_str
    }
    text_out = json.dumps(entry, ensure_ascii=False)
    log_and_print(text_out)

# --------------------------------------------------------------------
# BLE Notification Handlers
# --------------------------------------------------------------------
def notification_handler(_: int, data: bytearray):
    """
    Callback for incoming BLE notifications.
    Behavior depends on --mode: 'raw' vs. 'aggregated'.
    """
    global accumulator
    text = data.decode("utf-8", errors="ignore")

    if args.mode == "raw":
        # Treat each notification chunk as its own record
        handle_raw_packet(text)
    else:
        # Aggregator mode: accumulate partial messages & parse them
        accumulator += text
        records, leftover = extract_records(accumulator)
        accumulator = leftover
        for r in records:
            handle_aggregated_packet(r)


# --------------------------------------------------------------------
# BLE Connection/Scan/Loop
# --------------------------------------------------------------------
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
    Main runner: connect to device, subscribe to notifications, and log data.
    """
    # 1) Scan
    address = await scan_for_device(DEVICE_NAME_SUBSTRING, timeout=10)
    if not address:
        print("No matching device found. Exiting.")
        return

    # If user didn't specify a logfile, create one from last 6 chars of address
    global logfile_handle
    if not args.logfile:
        short_id = "".join(c for c in address if c.isalnum())[-6:]
        default_fname = f"{short_id}.jsonl"
        print(f"No logfile specified, using: {default_fname}")
        logfile_handle = open(default_fname, "a", encoding="utf-8")
    else:
        logfile_handle = open(args.logfile, "a", encoding="utf-8")

    print(f"Attempting to connect to {address}...")
    async with BleakClient(address) as client:
        if not client.is_connected:
            print("Failed to connect. Exiting.")
            return
        print("Connected to BLE device!")

        # 2) Subscribe
        try:
            await client.start_notify(UART_RX_UUID, notification_handler)
            print("Subscribed to notifications...")
        except Exception as e:
            print(f"Failed to start notify on {UART_RX_UUID}, error: {e}")
            return

        # 3) Keep the script running
        print("Press Ctrl+C to stop.")
        while True:
            await asyncio.sleep(1.0)

def main():
    """
    Parse CLI args, then run the asyncio loop.
    """
    parser = argparse.ArgumentParser(
        description="K1 BLE Data Logger with aggregator/raw modes."
    )
    parser.add_argument("--prec", type=int, default=6,
                        help="Precision (number of digits) to round floats in aggregator mode. Default=6.")
    parser.add_argument("--logfile", type=str, default=None,
                        help="Output filename (JSON lines). If omitted, uses last 6 of device address + '.jsonl'.")
    parser.add_argument("--mode", choices=["aggregated", "raw"], default="aggregated",
                        help="Set 'raw' for direct logging of each BLE notification, or 'aggregated' for ?>...<? reassembly. Default=aggregated.")
    parser.add_argument("--show-last-packet", action="store_true",
                        help="If set, the console output overwrites the last line instead of scrolling.")
    global args
    args = parser.parse_args()

    print(f"Mode: {args.mode}")
    print(f"Float precision: {args.prec} digits (aggregator mode only).")
    if args.show_last_packet:
        print("Will show only the last packet in the console output.")
    try:
        asyncio.run(run_ble_client())
    except KeyboardInterrupt:
        print("\nUser interrupted, closing...")
    finally:
        if logfile_handle:
            logfile_handle.close()
        print("Done.")

if __name__ == "__main__":
    main()
