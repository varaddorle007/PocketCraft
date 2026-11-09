// PocketCraft Frontend Application
let ws = null;
let autoscroll = true;
let currentConfig = null;
let currentStatus = null;

// DOM Elements
const statusBadge = document.getElementById('statusBadge');
const statusText = statusBadge.querySelector('.status-text');
const deviceTag = document.getElementById('deviceTag');
const serverNameDisplay = document.getElementById('serverNameDisplay');
const uptimeDisplay = document.getElementById('uptimeDisplay');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const restartBtn = document.getElementById('restartBtn');

// Health Elements
const batteryVal = document.getElementById('batteryVal');
const batteryBar = document.getElementById('batteryBar');
const batteryState = document.getElementById('batteryState');
const batteryIcon = document.getElementById('batteryIcon');
const tempVal = document.getElementById('tempVal');
const tempBar = document.getElementById('tempBar');
const thermalBadge = document.getElementById('thermalBadge');
const cpuVal = document.getElementById('cpuVal');
const cpuBar = document.getElementById('cpuBar');
const ramVal = document.getElementById('ramVal');
const ramBar = document.getElementById('ramBar');
const ramAlloc = document.getElementById('ramAlloc');

// Mode Cards
const modeCards = document.querySelectorAll('.mode-card');

// Connectivity Elements
const javaIpInput = document.getElementById('javaIpInput');
const bedrockIpInput = document.getElementById('bedrockIpInput');
const lanAddressDisplay = document.getElementById('lanAddressDisplay');
const tunnelStatus = document.getElementById('tunnelStatus');

// Terminal Elements
const terminalWindow = document.getElementById('terminalWindow');
const commandForm = document.getElementById('commandForm');
const cmdInput = document.getElementById('cmdInput');
const clearConsoleBtn = document.getElementById('clearConsoleBtn');
const autoscrollToggle = document.getElementById('autoscrollToggle');
const playerCountBadge = document.getElementById('playerCountBadge');

// Settings Modal
const settingsModal = document.getElementById('settingsModal');
const settingsToggleBtn = document.getElementById('settingsToggleBtn');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const settingsForm = document.getElementById('settingsForm');
const settingRamSlider = document.getElementById('settingRamSlider');
const ramSliderVal = document.getElementById('ramSliderVal');

// Initialize WebSocket Connection
function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    appendTerminalLine('[PocketCraft] Connected to device server.');
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'status') {
        updateStatus(msg.data);
      } else if (msg.type === 'log') {
        appendTerminalLine(msg.data);
      } else if (msg.type === 'logs') {
        terminalWindow.innerHTML = '';
        msg.data.forEach(line => appendTerminalLine(line));
      } else if (msg.type === 'config') {
        updateConfig(msg.data);
      } else if (msg.type === 'players') {
        updatePlayers(msg.data);
      }
    } catch (err) {
      console.error('Error parsing WS message:', err);
    }
  };

  ws.onclose = () => {
    statusBadge.className = 'status-indicator';
    statusText.textContent = 'DISCONNECTED';
    appendTerminalLine('[PocketCraft] Lost connection to server daemon. Reconnecting in 3s...');
    setTimeout(connectWebSocket, 3000);
  };

  ws.onerror = () => ws.close();
}

