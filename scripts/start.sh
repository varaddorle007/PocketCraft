#!/usr/bin/env bash
# PocketCraft Start Script for Android (Termux) & Linux

cd "$(dirname "$0")/.."

# Acquire Android wake-lock if on Termux
if command -v termux-wake-lock &> /dev/null; then
    termux-wake-lock
    echo "[+] Android CPU Wake-Lock acquired. The phone screen can now be turned off safely."
fi

echo "[+] Starting PocketCraft Server Manager..."
node server.js

