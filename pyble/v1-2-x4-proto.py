import time

# convert v1 sleeve packet (BLE/JSON) to x4 protobuf
"""
data = {
    "timestamp": 1737004733.6140008,
    "raw_record": {
        "i": 1269395,
        "t_s": 31747426,
        "g1": [0.015, 0.003, 0.001],
        "a1": [-1.863, -1.642, -9.347],
        "m1": [49.5, -23.1, -11.55],
        "g0": [0.079, -0.097, -0.055],
        "a0": [1.46, -7.473, -5.999],
        "m0": [-15.273, -9.091, 23.122],
        "sn": 5.652,
        "tch": True
    }
}

device_id = "DEVICE_1234"
packet = create_sleeve_packet(data, device_id)
# Now `packet` is a SleevePacket protobuf message populated with the data.

"""

# Import the generated protobuf classes. Adjust the import according to your generated module name.
from sleeve_pb2 import (
    SleevePacket, PacketMetadata, SensorsReading, IMUData, Vector3D,
    Quaternion, AudioData, SensorDescription, SensorType, SensorLocation,
    LegSegment, SegmentPosition, SoundFormat
)

def create_sleeve_packet(data: dict, device_id: str) -> SleevePacket:
    # Read the computer's current time in microseconds
    current_time_micros = int(time.time() * 1_000_000)
    raw = data["raw_record"]

    # Initialize the root packet
    packet = SleevePacket()

    # Fill in metadata
    metadata = PacketMetadata()
    metadata.device_id = device_id
    metadata.packet_sequence_id = raw["i"]
    metadata.firmware_version = "1.0"         # Example firmware version
    metadata.timestamp_micros = current_time_micros
    metadata.battery_voltage = 0.0            # Set a default or actual voltage if available

    # Define sensor descriptions for thigh and calf IMUs
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

    # Assign metadata to the packet
    packet.metadata.CopyFrom(metadata)

    # Create a sensor reading
    reading = SensorsReading()
    reading.sequence_id = raw["i"]
    reading.timestamp_micros = raw["t_s"]

    # Construct IMUData for thigh sensor
    imu_thigh = IMUData()
    imu_thigh.sensor_id = 0
    imu_thigh.accelerometer.x, imu_thigh.accelerometer.y, imu_thigh.accelerometer.z = raw["a0"]
    imu_thigh.gyroscope.x, imu_thigh.gyroscope.y, imu_thigh.gyroscope.z = raw["g0"]
    imu_thigh.magnetometer.x, imu_thigh.magnetometer.y, imu_thigh.magnetometer.z = raw["m0"]
    # Set default orientation (identity quaternion)
    imu_thigh.orientation.w = 1.0
    imu_thigh.orientation.x = 0.0
    imu_thigh.orientation.y = 0.0
    imu_thigh.orientation.z = 0.0

    # Construct IMUData for calf sensor
    imu_calf = IMUData()
    imu_calf.sensor_id = 1
    imu_calf.accelerometer.x, imu_calf.accelerometer.y, imu_calf.accelerometer.z = raw["a1"]
    imu_calf.gyroscope.x, imu_calf.gyroscope.y, imu_calf.gyroscope.z = raw["g1"]
    imu_calf.magnetometer.x, imu_calf.magnetometer.y, imu_calf.magnetometer.z = raw["m1"]
    # Set default orientation (identity quaternion)
    imu_calf.orientation.w = 1.0
    imu_calf.orientation.x = 0.0
    imu_calf.orientation.y = 0.0
    imu_calf.orientation.z = 0.0

    # Add IMU readings to the SensorsReading
    reading.imu_readings.extend([imu_thigh, imu_calf])

    # Populate a default AudioData (empty), since no audio data is provided in the input
    audio_data = AudioData()
    audio_data.format = SoundFormat.RAW
    audio_data.samples = b""
    audio_data.average_magnitude = 0.0
    audio_data.total_energy = 0.0
    audio_data.sensor_id = 2  # Arbitrary sensor ID for audio
    reading.audio_data.CopyFrom(audio_data)

    # Add the reading to the packet
    packet.readings.append(reading)

    return packet


