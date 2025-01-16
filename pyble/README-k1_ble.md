# K1 BLE Logger

A Python-based command-line utility that connects to a “Kinisi K1” (or similar) BLE device, parses sensor data, and saves or uploads the results in various formats including to X4 protobuf.

---

### 1. Installation

1. **Clone or download** this repository.  
2. **Install Python 3.8+** (earlier versions might work, but 3.8+ is recommended).  
3. **Install dependencies**:

   ```bash
   pip install -r requirements.txt
   ```

   This installs:

   - **bleak** (for BLE scanning & connections)  
   - **requests** (for optional HTTP uploads)  
   - **protobuf** (for parsing/generating `.proto` messages)

---

### 2. Generating `sleeve_pb2.py`

If you want to use the **protobuf** mode (`--mode proto`), you need a generated Python module (e.g., `sleeve_pb2.py`) corresponding to your `.proto` schema.  

1. Make sure you have **protoc** (the Protocol Buffers compiler) installed.  
2. Compile your `.proto` file to a Python module. For example:  
   ```bash
   protoc --python_out=. sleeve_packet.proto
   ```
3. This creates `sleeve_pb2.py` in your current directory. The K1 BLE logger imports from that file.

---

### 3. Running the Logger

The main script is **`k1_ble.py`**. Here are some common usage examples:

1. **Default (aggregated)**:
   ```bash
   python k1_ble.py
   ```
   - Scans for a BLE device whose name contains `"Kinisi"`.
   - Subscribes to the Nordic UART characteristic.
   - Accumulates partial data blocks delimited by `?>...<?`.
   - Rounds floats to 6 digits (default).
   - Logs each record to `[last6ofBLEaddress].jsonl`.
   - Prints each record to the console.

2. **Raw mode**:
   ```bash
   python k1_ble.py --mode raw
   ```
   - Each BLE notification is logged as-is (no aggregator).
   - If the device is splitting records across multiple notifications, you’ll see them as partial chunks.

3. **Protobuf mode**:
   ```bash
   python k1_ble.py --mode proto --device-id DEVICE_1234
   ```
   - Aggregates partial data into a complete JSON record, then converts it into a `SleevePacket` protobuf message.
   - Logs the base64-encoded protobuf to the console and JSONL file.
   - Requires that `sleeve_pb2.py` is present in your Python path.

4. **Show last packet only**:
   ```bash
   python k1_ble.py --show-last-packet
   ```
   - Overwrites the console line for each new packet instead of scrolling.

5. **HTTP upload**:
   ```bash
   python k1_ble.py --upload-url http://localhost:8080/post
   ```
   - Each packet is also POSTed to the specified URL.
   - Raw/Aggregated: sends JSON with `Content-Type: application/json`.
   - Proto mode: sends binary protobuf data with `Content-Type: application/octet-stream`.

Other arguments:
```
usage: k1_ble.py [-h] [--prec PREC] [--logfile LOGFILE]
                 [--mode {raw,aggregated,proto}] [--show-last-packet]
                 [--upload-url UPLOAD_URL] [--device-id DEVICE_ID]

K1 BLE Data Logger (raw/aggregated/proto) with optional HTTP upload.

options:
  -h, --help            show this help message and exit
  --prec PREC           Precision (number of digits) to round floats in
                        aggregator/proto mode. Default=6.
  --logfile LOGFILE     Output filename (JSON lines). If omitted, uses last 6
                        of device address + '.jsonl'.
  --mode {raw,aggregated,proto}
                        Set 'raw' for direct logging of each BLE
                        notification, 'aggregated' for ?>...<? reassembly, or
                        'proto' for protobuf serialization.
                        Default=aggregated.
  --show-last-packet    If set, overwrite the same console line
                        (non-scrolling) with each new packet.
  --upload-url UPLOAD_URL
                        If set, each packet is also uploaded via HTTP POST to
                        this URL.
  --device-id DEVICE_ID
                        Device ID to embed in the protobuf metadata (proto
                        mode). Default=K1_DEVICE.
```

---

### 4. Data Formats

#### V1 JSON Format (Raw or Aggregated)
- **Raw Mode**: Each BLE notification chunk arrives as a partial or full JSON snippet. The script wraps each chunk in a JSON line:
  ```json
  {
    "timestamp": 1737004733.6140008,
    "raw_string": "<? partial json data..."
  }
  ```
- **Aggregated Mode**: The script looks for `?>` and `<?` delimiters. It concatenates all chunks in between to form a **complete** JSON record. That record is then placed in a line like:
  ```json
  {
    "timestamp": 1737004733.6140008,
    "raw_record": {
      "i": 1269395,
      "t_s": 31747426,
      "g1": [...],
      "a1": [...],
      ...
    }
  }
  ```
- In aggregated mode, numeric fields are rounded to `--prec` digits by default.

#### Protobuf Format
- **Proto Mode** uses the aggregated JSON to build a `SleevePacket` message defined in `sleeve.proto`.  
- The packet includes metadata (device ID, firmware version, etc.) plus two IMU readings (thigh and calf), plus an empty audio reading.  
- The script logs a single JSON line containing:
  ```json
  {
    "timestamp": 1737004733.6140008,
    "raw_record": { ... original JSON, rounded ... },
    "protobuf_base64": "ABCDEFG...."
  }
  ```
- If `--upload-url` is used, the binary protobuf is also uploaded to the URL with `Content-Type: application/octet-stream`.

---

### 5. Implementation Details

- **BLE Connection**: Provided by the [Bleak](https://pypi.org/project/bleak/) library.  
- **URL Upload**: Done via [Requests](https://pypi.org/project/requests/).  
- **Protobuf**: Requires the `.proto` definitions and the generated Python file `sleeve_pb2.py`.  
