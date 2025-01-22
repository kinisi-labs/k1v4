#!/usr/bin/env python3
# test_server.py

import uvicorn
import time
import html

from fastapi import FastAPI, Request, status
from fastapi.responses import HTMLResponse, JSONResponse
from google.protobuf.json_format import MessageToJson

import sleeve_packet_pb2  # Ensure sleeve_packet_pb2.py is available

app = FastAPI()

# Configuration
MAX_RECENT_PACKETS = 10  # Number of recent packets to store/display

# In-memory storage
recent_packets = []
total_packet_count = 0

# Variables for tracking the last received packet
last_packet = None
last_time_received = None
last_packet_size = 0


@app.get("/", response_class=HTMLResponse)
async def index():
    """
    Serve an HTML page that uses Bootstrap to display packet stats and auto-updates.
    Includes a button to clear the list of packets.
    """
    html_content = """\
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>Kinisi Test Server</title>
    <!-- Bootstrap 5.3 CDN -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
    <script>
      async function updateStats() {
        try {
          let response = await fetch('/api/v1/stats');
          if (response.ok) {
            let data = await response.json();
            document.getElementById('total-packets').textContent = data.total_packet_count;
            let tbody = document.getElementById('packet-table-body');
            tbody.innerHTML = ''; // Clear existing rows
            data.recent_packets.forEach(function(pkt, idx) {
              let row = document.createElement('tr');
              row.innerHTML = `
                <td>${idx + 1}</td>
                <td>${escapeHtml(pkt.device_id)}</td>
                <td>${pkt.packet_sequence_id}</td>
                <td>${escapeHtml(pkt.firmware_version)}</td>
                <td>${pkt.timestamp_micros}</td>
                <td>${pkt.battery_voltage.toFixed(2)}</td>
                <td>${pkt.readings_count}</td>
              `;
              tbody.appendChild(row);
            });
          } else {
            console.error('Failed to fetch stats:', response.statusText);
          }
        } catch (err) {
          console.error('Error fetching stats:', err);
        }
      }

      function escapeHtml(text) {
        var map = {
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, function(m) { return map[m]; });
      }

      async function clearPackets() {
        await fetch('/api/v1/clear', { method: 'POST' });
        updateStats();
      }

      setInterval(updateStats, 5000);
      window.onload = updateStats;
    </script>
  </head>
  <body class="bg-light">
    <div class="container my-5">
      <h2 class="mb-4">Kinisi Test Server Stats</h2>
      <a href="/lastpacket">View Last Packet</a>
      <div class="card mb-4">
        <div class="card-body">
          <p><strong>Total packets received:</strong> <span id="total-packets">0</span></p>
          <button class="btn btn-danger" onclick="clearPackets()">Clear Packets</button>
        </div>
      </div>

      <h3 class="mb-3">Last Packets:</h3>
      <table class="table table-striped table-hover">
        <thead class="table-dark">
          <tr>
            <th>#</th>
            <th>Device ID</th>
            <th>Packet Sequence ID</th>
            <th>Firmware Version</th>
            <th>Timestamp (µs)</th>
            <th>Battery Voltage</th>
            <th>Readings Count</th>
          </tr>
        </thead>
        <tbody id="packet-table-body">
        </tbody>
      </table>
    </div>
  </body>
</html>
"""
    return HTMLResponse(content=html_content, status_code=200)


@app.post("/api/v1/packets")
async def receive_packet(request: Request):
    """
    Endpoint to receive protobuf-encoded SleevePacket data.
    """
    global total_packet_count, recent_packets
    global last_packet, last_time_received, last_packet_size

    raw_data = await request.body()

    # Parse into a SleevePacket
    sleeve_packet = sleeve_packet_pb2.SleevePacket()
    try:
        sleeve_packet.ParseFromString(raw_data)
    except Exception as e:
        return JSONResponse(content={"error": f"Failed to parse protobuf: {str(e)}"}, status_code=status.HTTP_400_BAD_REQUEST)

    # Update counters and store in memory
    total_packet_count += 1
    recent_packets.append(sleeve_packet)
    if len(recent_packets) > MAX_RECENT_PACKETS:
        recent_packets.pop(0)  # Remove the oldest packet

    # Update last packet tracking
    last_packet = sleeve_packet
    last_time_received = time.time()
    last_packet_size = len(raw_data)

    return {"status": "OK", "message": "Packet received."}


