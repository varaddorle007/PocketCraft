#!/usr/bin/env bash
# ==============================================================================
#  PocketCraft - Automated 1-Command Installer
#  Optimized for Vivo V20, Android (Termux), and Linux Laptops
# ==============================================================================

set -e

# Color definitions
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${CYAN}"
echo "  ██████╗  ██████╗  ██████╗██╗  ██╗███████╗████████╗ ██████╗██████╗  █████╗ ███████╗████████╗"
echo "  ██╔══██╗██╔═══██╗██╔════╝██║ ██╔╝██╔════╝╚══██╔══╝██╔════╝██╔══██╗██╔══██╗██╔════╝╚══██╔══╝"
echo "  ██████╔╝██║   ██║██║     █████╔╝ █████╗     ██║   ██║     ██████╔╝███████║█████╗     ██║   "
echo "  ██╔═══╝ ██║   ██║██║     ██╔═██╗ ██╔══╝     ██║   ██║     ██╔══██╗██╔══██║██╔══╝     ██║   "
echo "  ██║     ╚██████╔╝╚██████╗██║  ██╗███████╗   ██║   ╚██████╗██║  ██║██║  ██║██║        ██║   "
echo "  ╚═╝      ╚═════╝  ╚═════╝╚═╝  ╚═╝╚══════╝   ╚═╝    ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝        ╚═╝   "
echo -e "${NC}"
echo -e "${GREEN}[+] Starting PocketCraft 1-Command Setup...${NC}\n"

# 1. Detect Architecture and Platform
ARCH=$(uname -m)
IS_TERMUX=false

if [ -n "$PREFIX" ] && [[ "$PREFIX" == *"com.termux"* ]]; then
    IS_TERMUX=true
    echo -e "${YELLOW}[!] Detected Android Termux Environment!${NC}"
    echo -e "${CYAN}[+] Acquiring Android CPU Wake-Lock (Prevents sleep when screen off)...${NC}"
    termux-wake-lock || true
else
    echo -e "${CYAN}[+] Detected Linux / Laptop Environment ($ARCH)${NC}"
fi

# 2. Package Installation
echo -e "\n${CYAN}[1/6] Installing Dependencies (Java 21, Node.js, cURL, Wget, JQ)...${NC}"
if [ "$IS_TERMUX" = true ]; then
    pkg update -y
    pkg install openjdk-21 nodejs curl wget jq git -y
else
    if command -v apt-get &> /dev/null; then
        sudo apt-get update -y
        sudo apt-get install openjdk-21-jre-headless nodejs npm curl wget jq git -y || true
    fi
fi

# 3. Create Server Folders
echo -e "\n${CYAN}[2/6] Preparing Directories...${NC}"
mkdir -p server/plugins config

# 4. Download Minecraft Server Engine (Purpur 1.20.4 - Highly Optimized)
echo -e "\n${CYAN}[3/6] Downloading Purpur Server Engine (Ultra-smooth on ARM)...${NC}"
if [ ! -f "server/server.jar" ]; then
    PURPUR_URL="https://api.purpurmc.org/v2/purpur/1.20.4/latest/download"
    echo -e "Downloading from: ${PURPUR_URL}"
    curl -L -o server/server.jar "$PURPUR_URL"
    echo -e "${GREEN}[✓] Purpur server.jar installed.${NC}"
else
    echo -e "${YELLOW}[-] server.jar already exists. Skipping download.${NC}"
fi

# Accept EULA
echo "eula=true" > server/eula.txt
echo -e "${GREEN}[✓] Minecraft EULA accepted automatically.${NC}"

# Write Optimized server.properties for Mobile & Low-Power Hardware
if [ ! -f "server/server.properties" ]; then
    cat <<EOF > server/server.properties
motd=\u00A7aPocketCraft Server \u00A77| \u00A7eHosted on Mobile
server-port=25566
view-distance=7
simulation-distance=5
max-players=10
difficulty=normal
gamemode=survival
network-compression-threshold=256
online-mode=true
enable-query=false
sync-chunk-writes=false
EOF
    echo -e "${GREEN}[✓] Optimized mobile server.properties generated.${NC}"
fi

# 5. Download Cross-Play Plugins (GeyserMC + Floodgate)
echo -e "\n${CYAN}[4/6] Installing Cross-Play Plugins (Allows Android, iOS, Xbox, Switch to join)...${NC}"
if [ ! -f "server/plugins/Geyser-Spigot.jar" ]; then
    echo "Downloading GeyserMC..."
    curl -L -o server/plugins/Geyser-Spigot.jar "https://download.geysermc.org/v2/projects/geyser/versions/latest/builds/latest/downloads/spigot" || true
fi

if [ ! -f "server/plugins/floodgate-spigot.jar" ]; then
    echo "Downloading Floodgate..."
    curl -L -o server/plugins/floodgate-spigot.jar "https://download.geysermc.org/v2/projects/floodgate/versions/latest/builds/latest/downloads/spigot" || true
fi
echo -e "${GREEN}[✓] Cross-play plugins installed.${NC}"

# 6. Download lazymc (Wake-on-Demand & Idle Sleep Proxy)
echo -e "\n${CYAN}[5/6] Installing lazymc Smart Wake-on-Demand Proxy...${NC}"
if [ ! -f "lazymc" ]; then
    if [[ "$ARCH" == "aarch64"* ]]; then
        LAZYMC_URL="https://github.com/timvisee/lazymc/releases/download/v0.2.11/lazymc-v0.2.11-linux-aarch64"
    else
        LAZYMC_URL="https://github.com/timvisee/lazymc/releases/download/v0.2.11/lazymc-v0.2.11-linux-x64"
    fi
    echo "Downloading lazymc ($ARCH)..."
    curl -L -o lazymc "$LAZYMC_URL" || true
    chmod +x lazymc || true
    echo -e "${GREEN}[✓] lazymc proxy installed.${NC}"
fi

# 7. Download Playit.gg (Zero-Port-Forward Tunnel)
echo -e "\n${CYAN}[6/6] Installing Playit.gg Public Gaming Tunnel...${NC}"
if [ ! -f "playit" ]; then
    if [[ "$ARCH" == "aarch64"* ]]; then
        PLAYIT_URL="https://github.com/playit-cloud/playit-agent/releases/download/v1.2.0/playit-linux-aarch64"
    else
        PLAYIT_URL="https://github.com/playit-cloud/playit-agent/releases/download/v1.2.0/playit-linux-amd64"
    fi
    echo "Downloading Playit ($ARCH)..."
    curl -L -o playit "$PLAYIT_URL" || true
    chmod +x playit || true
    echo -e "${GREEN}[✓] Playit agent installed.${NC}"
fi

# Install Node dependencies
echo -e "\n${CYAN}[+] Installing Web Manager dependencies...${NC}"
npm install --silent

echo -e "\n${GREEN}================================================================${NC}"
echo -e "${GREEN}  🎉 POCKETCRAFT SETUP COMPLETE!${NC}"
echo -e "${GREEN}================================================================${NC}"
echo -e "To start your server and web interface right now, run:"
echo -e "   ${YELLOW}node server.js${NC}   or   ${YELLOW}./scripts/start.sh${NC}\n"
echo -e "Then open your phone or laptop browser at:"
echo -e "   ${CYAN}http://localhost:8080${NC} (or your phone's Wi-Fi IP address)\n"

