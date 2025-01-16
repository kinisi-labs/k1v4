#!/usr/bin/env python3
"""
K1 BLE Data Logger with aggregator/raw/proto modes,
optional HTTP uploading, and Rich-based "show last packet" console output.

Changes:
  - Uses rich.Live to manage overwriting console output when --show-last-packet is set.

Requires:
  - bleak (pip install bleak)
  - requests (pip install requests)
  - protobuf (for .proto usage)
  - rich (for the non-scrolling console display)
  - sleeve_packet_pb2.py (your generated protobuf module)

Example:
  python k1_ble.py --mode proto --show-last-packet
"""

import argparse
import asyncio
import json
import time
import sys
import base64

import requests  # pip install requests
from bleak import BleakScanner, BleakClient

# ----- Protobuf Imports (note we use sleeve_packet_pb2) -----
try:
    from sleeve_packet_pb2 import (
        SleevePacket, PacketMetadata, SensorsReading, IMUData,
        Vector3D, Quaternion, AudioData, SensorDescription,
        SensorType, SensorLocation, LegSegment, SegmentPosition, SoundFormat
    )
except ImportError:
    print("Warning: Could not import sleeve_packet_pb2. Proto mode will fail.")
    SleevePacket = None

# For live console output
from rich.live import Live
from rich.text import Text

# --------------------------------------------------------------------
# BLE Configuration: Adjust for your device
# --------------------------------------------------------------------
DEVICE_NAME_SUBSTRING = "Kinisi"
UART_RX_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"  # Nordic UART RX (Notify)

# --------------------------------------------------------------------
# Global state
# --------------------------------------------------------------------
args = None               # Parsed command-line args
accumulator = ""          # Used in aggregator/proto modes
logfile_handle = None     # File handle for output logging
gLastPacket = ""          # The last packet text displayed (for Rich Live update)
gLiveView = None          # The Rich Live object (active only if --show-last-packet)


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


def show_on_console(text_out: str):
    """
    Print text to the console in two possible modes:
      1) Normal scrolling if --show-last-packet is NOT set
      2) Use the Rich Live object if --show-last-packet is set, overwriting old content
         with the new text.
    """
    global gLastPacket
    if args.show_last_packet:
        # We'll just store the text. The live loop updates the display once a second
        # (or however often).
        gLastPacket = text_out
    else:
        print(text_out)


def write_to_logfile(text_out: str):
    """
    Write a line to the logfile if open.
    """
    if logfile_handle:
        logfile_handle.write(text_out + "\n")
        logfile_handle.flush()


def upload_packet(content: bytes, is_proto: bool):
    """
    If --upload-url is set, POST the given data to that URL.
      - If is_proto=True, use 'application/octet-stream'
      - Else, use 'application/json'
    """
    if not args.upload_url:
        return  # no upload

    headers = {}
    headers["Content-Type"] = "application/octet-stream" if is_proto else "application/json"

    try:
        requests.post(args.upload_url, data=content, headers=headers, timeout=3.0)
    except Exception as ex:
        # Show the error on console in normal mode, or in last packet if desired
        show_on_console(f"[UPLOAD ERROR] {ex}")


