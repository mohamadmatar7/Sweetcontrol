# Vision Pi

A computer vision system running on Raspberry Pi that detects objects placed on a tray and automatically dumps them while sending detection data to a Core API.

## Overview

The Vision Pi uses a USB camera and TensorFlow Lite machine learning model to classify objects in real-time. When an object is detected with sufficient confidence and stability, the system:

1. **Triggers the tray mechanism** - Controls an Arduino-powered servo tray to dump the detected object
2. **Sends data to Core API** - Transmits the detected object's value and label via HTTP to the Core API endpoint

## Components

- **`clawTM/live_tm.py`** - Main Python script that handles:
  - Camera capture and image processing
  - TensorFlow Lite model inference
  - Arduino serial communication for tray control
  - HTTP requests to Core API
  - Real-time detection with stability checks

- **`arduino/ServoTray.ino`** - Arduino firmware that:
  - Controls dual servos for tray tilting mechanism
  - Responds to serial commands (`TRAY`, `PING`)
  - Manages LED matrix flashing during tray operations
  - Provides smooth servo movements with mirrored positioning

- **`start_grafiek.sh`** - Browser launcher script that opens a fullscreen Chromium window displaying the sugar graph

- **`sweetcontrol-tray.desktop`** - Desktop entry for easy launching of the tray detection system

## Detected Objects

The system can classify the following objects:
- **Insuline** (Insulin)
- **Cola**
- **Nike**
- **Appel** (Apple)
- **Niets** (Nothing/Empty)

## Features

- Real-time object detection at ~10 FPS
- Stability checking (object must be detected for 2 seconds before triggering)
- Cooldown period between drops (4 seconds)
- Automatic hardware recovery on camera/Arduino failures
- Heartbeat monitoring for Arduino connection
- Visual feedback with on-screen detection overlay
- HTTP integration with Core API for data logging

## Requirements

- Raspberry Pi with USB camera
- Arduino with servos and LED matrix
- Python 3 with TensorFlow Lite runtime

