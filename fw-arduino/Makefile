
.PHONY: build only_upload upload

build: src/md5.h src/md5.c src/bleuart.h fw-arduino.ino sketch.yaml
	arduino-cli compile --fqbn adafruit:nrf52:feather52840sense --build-path build -m kinisi-k1x
	cp build/compile_commands.json ./

only_upload:
	arduino-cli upload -p /dev/ttyACM0 --fqbn adafruit:nrf52:feather52840sense --input-dir build -m kinisi-k1x

only_upload_macos:
	arduino-cli upload -p /dev/tty.usbmodem14101 --fqbn adafruit:nrf52:feather52840sense --input-dir build -m kinisi-k1x

upload: build only_upload