function updateStatus(data) {
  currentStatus = data;
  const status = data.status;

  // Update Status Badge
  statusBadge.className = 'status-indicator';
  if (status === 'ONLINE') {
    statusBadge.classList.add('online');
    statusText.textContent = 'ONLINE';
  } else if (status === 'SLEEPING') {
    statusBadge.classList.add('sleeping');
    statusText.textContent = 'SLEEPING (AUTO-WAKE)';
  } else if (status === 'STARTING') {
    statusBadge.classList.add('starting');
    statusText.textContent = 'STARTING...';
  } else if (status === 'STOPPING') {
    statusBadge.classList.add('starting');
    statusText.textContent = 'STOPPING...';
  } else {
    statusText.textContent = 'OFFLINE';
  }

  // Update Buttons
  startBtn.disabled = (status === 'ONLINE' || status === 'STARTING');
  stopBtn.disabled = (status === 'OFFLINE');
  restartBtn.disabled = (status === 'OFFLINE');

  // Update Uptime
  const up = data.uptimeSeconds;
  const mins = Math.floor(up / 60);
  const hours = Math.floor(mins / 60);
  uptimeDisplay.textContent = `Uptime: ${hours}h ${mins % 60}m ${up % 60}s | Mode: ${data.mode}`;

  // Update Device Health
  const dev = data.device;
  if (dev) {
    deviceTag.textContent = `Host: ${dev.isAndroid ? 'Android Phone' : dev.platform} (${dev.arch})`;

    // Battery
    if (dev.batteryPercent !== null) {
      batteryVal.textContent = `${dev.batteryPercent}%`;
      batteryBar.style.width = `${dev.batteryPercent}%`;
      batteryIcon.textContent = dev.isCharging ? '⚡🔋' : '🔋';
      batteryState.textContent = dev.isCharging ? 'Charging' : 'Discharging on battery';
    } else {
      batteryVal.textContent = 'AC Power';
      batteryBar.style.width = '100%';
      batteryState.textContent = 'Desktop / Wall Power';
    }

    // Temperature
    if (dev.temperatureC !== null) {
      tempVal.textContent = `${dev.temperatureC}°C`;
      const tempWidth = Math.min(100, (dev.temperatureC / 60) * 100);
      tempBar.style.width = `${tempWidth}%`;
      if (dev.temperatureC > 45) {
        tempBar.classList.add('hot');
      } else {
        tempBar.classList.remove('hot');
      }
    } else {
      tempVal.textContent = 'Normal';
    }

    thermalBadge.textContent = dev.thermalState;
    if (dev.thermalState.includes('Hot') || dev.thermalState.includes('Risk')) {
      thermalBadge.className = 'badge danger';
    } else if (dev.thermalState.includes('Warm')) {
      thermalBadge.className = 'badge warn';
    } else {
      thermalBadge.className = 'badge';
    }

    // CPU & RAM
    cpuVal.textContent = `${dev.cpuPercent}%`;
    cpuBar.style.width = `${dev.cpuPercent}%`;

    ramVal.textContent = `${dev.ramUsedMb} / ${dev.ramTotalMb} MB`;
    const ramPct = Math.round((dev.ramUsedMb / dev.ramTotalMb) * 100);
    ramBar.style.width = `${ramPct}%`;
    ramAlloc.textContent = `Allocated to MC: ${data.ramAllocationMb} MB`;

    // Local IP
    if (dev.localIps && dev.localIps.length > 0) {
      const primaryIp = dev.localIps.find(i => i.address.startsWith('192.168.')) || dev.localIps[0];
      const lanJava = document.getElementById('lanJavaInput');
      const lanBedrock = document.getElementById('lanBedrockInput');
      const lanPort = document.getElementById('lanBedrockPort');
      if (lanJava) lanJava.value = `${primaryIp.address}:${data.minecraftPort || 25565}`;
      if (lanBedrock) lanBedrock.value = primaryIp.address;
      if (lanPort) lanPort.textContent = `${data.bedrockPort || 19132}`;
    }
  }

  // Update Tunnel and Claim Status
  const claimCard = document.getElementById('claimNoticeCard');
  const claimBtn = document.getElementById('claimLinkBtn');
  
  if (data.tunnel && data.tunnel.claimUrl && (!data.tunnel.publicAddress || data.tunnel.publicAddress.includes('Pending') || data.tunnel.publicAddress.includes('binary not installed'))) {
    if (claimCard) claimCard.style.display = 'flex';
    if (claimBtn) claimBtn.href = data.tunnel.claimUrl;
    tunnelStatus.textContent = 'Claim Link Ready';
    tunnelStatus.className = 'badge warn';
    javaIpInput.value = 'Click Claim Link Above to Activate';
    bedrockIpInput.value = 'Click Claim Link Above to Activate';
  } else if (data.tunnel && data.tunnel.publicAddress && !data.tunnel.publicAddress.includes('Pending') && !data.tunnel.publicAddress.includes('binary not installed')) {
    if (claimCard) claimCard.style.display = 'none';
    const rawAddr = data.tunnel.publicAddress;
    javaIpInput.value = rawAddr;
    const parts = rawAddr.split(':');
    bedrockIpInput.value = `${parts[0]} (Port: ${data.bedrockPort || 19132})`;
    tunnelStatus.textContent = 'Active (Zero Port-Forward)';
    tunnelStatus.className = 'badge live-badge';
  } else {
    if (claimCard) claimCard.style.display = 'none';
    javaIpInput.value = 'Connecting to tunnel...';
    bedrockIpInput.value = 'Connecting to tunnel...';
  }

  // Active Mode Card Highlight
  modeCards.forEach(card => {
    card.classList.toggle('active', card.dataset.mode === data.mode);
  });
}

