<div align="center">
  <img src="GitHub Banner SweetControl.jpg" alt="SweetControl Banner" width="100%">
</div>

# SweetControl - Remote Claw Machine Project

A fully automated, internet-controlled claw machine system that combines computer vision, real-time game management, and mobile-based remote control. Players pay and play from their mobile devices, with no physical joystick required.

## 🎮 Project Overview

SweetControl is an interactive arcade experience where users can:
- Make donations/payments via mobile web interface
- Control a physical claw machine remotely from their phone
- See real-time queue status and game state
- View a live sugar index graph based on detected objects
- Experience automated object detection and tray dumping

## 🖥️ Hardware Components

### Raspberry Pi Systems
- **Core Pi** - Main game server running Docker containers (API, Web, WebSocket, Cloudflare tunnel)
- **Vision Pi** - Computer vision system with USB camera for object detection

### Control Hardware
- **Arduino** - Controls servo tray mechanism
- **2x Servos** - Dual servos for tilting tray mechanism (mirrored positioning)
- **ULN2803A** - High-current Darlington transistor array for controlling claw machine inputs
- **DIY Claw Machine Kit** - Physical claw machine with logic board
- **GPIO Pins** (BCM) - Direct hardware control:
  - Up (22), Down (27), Left (23), Right (24)
  - Grab (17), Credit (25)

### Display & Input
- **Touchscreen Display** - Shows sugar graph visualization and serves as fallback control interface
- **USB Webcam** - Captures images for TensorFlow Lite object detection

### Networking & Infrastructure
- **Ethernet Switch** - Network connectivity for all devices
- **Cloudflare Tunnel** - Secure public access without port forwarding
- **Combell Hosting** - Frontend hosting infrastructure

### Additional Components
- **3D Printed Objects** - Custom parts for the physical machine

## 🏗️ System Architecture

See individual README files for details:
- [`core-pi/README.md`](core-pi/README.md) - Core server setup
- [`vision-pi/README.md`](vision-pi/README.md) - Vision system setup


## 🎯 Key Features

- **Mobile-First Control** - No physical joystick, all control via mobile web interface
- **Payment Integration** - Mollie payment gateway for donations/credits
- **Real-Time Queue System** - Players join queue, wait for their turn
- **Computer Vision** - Automatic object detection and classification
- **Automated Tray System** - Detected objects automatically dumped into machine
- **Sugar Index Tracking** - Visual graph showing cumulative sugar effects
- **WebSocket Communication** - Real-time updates across all clients
- **Docker Deployment** - Containerized services for easy management


## 🔧 Technology Stack

- **Backend**: Node.js, Express.js, SQLite
- **Frontend**: Next.js, React, Tailwind CSS
- **Real-Time**: Soketi (Pusher-compatible WebSocket server)
- **Payments**: Mollie API
- **Computer Vision**: TensorFlow Lite, Python
- **Hardware Control**: GPIO (libgpiod), Arduino, Servo motors
- **Infrastructure**: Docker, Docker Compose, Cloudflare Tunnel
- **Email**: NodeMailer (Combell SMTP)

## 📝 Notes

- The machine operates without a physical joystick - all control is mobile-based
- Players pay via Mollie and receive session tokens for gameplay
- The vision system automatically detects objects and updates the sugar index
- Real-time synchronization ensures all clients see the same game state
- The touchscreen display serves as both visualization and emergency fallback control