# --------------------------------------------------------------------
# Protobuf conversion
# --------------------------------------------------------------------
def create_sleeve_packet(data: dict, device_id: str) -> SleevePacket:
    """
    Convert the "aggregated" JSON record into a SleevePacket protobuf.
    """
    if SleevePacket is None:
        raise ImportError("sleeve_packet_pb2 not imported successfully.")

    raw = data["raw_record"]

    packet = SleevePacket()

    # 1) Fill metadata
    metadata = PacketMetadata()
    metadata.device_id = device_id
    metadata.packet_sequence_id = raw.get("i", 0)
    metadata.firmware_version = "1.0"
    metadata.timestamp_micros = int(time.time() * 1_000_000)
    metadata.battery_voltage = 0.0

    # 2) Sensor descriptions
    desc_thigh = SensorDescription()
    desc_thigh.type = SensorType.IMU
    desc_thigh.location.segment = LegSegment.THIGH
    desc_thigh.location.position = SegmentPosition.CENTER
    desc_thigh.id = 0
    metadata.sensor_descriptions.append(desc_thigh)

    desc_calf = SensorDescription()
    desc_calf.type = SensorType.IMU
    desc_calf.location.segment = LegSegment.CALF
    desc_calf.location.position = SegmentPosition.CENTER
    desc_calf.id = 1
    metadata.sensor_descriptions.append(desc_calf)

    packet.metadata.CopyFrom(metadata)

    # 3) Make a SensorsReading
    reading = SensorsReading()
    reading.sequence_id = raw.get("i", 0)
    reading.timestamp_micros = raw.get("t_s", 0)

    # IMUData for thigh sensor
    imu_thigh = IMUData()
    imu_thigh.sensor_id = 0
    imu_thigh.accelerometer.x, imu_thigh.accelerometer.y, imu_thigh.accelerometer.z = raw.get("a0", [0, 0, 0])
    imu_thigh.gyroscope.x, imu_thigh.gyroscope.y, imu_thigh.gyroscope.z = raw.get("g0", [0, 0, 0])
    imu_thigh.magnetometer.x, imu_thigh.magnetometer.y, imu_thigh.magnetometer.z = raw.get("m0", [0, 0, 0])
    imu_thigh.orientation.w = 1.0
    imu_thigh.orientation.x = 0.0
    imu_thigh.orientation.y = 0.0
    imu_thigh.orientation.z = 0.0

    # IMUData for calf sensor
    imu_calf = IMUData()
    imu_calf.sensor_id = 1
    imu_calf.accelerometer.x, imu_calf.accelerometer.y, imu_calf.accelerometer.z = raw.get("a1", [0, 0, 0])
    imu_calf.gyroscope.x, imu_calf.gyroscope.y, imu_calf.gyroscope.z = raw.get("g1", [0, 0, 0])
    imu_calf.magnetometer.x, imu_calf.magnetometer.y, imu_calf.magnetometer.z = raw.get("m1", [0, 0, 0])
    imu_calf.orientation.w = 1.0
    imu_calf.orientation.x = 0.0
    imu_calf.orientation.y = 0.0
    imu_calf.orientation.z = 0.0

    # Add IMU readings
    reading.imu_readings.extend([imu_thigh, imu_calf])

    # 4) Add empty AudioData
    audio_data = AudioData()
    audio_data.format = SoundFormat.RAW
    audio_data.samples = b""
    audio_data.average_magnitude = 0.0
    audio_data.total_energy = 0.0
    audio_data.sensor_id = 2
    reading.audio_data.CopyFrom(audio_data)

    # 5) Add the reading to the packet
    packet.readings.append(reading)

    return packet


# --------------------------------------------------------------------
# Packet Handlers
# --------------------------------------------------------------------
def handle_raw_packet(packet_str: str):
    """
    'raw' mode: each BLE notification chunk is just saved as JSON line.
    """
    now_ts = time.time()
    entry = {
        "timestamp": now_ts,
        "raw_string": packet_str
    }
    text_out = json.dumps(entry, ensure_ascii=False)

    show_on_console(text_out)
    write_to_logfile(text_out)
    upload_packet(content=text_out.encode("utf-8"), is_proto=False)


def handle_aggregated_packet(record_str: str):
    """
    'aggregated' mode: parse JSON, round floats, store as JSON line.
    """
    now_ts = time.time()
    try:
        parsed = json.loads(record_str)
    except json.JSONDecodeError:
        entry = {
            "timestamp": now_ts,
            "raw_record": record_str,
            "parse_error": True
        }
    else:
        parsed_rounded = round_floats(parsed, args.prec)
        entry = {
            "timestamp": now_ts,
            "raw_record": parsed_rounded
        }

    text_out = json.dumps(entry, ensure_ascii=False)
    show_on_console(text_out)
    write_to_logfile(text_out)
    upload_packet(content=text_out.encode("utf-8"), is_proto=False)


