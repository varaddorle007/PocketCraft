const express = require('express');
const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn, exec } = require('child_process');

// Paths
const BASE_DIR = __dirname;
const CONFIG_PATH = path.join(BASE_DIR, 'config', 'pocketcraft.json');
const SERVER_DIR = path.join(BASE_DIR, 'server');
const SCRIPTS_DIR = path.join(BASE_DIR, 'scripts');

// Ensure directories exist
if (!fs.existsSync(SERVER_DIR)) fs.mkdirSync(SERVER_DIR, { recursive: true });

// Load Configuration
let config = {
  serverName: "PocketCraft Server",
  deviceModel: "Auto-Detect Device",
  mode: "wake_on_demand", // "always_on" | "wake_on_demand" | "scheduled"
  ramAllocationMb: 3584,
  serverType: "purpur",
  minecraftPort: 25565,
  bedrockPort: 19132,
  webPort: 8080,
  idleSleepMinutes: 10,
  schedule: {
    enabled: false,
    startTime: "16:00",
    endTime: "23:00",
    days: [1, 2, 3, 4, 5, 6, 7]
  },
  tunnel: {
    enabled: true,
    provider: "playit",
    publicAddress: "Searching for tunnel...",
    claimUrl: ""
  },
  thermalProtection: {
    enabled: true,
    maxTempCelsius: 48,
    throttleWarning: true
  },
  geyserEnabled: true,
  motd: "§aA PocketCraft Server §7| §eHosted on Mobile/Laptop",
  maxPlayers: 10,
  difficulty: "normal",
  gamemode: "survival",
  viewDistance: 8,
  simulationDistance: 6
};

if (fs.existsSync(CONFIG_PATH)) {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    config = { ...config, ...JSON.parse(raw) };
  } catch (err) {
    console.error('[Config] Failed to load config:', err);
  }
}

function saveConfig() {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  } catch (err) {
    console.error('[Config] Failed to save config:', err);
  }
}

// Server State Management
let serverProcess = null;
let tunnelProcess = null;
let serverStatus = 'OFFLINE'; // 'OFFLINE' | 'STARTING' | 'ONLINE' | 'SLEEPING' | 'STOPPING'
let serverStartTime = null;
let logHistory = [];
const MAX_LOG_LINES = 500;
let onlinePlayers = new Set();
let lastCpuInfo = os.cpus();
let lastCpuTime = Date.now();
let lastMeasuredCpuUsage = 0;

// Device & Battery State
let deviceStats = {
  platform: os.platform(),
  arch: os.arch(),
  hostname: os.hostname(),
  isAndroid: false,
  batteryPercent: null,
  isCharging: null,
  temperatureC: null,
  thermalState: 'Normal',
  cpuPercent: 0,
  ramTotalMb: Math.round(os.totalmem() / (1024 * 1024)),
  ramFreeMb: Math.round(os.freemem() / (1024 * 1024)),
  ramUsedMb: Math.round((os.totalmem() - os.freemem()) / (1024 * 1024)),
  localIps: getLocalIpAddresses()
};

// Check if running on Android / Termux
if (process.env.PREFIX && process.env.PREFIX.includes('com.termux')) {
  deviceStats.isAndroid = true;
  config.deviceModel = config.deviceModel === 'Auto-Detect Device' ? 'Android / Termux' : config.deviceModel;
}

function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push({ interface: name, address: iface.address });
      }
    }
  }
  return addresses;
}

