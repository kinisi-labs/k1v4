import streamlit as st
from bleak import discover
import asyncio
import threading

# Function to filter devices with specific name pattern
def filter_devices(devices):
    return [dev for dev in devices if dev.name and dev.name.startswith("kinisi-k1x-")]

# Function to asynchronously discover BLE devices
async def discover_devices(found_devices):
    while True:
        devices = await BleakScanner.discover()
        filtered = filter_devices(devices)
        for device in filtered:
            found_devices[device.address] = device.name
        await asyncio.sleep(5)  # Pause for 5 seconds before the next scan

# Streamlit app
def main():
    st.title("BLE Device Listener")

    found_devices = {}

    # Run the discovery in a separate thread
    def run_discovery():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(discover_devices(found_devices))

    discovery_thread = threading.Thread(target=run_discovery)
    discovery_thread.start()

    # Display found devices
    while True:
        st.write("Scanning for devices...")
        st.write(found_devices)
        st.experimental_rerun()

if __name__ == "__main__":
    main()
