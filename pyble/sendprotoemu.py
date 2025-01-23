#!/usr/bin/env python3
# sendprotoemu.py a simple script to send protobuf packets to a FastAPI endpoint for testing.
"""
Example usage:
  python sendprotoemu.py --n 10 --f 2.0
      => Send 10 packets, at 2 packets per second, then exit.

  python sendprotoemu.py --t 5 --f 3.0
      => Send packets for 5 seconds, at 3 packets per second, then exit.

  python sendprotoemu.py --n 5 --t 10 --f 1
      => Send up to 5 packets, at ~1 packet/sec, stop if 10 seconds pass
         or after sending 5 packets, whichever comes first.
"""

import argparse
import time
import requests

# Import the generated protobuf classes
import sleeve_packet_pb2  # Updated to use sleeve_packet_pb2

def build_packet(sequence_id: int, device_id: str, firmware_version="1.0.0") -> sleeve_packet_pb2.SleevePacket:
    """
    Build a sample SleevePacket with some mock data.
    """
    packet = sleeve_packet_pb2.SleevePacket()
    packet.metadata.device_id = device_id
    packet.metadata.packet_sequence_id = sequence_id
    packet.metadata.firmware_version = firmware_version
    packet.metadata.timestamp_micros = int(time.time() * 1_000_000)  # Current epoch time in microseconds
    packet.metadata.battery_voltage = 3.7

    # Add one reading
    reading = packet.readings.add()
    reading.sequence_id = sequence_id
    reading.timestamp_micros = reading.sequence_id * 1000

    # Add one IMU reading
    imu_data = reading.imu_readings.add()
    imu_data.sensor_id = 42
    imu_data.accelerometer.x = 0.1 * sequence_id
    imu_data.accelerometer.y = 0.2 * sequence_id
    imu_data.accelerometer.z = 0.3 * sequence_id

    return packet

def main():
    parser = argparse.ArgumentParser(description="Send test protobuf packets to a FastAPI endpoint.")
    parser.add_argument("--n", type=int, help="Number of packets to send.")
    parser.add_argument("--t", type=float, help="Time in seconds to run.")
    parser.add_argument("--f", type=float, default=1.0, help="Frequency (packets/sec) to send. Default=1.0.")
    parser.add_argument("--url", type=str, default="http://127.0.0.1:8008/api/v1/packets",
                        help="Endpoint URL to send packets to. Default=http://127.0.0.1:8008/api/v1/packets")
    parser.add_argument("--device-id", type=str, default="my_test_device",
                        help="Device ID to embed in the packet metadata.")
    args = parser.parse_args()

    # Validate that at least one of --n or --t is provided
    if not args.n and not args.t:
        parser.error("You must specify at least one of --n or --t.")

    # Time between packets
    delay = 1.0 / args.f if args.f != 0 else 0

    packets_sent = 0
    start_time = time.time()

    while True:
        # Check if we've met the packet limit (if --n given)
        if args.n and packets_sent >= args.n:
            break

        # Check if we've exceeded the time limit (if --t given)
        elapsed = time.time() - start_time
        if args.t and elapsed >= args.t:
            break

        # Build and send a packet
        packet = build_packet(sequence_id=packets_sent + 1, device_id=args.device_id)
        serialized = packet.SerializeToString()

        try:
            resp = requests.post(
                args.url,
                data=serialized,
                headers={"Content-Type": "application/octet-stream"},
                timeout=5
            )
            if resp.status_code == 200:
                print(f"[{packets_sent+1}] Packet sent OK: {resp.json()}")
            else:
                print(f"[{packets_sent+1}] Error status: {resp.status_code}, response: {resp.text}")
        except Exception as e:
            print(f"[{packets_sent+1}] Failed to send packet: {e}")

        packets_sent += 1

        # Sleep if needed to maintain frequency
        if delay > 0:
            time.sleep(delay)

    print(f"Finished. Total packets sent: {packets_sent}, elapsed time: {time.time() - start_time:.1f}s.")

if __name__ == "__main__":
    main()
