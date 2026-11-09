# ⛏️ PocketCraft: Universal Cross-Platform Minecraft Server & Web Manager

[![Platform](https://img.shields.io/badge/Platforms-Android%20%7C%20Windows%20%7C%20Linux%20%7C%20macOS-blue.svg)](https://github.com/varaddorle007/PocketCraft)
[![Minecraft](https://img.shields.io/badge/Minecraft-Java%20%2B%20Bedrock%20Cross--Play-brightgreen.svg)](https://purpurmc.org)
[![Engine](https://img.shields.io/badge/Engine-Purpur%20%2B%20GeyserMC-orange.svg)](https://geysermc.org)
[![Wake on Demand](https://img.shields.io/badge/Power-Wake--on--Demand%20%28lazymc%29-yellow.svg)](https://github.com/timvisee/lazymc)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

> **Turn any old Android phone, old laptop, desktop, or spare device into a dedicated, power-efficient Minecraft server with a modern web interface. Supports seamless cross-play between PC Java and Mobile/Console Bedrock players!**

---

## ✨ Features at a Glance

* **⚡ Smart Wake-on-Demand (`lazymc`):**
  When no players are online for 10 minutes, the heavy Java process automatically sleeps, reducing CPU usage to <1% and preserving battery life. The instant a friend pings or joins, the server awakens automatically!
* **📱 Universal Device Health & Battery Protection:**
  Designed for repurposed phones and laptops. Includes live **Battery Percentage**, **Charging State**, **CPU Load**, and **Device Thermal Meters** with warnings if the device exceeds 45°C.
* **🌐 Cross-Play Built-in (GeyserMC + Floodgate):**
  Play together across platforms on the exact same world:
  - 🖥️ **PC / Mac / Linux** (Java Edition)
  - 📱 **Android & iOS / iPad** (Bedrock Edition)
  - 🎮 **Xbox, Nintendo Switch & PlayStation** (Bedrock Edition)
* **🚀 Zero Port-Forwarding (Playit.gg Tunnel):**
  Mobile network carriers and home ISPs use Carrier-Grade NAT (CGNAT), blocking traditional port forwarding. PocketCraft automatically generates a shareable public link (e.g. `yourname.auto.playit.gg`) with 1-click copy buttons.
* **💻 Glassmorphism Web Dashboard:**
  Control everything from your phone or PC browser: real-time console with command sender, live player list, one-click start/stop/restart, and RAM allocation slider.
* **🕒 3 Flexible Operating Modes:**
  - **Wake-on-Demand (Recommended):** Sleep when idle, auto-wake on join.
  - **24/7 Always-On:** Continuous non-stop operation.
  - **Scheduled:** Runs only during your chosen hours (e.g., 4:00 PM – 11:00 PM).

---

## 🚀 Quick Setup Guides by Platform

---

### 1. 🪟 Windows Setup (Windows 7 / 8 / 10 / 11)

#### Option A: 1-Click Installer (Recommended)
1. Download or clone this repository:
   ```cmd
   git clone https://github.com/varaddorle007/PocketCraft.git
   cd PocketCraft
   ```
2. Double-click **`install-windows.bat`**.
   *(It automatically detects your system, installs/verifies Java 21 & Node.js, and downloads Purpur, Geyser, Floodgate, `lazymc.exe`, and `playit.exe`).*
3. Double-click **`start-windows.bat`**.
4. Open your browser at:
   👉 **`http://localhost:8080`**

---

### 2. 📱 Android Phones & Tablets (All Brands: Vivo, Samsung, Xiaomi, OnePlus, Pixel, etc.)

Turn any spare Android phone into an always-on or wake-on-demand server.

#### Step 1: Install Termux
> ⚠️ **Notice:** Do **NOT** install Termux from Google Play Store (it is deprecated).  
> Install Termux from **[F-Droid](https://f-droid.org/en/packages/com.termux/)** or **[GitHub Releases](https://github.com/termux/termux-app/releases)**.

#### Step 2: Prevent Background Termination
Android skins (Funtouch OS, MIUI/HyperOS, One UI, OxygenOS) kill background apps to save battery. To prevent this:
1. Go to phone **Settings ➔ Battery ➔ Background App Management** (or *High Background Power Consumption*) ➔ Set **Termux** to **Unrestricted** / **Allowed**.
2. Open Termux and run:
   ```bash
   termux-wake-lock
   ```
   *(This keeps the CPU active even when your screen is locked/turned off).*

#### Step 3: Run the 1-Command Installer
Inside Termux, run:
```bash
pkg update -y && pkg install git -y
git clone https://github.com/varaddorle007/PocketCraft.git ~/PocketCraft
cd ~/PocketCraft
bash install-linux-mac.sh
```

#### Step 4: Launch the Server
```bash
bash start-linux-mac.sh
```
Open Chrome on your phone at `http://localhost:8080`, or open `http://<phone-ip>:8080` from your PC/laptop browser!

---

### 3. 🐧 Linux (Ubuntu, Debian, Arch, Fedora, Raspberry Pi)

```bash
# Clone repository
git clone https://github.com/varaddorle007/PocketCraft.git
cd PocketCraft

# Run installer (installs OpenJDK 21, Node.js, server engine & plugins)
bash install-linux-mac.sh

# Start server manager
bash start-linux-mac.sh
```
Access the dashboard at `http://localhost:8080`.

---

### 4. 🍏 macOS (Intel & Apple Silicon M1 / M2 / M3 / M4)

1. Make sure Node.js and Java are installed (via [Adoptium](https://adoptium.net/) or `brew install openjdk@21 node`).
2. Run:
   ```bash
   git clone https://github.com/varaddorle007/PocketCraft.git
   cd PocketCraft
   bash install-linux-mac.sh
   bash start-linux-mac.sh
   ```
3. Open `http://localhost:8080` in Safari or Chrome.

---

### 5. 🍎 Apple iOS (iPhones & iPads)

* **Joining as a Player:** Open Minecraft on your iPhone/iPad ➔ **Play** ➔ **Servers** ➔ **Add Server** ➔ Enter the IP and Port `19132`.
* **Managing the Server:** Open Safari or Chrome on your iOS device and enter the web dashboard address (e.g. `http://192.168.1.XX:8080` or your tunnel URL).

---

## 🎮 How to Connect & Play

### PC (Java Edition):
1. Open Minecraft: Java Edition ➔ **Multiplayer** ➔ **Add Server**.
2. Server Address: Enter your **Playit.gg Public Address** (e.g. `yourname.auto.playit.gg:25565`) or LAN IP (`192.168.1.XX:25565`).

### Mobile / Console / Tablet (Bedrock Edition):
1. Open Minecraft on your phone/tablet/console ➔ **Play** ➔ **Servers** ➔ **Add Server**.
2. Server Name: `PocketCraft`
3. Server Address: Enter your **Playit.gg Hostname** (e.g. `yourname.auto.playit.gg`).
4. Port: `19132` (or your assigned Bedrock port).
5. Click **Save** and **Join**!

---

## 🔋 Mobile Hardware & Battery Health Guidelines

When running an Android phone as a server:
1. **Prevent Battery Swelling:** Avoid keeping the battery at 100% plugged in 24/7. Use an inexpensive Wi-Fi timer plug to charge 1 hour every 6 hours, or disconnect periodically.
2. **Thermal Dissipation:** Remove rubber phone cases and keep the phone elevated on a metal stand or near a USB mini-fan.
3. **RAM Allocation:** The default is **3584 MB (3.5 GB)**, which is the sweet spot for 8 GB devices like the Vivo V20, leaving sufficient headroom for the OS.

---

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