function addLog(text) {
  const timestamp = new Date().toLocaleTimeString();
  const cleanText = text.replace(/[\x1b\x9b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
  const lines = cleanText.split(/\r?\n/).filter(l => l.trim().length > 0);

  for (const line of lines) {
    const entry = `[${timestamp}] ${line}`;
    logHistory.push(entry);
    if (logHistory.length > MAX_LOG_LINES) logHistory.shift();

    // Broadcast to connected WebSocket clients
    broadcastWs({ type: 'log', data: entry });

    // Parse player joins/leaves
    parsePlayerActivity(line);
  }
}

function parsePlayerActivity(line) {
  // Purpur/Paper join patterns
  const joinMatch = line.match(/UUID of player ([a-zA-Z0-9_]+) is/) || line.match(/([a-zA-Z0-9_]+) joined the game/);
  if (joinMatch) {
    onlinePlayers.add(joinMatch[1]);
    broadcastWs({ type: 'players', data: Array.from(onlinePlayers) });
  }

  const leaveMatch = line.match(/([a-zA-Z0-9_]+) lost connection/) || line.match(/([a-zA-Z0-9_]+) left the game/);
  if (leaveMatch) {
    onlinePlayers.delete(leaveMatch[1]);
    broadcastWs({ type: 'players', data: Array.from(onlinePlayers) });
  }

  // Detect server ready
  if (line.includes('Done (') && line.includes(')! For help, type "help"')) {
    serverStatus = 'ONLINE';
    serverStartTime = Date.now();
    broadcastWs({ type: 'status', data: getStatusPayload() });
  }

  // Detect lazymc sleep state
  if (line.includes('[lazymc]') && line.toLowerCase().includes('sleeping')) {
    serverStatus = 'SLEEPING';
    broadcastWs({ type: 'status', data: getStatusPayload() });
  }

  // Detect lazymc wake state
  if (line.includes('[lazymc]') && line.toLowerCase().includes('waking up')) {
    serverStatus = 'STARTING';
    broadcastWs({ type: 'status', data: getStatusPayload() });
  }
}

// Telemetry Polling (Battery & Thermals)
function updateDeviceMetrics() {
  // Update RAM
  const total = os.totalmem();
  const free = os.freemem();
  deviceStats.ramTotalMb = Math.round(total / (1024 * 1024));
  deviceStats.ramFreeMb = Math.round(free / (1024 * 1024));
  deviceStats.ramUsedMb = Math.round((total - free) / (1024 * 1024));

  // Update CPU
  const cpus = os.cpus();
  let idleDiff = 0;
  let totalDiff = 0;
  for (let i = 0; i < cpus.length; i++) {
    const prev = lastCpuInfo[i] || cpus[i];
    const curr = cpus[i];
    const prevTotal = Object.values(prev.times).reduce((a, b) => a + b, 0);
    const currTotal = Object.values(curr.times).reduce((a, b) => a + b, 0);
    idleDiff += curr.times.idle - prev.times.idle;
    totalDiff += currTotal - prevTotal;
  }
  lastCpuInfo = cpus;
  if (totalDiff > 0) {
    lastMeasuredCpuUsage = Math.max(0, Math.min(100, Math.round((1 - idleDiff / totalDiff) * 100)));
  }
  deviceStats.cpuPercent = lastMeasuredCpuUsage;

  // Battery & Temperature check
  if (deviceStats.isAndroid) {
    // Attempt Termux API for battery
    exec('termux-battery-status', (err, stdout) => {
      if (!err && stdout) {
        try {
          const batt = JSON.parse(stdout);
          deviceStats.batteryPercent = batt.percentage;
          deviceStats.isCharging = (batt.status === 'CHARGING' || batt.plugged !== 'UNPLUGGED');
          if (batt.temperature) {
            deviceStats.temperatureC = Math.round(batt.temperature * 10) / 10;
          }
        } catch (_) { }
      } else {
        // Fallback: Read sysfs
        try {
          if (fs.existsSync('/sys/class/power_supply/battery/capacity')) {
            deviceStats.batteryPercent = parseInt(fs.readFileSync('/sys/class/power_supply/battery/capacity', 'utf8').trim());
          }
          if (fs.existsSync('/sys/class/power_supply/battery/temp')) {
            deviceStats.temperatureC = Math.round(parseInt(fs.readFileSync('/sys/class/power_supply/battery/temp', 'utf8').trim()) / 10);
          }
          if (fs.existsSync('/sys/class/power_supply/battery/status')) {
            const status = fs.readFileSync('/sys/class/power_supply/battery/status', 'utf8').trim();
            deviceStats.isCharging = (status === 'Charging' || status === 'Full');
          }
        } catch (_) { }
      }
      evaluateThermalState();
    });
  } else {
    // Windows / Linux / macOS Laptop Fallback
    if (os.platform() === 'win32') {
      exec('WMIC Path Win32_Battery Get EstimatedChargeRemaining, BatteryStatus', (err, stdout) => {
        if (!err && stdout) {
          const lines = stdout.trim().split('\n').map(l => l.trim()).filter(l => l.length > 0);
          if (lines.length > 1) {
            const parts = lines[1].split(/\s+/);
            if (parts.length >= 2) {
              deviceStats.batteryPercent = parseInt(parts[1]) || null;
              deviceStats.isCharging = parts[0] === '2';
            }
          }
        }
        evaluateThermalState();
      });
    } else if (os.platform() === 'linux') {
      try {
        if (fs.existsSync('/sys/class/power_supply/BAT0/capacity')) {
          deviceStats.batteryPercent = parseInt(fs.readFileSync('/sys/class/power_supply/BAT0/capacity', 'utf8').trim());
        }
        if (fs.existsSync('/sys/class/power_supply/BAT0/status')) {
          deviceStats.isCharging = fs.readFileSync('/sys/class/power_supply/BAT0/status', 'utf8').trim() === 'Charging';
        }
        if (fs.existsSync('/sys/class/thermal/thermal_zone0/temp')) {
          deviceStats.temperatureC = Math.round(parseInt(fs.readFileSync('/sys/class/thermal/thermal_zone0/temp', 'utf8').trim()) / 1000);
        }
      } catch (_) { }
      evaluateThermalState();
    } else {
      evaluateThermalState();
    }
  }
}

function evaluateThermalState() {
  const temp = deviceStats.temperatureC;
  if (temp === null) {
    deviceStats.thermalState = 'Normal';
  } else if (temp > 50) {
    deviceStats.thermalState = 'Hot (Swelling Risk - Unplug or Fan)';
  } else if (temp > 43) {
    deviceStats.thermalState = 'Warm (Active Cooling Advised)';
  } else {
    deviceStats.thermalState = 'Cool / Optimal';
  }
}

setInterval(updateDeviceMetrics, 2000);
updateDeviceMetrics();

// Server Lifecycle Actions
function startServer() {
  if (serverProcess !== null && serverStatus !== 'OFFLINE' && serverStatus !== 'SLEEPING') {
    addLog('[PocketCraft] Server is already running or starting.');
    return;
  }

  serverStatus = 'STARTING';
  broadcastWs({ type: 'status', data: getStatusPayload() });
  addLog('[PocketCraft] Initiating server launch...');

  // Ensure eula.txt exists
  const eulaPath = path.join(SERVER_DIR, 'eula.txt');
  if (!fs.existsSync(eulaPath)) {
    fs.writeFileSync(eulaPath, 'eula=true\n');
  }

  // Check for server.jar
  const jarPath = path.join(SERVER_DIR, 'server.jar');
  if (!fs.existsSync(jarPath)) {
    addLog('[PocketCraft ERROR] server.jar not found in ' + SERVER_DIR);
    addLog('[PocketCraft] Run scripts/install.sh or download Purpur/Paper jar into the server folder.');
    serverStatus = 'OFFLINE';
    broadcastWs({ type: 'status', data: getStatusPayload() });
    return;
  }

  // Construct Java command with Aikar's optimized low-overhead flags
  const ramMb = config.ramAllocationMb || 3584;
  const javaArgs = [
    `-Xms${Math.min(1024, ramMb)}M`,
    `-Xmx${ramMb}M`,
    '-XX:+UseG1GC',
    '-XX:+ParallelRefProcEnabled',
    '-XX:MaxGCPauseMillis=200',
    '-XX:+UnlockExperimentalVMOptions',
    '-XX:+DisableExplicitGC',
    '-XX:+AlwaysPreTouch',
    '-XX:G1NewSizePercent=30',
    '-XX:G1MaxNewSizePercent=40',
    '-XX:G1ReservePercent=20',
    '-XX:G1HeapWastePercent=5',
    '-XX:G1MixedGCCountTarget=4',
    '-jar',
    'server.jar',
    'nogui'
  ];

  // If wake-on-demand is selected and lazymc binary is available
  const lazymcPath = path.join(BASE_DIR, 'lazymc') + (os.platform() === 'win32' ? '.exe' : '');
  const useLazymc = (config.mode === 'wake_on_demand') && fs.existsSync(lazymcPath);

  if (useLazymc) {
    addLog('[PocketCraft] Launching via lazymc (Wake-on-Demand mode active)');
    serverProcess = spawn(lazymcPath, ['--config', path.join(BASE_DIR, 'config', 'lazymc.toml')], {
      cwd: BASE_DIR,
      shell: false
    });
  } else {
    addLog(`[PocketCraft] Launching directly with OpenJDK (RAM: ${ramMb} MB)`);
    serverProcess = spawn('java', javaArgs, {
      cwd: SERVER_DIR,
      shell: false
    });
  }

  serverProcess.stdout.on('data', (data) => addLog(data.toString()));
  serverProcess.stderr.on('data', (data) => addLog(data.toString()));

  serverProcess.on('close', (code) => {
    addLog(`[PocketCraft] Server process terminated (exit code: ${code})`);
    serverProcess = null;
    serverStatus = 'OFFLINE';
    serverStartTime = null;
    onlinePlayers.clear();
    broadcastWs({ type: 'status', data: getStatusPayload() });
  });

  serverProcess.on('error', (err) => {
    addLog(`[PocketCraft ERROR] Failed to start server: ${err.message}`);
    serverProcess = null;
    serverStatus = 'OFFLINE';
    broadcastWs({ type: 'status', data: getStatusPayload() });
  });
}

function stopServer() {
  if (!serverProcess) {
    serverStatus = 'OFFLINE';
    broadcastWs({ type: 'status', data: getStatusPayload() });
    return;
  }

  serverStatus = 'STOPPING';
  broadcastWs({ type: 'status', data: getStatusPayload() });
  addLog('[PocketCraft] Gracefully stopping server (saving worlds)...');

  try {
    serverProcess.stdin.write('stop\n');
  } catch (err) {
    addLog('[PocketCraft] Forced process kill triggered');
    serverProcess.kill('SIGTERM');
  }

  // Safety force kill after 30 seconds if process hangs
  setTimeout(() => {
    if (serverProcess) {
      addLog('[PocketCraft] Force terminating unresponsive process...');
      serverProcess.kill('SIGKILL');
      serverProcess = null;
      serverStatus = 'OFFLINE';
      broadcastWs({ type: 'status', data: getStatusPayload() });
    }
  }, 30000);
}

function restartServer() {
  addLog('[PocketCraft] Restart initiated...');
  stopServer();
  const checkInterval = setInterval(() => {
    if (!serverProcess && serverStatus === 'OFFLINE') {
      clearInterval(checkInterval);
      setTimeout(startServer, 2000);
    }
  }, 1000);
}

function sendServerCommand(cmd) {
  if (!serverProcess) {
    addLog('[PocketCraft] Cannot send command: Server is not running.');
    return false;
  }
  addLog(`> ${cmd}`);
  try {
    serverProcess.stdin.write(cmd + '\n');
    return true;
  } catch (err) {
    addLog(`[PocketCraft ERROR] Failed to send command: ${err.message}`);
    return false;
  }
}

// Playit.gg Tunnel Management
function startPlayitTunnel() {
  const playitPath = path.join(BASE_DIR, 'playit') + (os.platform() === 'win32' ? '.exe' : '');
  if (!fs.existsSync(playitPath)) {
    config.tunnel.publicAddress = "playit binary not installed. Run install script.";
    return;
  }

  if (config.tunnel.publicAddress.includes('not installed')) {
    config.tunnel.publicAddress = "Connecting to tunnel network...";
  }

  addLog('[PocketCraft] Starting Playit.gg network tunnel...');
  tunnelProcess = spawn(playitPath, [], { cwd: BASE_DIR });

  tunnelProcess.stdout.on('data', (data) => {
    const text = data.toString();
    // Parse claim link
    const claimMatch = text.match(/(https:\/\/playit\.gg\/claim\/[a-zA-Z0-9]+)/);
    if (claimMatch) {
      config.tunnel.claimUrl = claimMatch[1];
      addLog(`[Playit] Setup required! Claim your tunnel at: ${config.tunnel.claimUrl}`);
      saveConfig();
      broadcastWs({ type: 'config', data: config });
    }

    // Parse tunnel address
    const addrMatch = text.match(/([a-zA-Z0-9_\-]+\.auto\.playit\.gg:[0-9]+)/);
    if (addrMatch) {
      config.tunnel.publicAddress = addrMatch[1];
      addLog(`[Playit] Public Join Address active: ${config.tunnel.publicAddress}`);
      saveConfig();
      broadcastWs({ type: 'config', data: config });
    }
  });

  tunnelProcess.stderr.on('data', (data) => {
    // Playit logs some notices on stderr
  });
}

// Scheduler Check (Runs every 60 seconds)
setInterval(() => {
  if (config.mode !== 'scheduled' || !config.schedule.enabled) return;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startH, startM] = config.schedule.startTime.split(':').map(Number);
  const [endH, endM] = config.schedule.endTime.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  const isWithinSchedule = currentMinutes >= startMinutes && currentMinutes < endMinutes;

  if (isWithinSchedule && serverStatus === 'OFFLINE') {
    addLog('[Scheduler] Scheduled operating window active. Starting server.');
    startServer();
  } else if (!isWithinSchedule && (serverStatus === 'ONLINE' || serverStatus === 'STARTING')) {
    addLog('[Scheduler] Scheduled operating window ended. Stopping server to save power.');
    stopServer();
  }
}, 60000);

// Express Web Application
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());
app.use(express.static(path.join(BASE_DIR, 'public')));