@app.post("/api/v1/clear")
async def clear_packets():
    """Clear all stored packets."""
    global recent_packets, total_packet_count, last_packet, last_time_received, last_packet_size
    recent_packets = []
    total_packet_count = 0
    last_packet = None
    last_time_received = None
    last_packet_size = 0
    return {"status": "OK", "message": "All packets cleared."}


@app.get("/api/v1/stats")
async def get_stats():
    """Get statistics on received packets."""
    stats = {
        "total_packet_count": total_packet_count,
        "recent_packets": [],
    }
    for pkt in recent_packets:
        meta = pkt.metadata
        stats["recent_packets"].append({
            "device_id": meta.device_id,
            "packet_sequence_id": meta.packet_sequence_id,
            "firmware_version": meta.firmware_version,
            "timestamp_micros": meta.timestamp_micros,
            "battery_voltage": meta.battery_voltage,
            "readings_count": len(pkt.readings),
        })
    return stats

@app.get("/api/v1/lastpacketjson")
async def get_last_packet_json():
    """Return JSON representation of the last packet received."""
    if not last_packet or not last_time_received:
        return JSONResponse({"error": "No packet received yet."}, status_code=404)

    current_time = time.time()
    delta_time = current_time - last_time_received

    pretty_json = MessageToJson(last_packet, indent=2)

    return {
        "time_received": last_time_received,
        "current_time": current_time,
        "delta_time": delta_time,
        "packet_size": last_packet_size,
        "pretty_json": pretty_json
    }


@app.get("/lastpacket", response_class=HTMLResponse)
async def last_packet_page():
    """
    Serve an HTML page that displays the last received packet as pretty-printed JSON
    along with timing and size information, updating every 500ms.
    """
    html_content = """\
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>Last Packet</title>
    <!-- Bootstrap 5.3 CDN -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
    <script>
      async function updateLastPacket() {
        try {
          let response = await fetch('/api/v1/lastpacketjson');
          if (response.ok) {
            let data = await response.json();
            
            document.getElementById('time-received').textContent = data.time_received
              ? new Date(data.time_received * 1000).toISOString() : "No packet received";
            document.getElementById('current-time').textContent = new Date(data.current_time * 1000).toISOString();
            document.getElementById('delta-time').textContent = data.delta_time ? data.delta_time.toFixed(2) : "N/A";
            document.getElementById('packet-size').textContent = data.packet_size || "N/A";
            document.getElementById('packet-json').textContent = data.pretty_json || "No data received yet.";
          } else {
            console.error('Failed to fetch last packet:', response.statusText);
          }
        } catch(err) {
          console.error('Error fetching last packet:', err);
        }
      }

      // Update every 500ms
      setInterval(updateLastPacket, 500);
      window.onload = updateLastPacket;
    </script>
  </head>
  <body class="bg-light">
    <div class="container my-5">
      <h2 class="mb-4">Last Packet</h2>
      <p><strong>Time Received:</strong> <span id="time-received">N/A</span></p>
      <p><strong>Current Time:</strong> <span id="current-time">N/A</span></p>
      <p><strong>Delta Time (seconds):</strong> <span id="delta-time">N/A</span></p>
      <p><strong>Packet Size (bytes):</strong> <span id="packet-size">N/A</span></p>

      <h3>Packet JSON</h3>
      <pre id="packet-json">No data yet.</pre>
    </div>
  </body>
</html>
"""
    return HTMLResponse(content=html_content, status_code=200)



if __name__ == "__main__":
    uvicorn.run("test_server:app", host="0.0.0.0", port=8008, log_level="info", reload=True)