def handle_proto_packet(record_str: str):
    """
    'proto' mode: same aggregator parse, then convert to protobuf,
    log the base64-encoded binary, and optionally upload the raw binary.
    """
    now_ts = time.time()
    try:
        parsed = json.loads(record_str)
    except json.JSONDecodeError:
        entry = {
            "timestamp": now_ts,
            "raw_record": record_str,
            "parse_error": True
        }
        text_out = json.dumps(entry, ensure_ascii=False)
        show_on_console(text_out)
        write_to_logfile(text_out)
        upload_packet(content=text_out.encode("utf-8"), is_proto=False)
        return

    # Round floats
    parsed_rounded = round_floats(parsed, args.prec)
    data_for_proto = {
        "timestamp": now_ts,
        "raw_record": parsed_rounded
    }

    # Build the protobuf
    packet = create_sleeve_packet(data_for_proto, args.device_id)
    proto_bytes = packet.SerializeToString()

    proto_b64 = base64.b64encode(proto_bytes).decode("ascii")
    entry = {
        "timestamp": now_ts,
        "raw_record": parsed_rounded,
        "protobuf_base64": proto_b64
    }
    text_out = json.dumps(entry, ensure_ascii=False)

    show_on_console(text_out)
    write_to_logfile(text_out)

    # Upload binary
    upload_packet(content=proto_bytes, is_proto=True)


# --------------------------------------------------------------------
# BLE Notification Callback
# --------------------------------------------------------------------
def notification_handler(_: int, data: bytearray):
    """
    Callback for incoming BLE notifications.
    Behavior depends on --mode: 'raw', 'aggregated', or 'proto'.
    """
    global accumulator
    text = data.decode("utf-8", errors="ignore")

    if args.mode == "raw":
        handle_raw_packet(text)
    elif args.mode == "aggregated":
        accumulator += text
        records, leftover = extract_records(accumulator)
        accumulator = leftover
        for r in records:
            handle_aggregated_packet(r)
    elif args.mode == "proto":
        accumulator += text
        records, leftover = extract_records(accumulator)
        accumulator = leftover
        for r in records:
            handle_proto_packet(r)


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
    Main runner: connect to device, subscribe to notifications, and handle data.
    Also handles updating the Rich Live view with the last packet, if needed.
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

        if gLiveView is not None:
            # If the user already started a Rich Live outside, we can just update it,
            # but here we'll manage it below.
            pass

        # Use a while loop to keep the connection open; update the Rich view if needed
        if args.show_last_packet:
            # We'll run inside Rich's Live context:
            with Live(auto_refresh=False, transient=False) as live:
                while True:
                    # Update the live view with our last packet text
                    live.update(Text(gLastPacket))
                    live.refresh()
                    await asyncio.sleep(0.5)
        else:
            # Normal mode
            while True:
                await asyncio.sleep(1.0)


# --------------------------------------------------------------------
# Entry Point
# --------------------------------------------------------------------
def main():
    """
    Parse CLI args, then run the asyncio loop.
    """
    parser = argparse.ArgumentParser(
        description="K1 BLE Data Logger (raw/aggregated/proto) with optional HTTP upload + Rich live display."
    )
    parser.add_argument("--prec", type=int, default=6,
                        help="Precision (number of digits) to round floats in aggregator/proto mode. Default=6.")
    parser.add_argument("--logfile", type=str, default=None,
                        help="Output filename (JSON lines). If omitted, uses last 6 of device address + '.jsonl'.")
    parser.add_argument("--mode", choices=["raw", "aggregated", "proto"], default="aggregated",
                        help="Set 'raw' for direct logging of each BLE notification, 'aggregated' for ?>...<? reassembly, or 'proto' for protobuf serialization. Default=aggregated.")
    parser.add_argument("--show-last-packet", action="store_true",
                        help="Overwrite the console with only the last packet (non-scrolling). Uses Rich library.")
    parser.add_argument("--upload-url", type=str, default=None,
                        help="If set, each packet is also uploaded via HTTP POST to this URL.")
    parser.add_argument("--device-id", type=str, default="K1_DEVICE",
                        help="Device ID to embed in the protobuf metadata (proto mode). Default=K1_DEVICE.")

    global args
    args = parser.parse_args()

    print(f"Mode: {args.mode}")
    print(f"Float precision: {args.prec} digits (only in aggregated/proto).")
    if args.upload_url:
        print(f"HTTP Upload enabled, URL = {args.upload_url}")
    if args.show_last_packet:
        print("Will display only the last packet in the console (using Rich).")

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