function getStatusPayload() {
  const uptimeSeconds = serverStartTime ? Math.floor((Date.now() - serverStartTime) / 1000) : 0;
  return {
    status: serverStatus,
    mode: config.mode,
    uptimeSeconds,
    onlinePlayers: Array.from(onlinePlayers),
    device: deviceStats,
    tunnel: config.tunnel,
    minecraftPort: config.minecraftPort,
    bedrockPort: config.bedrockPort,
    ramAllocationMb: config.ramAllocationMb
  };
}

function broadcastWs(msg) {
  const json = JSON.stringify(msg);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(json);
    }
  });
}

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'status', data: getStatusPayload() }));
  ws.send(JSON.stringify({ type: 'logs', data: logHistory }));
  ws.send(JSON.stringify({ type: 'config', data: config }));

  ws.on('message', (message) => {
    try {
      const parsed = JSON.parse(message);
      if (parsed.type === 'command') {
        sendServerCommand(parsed.data);
      }
    } catch (_) { }
  });
});

// REST API Endpoints
app.get('/api/status', (req, res) => res.json(getStatusPayload()));
app.get('/api/config', (req, res) => res.json(config));

// Helper to sync server.properties
function updateServerProperty(key, value) {
  const propFile = path.join(SERVER_DIR, 'server.properties');
  if (fs.existsSync(propFile)) {
    let content = fs.readFileSync(propFile, 'utf8');
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`);
    } else {
      content += `\n${key}=${value}`;
    }
    fs.writeFileSync(propFile, content);
  }
}

app.post('/api/config', (req, res) => {
  try {
    const updates = req.body;
    config = { ...config, ...updates };

    if (updates.onlineMode !== undefined) {
      updateServerProperty('online-mode', updates.onlineMode ? 'true' : 'false');
    }
    if (updates.serverName) {
      updateServerProperty('motd', updates.serverName);
    }

    saveConfig();
    broadcastWs({ type: 'config', data: config });
    broadcastWs({ type: 'status', data: getStatusPayload() });
    res.json({ success: true, config });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/action', (req, res) => {
  const { action } = req.body;
  if (action === 'start') startServer();
  else if (action === 'stop') stopServer();
  else if (action === 'restart') restartServer();
  else return res.status(400).json({ error: 'Unknown action' });

  res.json({ success: true, action, status: serverStatus });
});

app.post('/api/command', (req, res) => {
  const { command } = req.body;
  if (!command) return res.status(400).json({ error: 'Command required' });
  const ok = sendServerCommand(command);
  res.json({ success: ok });
});

app.get('/api/logs', (req, res) => res.json(logHistory));

// Start Web Server
const PORT = config.webPort || 8080;
server.listen(PORT, '0.0.0.0', () => {
  console.log('====================================================');
  console.log(` PocketCraft Web Manager running on:`);
  console.log(` Local:   http://localhost:${PORT}`);
  for (const ip of deviceStats.localIps) {
    console.log(` Network: http://${ip.address}:${PORT}`);
  }
  console.log('====================================================');

  // Start tunnel if enabled
  if (config.tunnel.enabled) {
    startPlayitTunnel();
  }
});