function updateConfig(cfg) {
  currentConfig = cfg;
  serverNameDisplay.textContent = cfg.serverName || 'PocketCraft Server';
  settingRamSlider.value = cfg.ramAllocationMb;
  ramSliderVal.textContent = `${cfg.ramAllocationMb} MB`;
  document.getElementById('settingServerName').value = cfg.serverName || '';
  document.getElementById('settingIdleMinutes').value = cfg.idleSleepMinutes || 10;
  if (document.getElementById('settingOnlineMode')) {
    document.getElementById('settingOnlineMode').value = (cfg.onlineMode === false) ? 'false' : 'true';
  }
  if (cfg.schedule) {
    document.getElementById('settingStartTime').value = cfg.schedule.startTime || '16:00';
    document.getElementById('settingEndTime').value = cfg.schedule.endTime || '23:00';
  }
}

function updatePlayers(players) {
  playerCountBadge.textContent = `${players.length} Players Online`;
}

function appendTerminalLine(text) {
  const div = document.createElement('div');
  div.className = 'terminal-line';
  if (text.includes('ERROR') || text.includes('Exception')) div.classList.add('error');
  else if (text.includes('WARN')) div.classList.add('warn');
  else if (text.includes('INFO')) div.classList.add('info');

  div.textContent = text;
  terminalWindow.appendChild(div);

  // Limit terminal history
  while (terminalWindow.children.length > 500) {
    terminalWindow.removeChild(terminalWindow.firstChild);
  }

  if (autoscroll) {
    terminalWindow.scrollTop = terminalWindow.scrollHeight;
  }
}

// Power Action Triggers
function triggerAction(action) {
  fetch('/api/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action })
  }).catch(err => console.error('Failed action:', err));
}

startBtn.addEventListener('click', () => triggerAction('start'));
stopBtn.addEventListener('click', () => triggerAction('stop'));
restartBtn.addEventListener('click', () => triggerAction('restart'));

// Mode Switcher Clicks
modeCards.forEach(card => {
  card.addEventListener('click', () => {
    const selectedMode = card.dataset.mode;
    modeCards.forEach(c => c.classList.remove('active'));
    card.classList.add('active');

    fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: selectedMode })
    });
  });
});

// Copy IP Buttons
document.querySelectorAll('.copy-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const targetId = btn.dataset.target;
    const input = document.getElementById(targetId);
    input.select();
    input.setSelectionRange(0, 99999); // For mobile devices

    const onCopied = () => {
      const orig = btn.textContent;
      btn.textContent = 'Copied! ✓';
      btn.style.background = '#10b981';
      setTimeout(() => {
        btn.textContent = orig;
        btn.style.background = '';
      }, 2000);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(input.value).then(onCopied).catch(() => {
        document.execCommand('copy');
        onCopied();
      });
    } else {
      document.execCommand('copy');
      onCopied();
    }
  });
});

// Quick Command Buttons
document.querySelectorAll('.cmd-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    const cmd = pill.dataset.cmd;
    sendCommand(cmd);
  });
});

// Command Submission
commandForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const cmd = cmdInput.value.trim();
  if (!cmd) return;
  sendCommand(cmd);
  cmdInput.value = '';
});

function sendCommand(cmd) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'command', data: cmd }));
  } else {
    fetch('/api/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: cmd })
    });
  }
}

// Terminal Controls
clearConsoleBtn.addEventListener('click', () => {
  terminalWindow.innerHTML = '';
});

autoscrollToggle.addEventListener('click', () => {
  autoscroll = !autoscroll;
  autoscrollToggle.textContent = `Autoscroll: ${autoscroll ? 'ON' : 'OFF'}`;
});

// Settings Modal
settingsToggleBtn.addEventListener('click', () => settingsModal.classList.add('active'));
closeSettingsBtn.addEventListener('click', () => settingsModal.classList.remove('active'));
settingsModal.addEventListener('click', (e) => {
  if (e.target === settingsModal) settingsModal.classList.remove('active');
});

settingRamSlider.addEventListener('input', () => {
  ramSliderVal.textContent = `${settingRamSlider.value} MB`;
});

settingsForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const updates = {
    serverName: document.getElementById('settingServerName').value,
    onlineMode: document.getElementById('settingOnlineMode') ? (document.getElementById('settingOnlineMode').value === 'true') : true,
    ramAllocationMb: parseInt(settingRamSlider.value),
    idleSleepMinutes: parseInt(document.getElementById('settingIdleMinutes').value),
    schedule: {
      enabled: currentConfig ? currentConfig.schedule.enabled : true,
      startTime: document.getElementById('settingStartTime').value,
      endTime: document.getElementById('settingEndTime').value,
      days: [1, 2, 3, 4, 5, 6, 7]
    },
    thermalProtection: {
      enabled: true,
      maxTempCelsius: parseInt(document.getElementById('settingMaxTemp').value)
    }
  };

  fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  }).then(() => {
    settingsModal.classList.remove('active');
  });
});

// Connect on Load
connectWebSocket();

