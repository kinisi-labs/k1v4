#!/usr/bin/env python3
"""
k1_ble.py 
K1 BLE Data Logger with aggregator/raw/proto modes,
optional HTTP uploading, and Rich-based "show last packet" console output.
"""

import argparse
import asyncio
import json
import time
import sys
import base64

import requests  # pip install requests
from bleak import BleakScanner, BleakClient
from rich.live import Live
from rich.text import Text

# Import protobuf transformation functions
import sleeve_transform
from sleeve_packet_pb2 import SleevePacket

# --------------------------------------------------------------------
# BLE Configuration
# --------------------------------------------------------------------
DEVICE_NAME_SUBSTRING = "Kinisi"
UART_RX_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"

# Global state
args = None
accumulator = ""
logfile_handle = None
gLastPacket = ""
gLiveView = None

# --------------------------------------------------------------------
# Utilities
# --------------------------------------------------------------------
def round_floats(obj, decimals):
    """
    Recursively round all float values in a nested dict/list to 'decimals' digits.
    Used only in aggregator/proto modes (where we parse JSON).
    """
    if isinstance(obj, float):
        return round(obj, decimals)
    elif isinstance(obj, list):
        return [round_floats(x, decimals) for x in obj]
    elif isinstance(obj, dict):
        return {k: round_floats(v, decimals) for k, v in obj.items()}
    return obj


def extract_records(acc):
    """Extract one or more records from the accumulator using '?>' and '<?' as delimiters."""
    records = []
    while True:
        start_idx = acc.find("?>")
        if start_idx < 0:
            break
        end_idx = acc.find("<?", start_idx + 2)
        if end_idx < 0:
            break
        record_str = acc[start_idx+2:end_idx]
        records.append(record_str)
        acc = acc[end_idx+2:]
    return records, acc


def show_on_console(text_out: str):
    """Print text normally or update the Rich Live view."""
    global gLastPacket
    if args.show_last_packet:
        gLastPacket = text_out
    else:
        print(text_out)


def write_to_logfile(text_out: str):
    """Write to logfile if logging is enabled."""
    if logfile_handle:
        logfile_handle.write(text_out + "\n")
        logfile_handle.flush()


def upload_packet(content: bytes, is_proto: bool):
    """Upload packet data to an HTTP endpoint if set."""
    if not args.upload_url:
        return
    headers = {"Content-Type": "application/octet-stream" if is_proto else "application/json"}
    try:
        requests.post(args.upload_url, data=content, headers=headers, timeout=3.0)
    except Exception as ex:
        show_on_console(f"[UPLOAD ERROR] {ex}")

# --------------------------------------------------------------------
# Packet Handlers (Refactored to Use sleeve_transform)
# --------------------------------------------------------------------
def handle_raw_packet(packet_str: str):
    """Process raw packets and log/upload them."""
    now_ts = time.time()
    entry = {"timestamp": now_ts, "raw_string": packet_str}
    text_out = json.dumps(entry, ensure_ascii=False)

    show_on_console(text_out)
    write_to_logfile(text_out)
    upload_packet(content=text_out.encode("utf-8"), is_proto=False)


def handle_aggregated_packet(record_str: str):
    """Process aggregated JSON records and log/upload them."""
    now_ts = time.time()
    try:
        parsed = json.loads(record_str)
    except json.JSONDecodeError:
        entry = {"timestamp": now_ts, "raw_record": record_str, "parse_error": True}
    else:
        parsed_rounded = round_floats(parsed, args.prec)
        entry = {"timestamp": now_ts, "raw_record": parsed_rounded}

    text_out = json.dumps(entry, ensure_ascii=False)
    show_on_console(text_out)
    write_to_logfile(text_out)
    upload_packet(content=text_out.encode("utf-8"), is_proto=False)


def handle_proto_packet(record_str: str):
    """Process packets in protobuf mode."""
    now_ts = time.time()
    try:
        parsed = json.loads(record_str)
    except json.JSONDecodeError:
        entry = {"timestamp": now_ts, "raw_record": record_str, "parse_error": True}
        text_out = json.dumps(entry, ensure_ascii=False)
        show_on_console(text_out)
        write_to_logfile(text_out)
        upload_packet(content=text_out.encode("utf-8"), is_proto=False)
        return

    parsed_rounded = round_floats(parsed, args.prec)
    data_for_proto = {"timestamp": now_ts, "raw_record": parsed_rounded}

    # Convert to protobuf using sleeve_transform
    packet = sleeve_transform.create_sleeve_packet(data_for_proto, args.device_id)
    proto_bytes = packet.SerializeToString()
    proto_b64 = base64.b64encode(proto_bytes).decode("ascii")

    entry = {"timestamp": now_ts, "raw_record": parsed_rounded, "protobuf_base64": proto_b64}
    text_out = json.dumps(entry, ensure_ascii=False)

    show_on_console(text_out)
    write_to_logfile(text_out)
    upload_packet(content=proto_bytes, is_proto=True)

# --------------------------------------------------------------------
# BLE Notification Callback
# --------------------------------------------------------------------
def notification_handler(_: int, data: bytearray):
    """Callback for handling BLE notifications."""
    global accumulator
    text = data.decode("utf-8", errors="ignore")

    if args.mode == "raw":
        handle_raw_packet(text)
    else:
        accumulator += text
        records, leftover = extract_records(accumulator)
        accumulator = leftover
        for r in records:
            if args.mode == "aggregated":
                handle_aggregated_packet(r)
            elif args.mode == "proto":
                handle_proto_packet(r)

# --------------------------------------------------------------------
# BLE Connection
# --------------------------------------------------------------------
async def scan_for_device(name_substring: str, timeout: int = 5):
    """Scan for BLE devices."""
    print(f"Scanning for BLE devices for up to {timeout} seconds...")
    devices = await BleakScanner.discover(timeout=timeout)
    for d in devices:
        dev_name = d.name or "Unknown"
        if name_substring.lower() in dev_name.lower():
            print(f"Found matching device: {dev_name}, Address: {d.address}")
            return d.address
    return None


async def run_ble_client():
    """Main BLE loop."""
    address = await scan_for_device(DEVICE_NAME_SUBSTRING, timeout=10)
    if not address:
        print("No matching device found. Exiting.")
        return

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

        try:
            await client.start_notify(UART_RX_UUID, notification_handler)
            print("Subscribed to notifications...")
        except Exception as e:
            print(f"Failed to start notify, error: {e}")
            return

        print("Press Ctrl+C to stop.")

        if args.show_last_packet:
            with Live(auto_refresh=False, transient=False) as live:
                while True:
                    live.update(Text(gLastPacket))
                    live.refresh()
                    await asyncio.sleep(0.5)
        else:
            while True:
                await asyncio.sleep(1.0)

# --------------------------------------------------------------------
# Entry Point
# --------------------------------------------------------------------
def main():
    """Parse CLI args and start BLE loop."""
    parser = argparse.ArgumentParser(description="K1 BLE Data Logger")
    parser.add_argument("--prec", type=int, default=6, help="Float precision")
    parser.add_argument("--logfile", type=str, default=None, help="Log file")
    parser.add_argument("--mode", choices=["raw", "aggregated", "proto"], default="aggregated")
    parser.add_argument("--show-last-packet", action="store_true")
    parser.add_argument("--upload-url", type=str, default=None)
    parser.add_argument("--device-id", type=str, default="K1_DEVICE")

    global args
    args = parser.parse_args()

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
