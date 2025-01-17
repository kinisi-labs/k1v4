import time
from sleeve_packet_pb2 import (
    SleevePacket, PacketMetadata, SensorsReading, IMUData, Vector3D,
    Quaternion, AudioData, SensorDescription, SensorType, SensorLocation,
    LegSegment, SegmentPosition, SoundFormat
)

def create_sleeve_packet(data: dict, device_id: str) -> SleevePacket:
    """
    Convert the original JSON-like dictionary and device ID into a SleevePacket protobuf.
    """
    current_time_micros = int(time.time() * 1_000_000)
    raw = data["raw_record"]

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
    imu_calf.orientation.w = 1.0
    imu_calf.orientation.x = 0.0
    imu_calf.orientation.y = 0.0
    imu_calf.orientation.z = 0.0

    reading.imu_readings.extend([imu_thigh, imu_calf])

    # Populate AudioData. Here we assume no actual audio samples are provided,
    # but the structure is filled as per the proto definition.
    audio_data = AudioData()
    audio_data.format = SoundFormat.RAW
    audio_data.samples = b""  # No actual audio samples in input
    audio_data.average_magnitude = 0.0
    audio_data.total_energy = 0.0
    audio_data.sensor_id = 2  # Arbitrary sensor ID for audio
    reading.audio_data.CopyFrom(audio_data)

    packet.readings.append(reading)
    return packet

def protobuf_to_json(packet: SleevePacket) -> dict:
    """
    Convert a SleevePacket protobuf message back into the original JSON-like dictionary format.
    """
    if not packet.readings:
        raise ValueError("Packet has no sensor readings.")

    reading = packet.readings[0]

    raw_record = {
        "i": reading.sequence_id,
        "t_s": reading.timestamp_micros
    }

    thigh_data = None
    calf_data = None

    for imu in reading.imu_readings:
        if imu.sensor_id == 0:
            thigh_data = imu
        elif imu.sensor_id == 1:
            calf_data = imu

    if thigh_data:
        raw_record["a0"] = [thigh_data.accelerometer.x, thigh_data.accelerometer.y, thigh_data.accelerometer.z]
        raw_record["g0"] = [thigh_data.gyroscope.x, thigh_data.gyroscope.y, thigh_data.gyroscope.z]
        raw_record["m0"] = [thigh_data.magnetometer.x, thigh_data.magnetometer.y, thigh_data.magnetometer.z]

    if calf_data:
        raw_record["a1"] = [calf_data.accelerometer.x, calf_data.accelerometer.y, calf_data.accelerometer.z]
        raw_record["g1"] = [calf_data.gyroscope.x, calf_data.gyroscope.y, calf_data.gyroscope.z]
        raw_record["m1"] = [calf_data.magnetometer.x, calf_data.magnetometer.y, calf_data.magnetometer.z]

    # Extract audio_data if available.
    if reading.HasField("audio_data"):
        ad = reading.audio_data
        raw_record["audio_data"] = {
            "format": ad.format,
            "samples": list(ad.samples),  # Represent bytes as list of ints
            "average_magnitude": ad.average_magnitude,
            "total_energy": ad.total_energy,
            "sensor_id": ad.sensor_id
        }

    result = {
        "timestamp": packet.metadata.timestamp_micros / 1e6 if packet.metadata.timestamp_micros else None,
        "raw_record": raw_record
    }

    return result
