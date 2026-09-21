/**
 * AetherMic Server
 * Real-Time Local Wi-Fi Walkie-Talkie for Lecture Halls
 * Node.js, Express, HTTPS with dynamic selfsigned certs, Socket.io, & Single-Speaker Mutex
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const os = require('os');
const express = require('express');
const { Server } = require('socket.io');
const cors = require('cors');
const qrcode = require('qrcode');
const selfsigned = require('selfsigned');

const PORT = process.env.PORT || 3000;
const SSL_DIR = path.join(__dirname, 'ssl');
const CERT_PATH = path.join(SSL_DIR, 'cert.pem');
const KEY_PATH = path.join(SSL_DIR, 'key.pem');

// 1. Detect Local Physical IPv4 Network Interface
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  const candidateIps = [];

  for (const name of Object.keys(interfaces)) {
    // Skip virtual adapters if possible
    const lowerName = name.toLowerCase();
    const isVirtual = lowerName.includes('virtual') || 
                      lowerName.includes('vethernet') || 
                      lowerName.includes('wsl') || 
                      lowerName.includes('docker') || 
                      lowerName.includes('vmware') || 
                      lowerName.includes('loopback');

    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        if (!isVirtual) {
          // Prioritize standard local subnets (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
          if (iface.address.startsWith('192.168.') || iface.address.startsWith('10.')) {
            return iface.address;
          }
          candidateIps.push(iface.address);
        } else {
          candidateIps.push(iface.address);
        }
      }
    }
  }

  return candidateIps.length > 0 ? candidateIps[0] : 'localhost';
}

const LOCAL_IP = getLocalIpAddress();

// 2. Ensure SSL / TLS Certificates for Mobile Browser Microphone Access
function getSslCredentials() {
  if (!fs.existsSync(SSL_DIR)) {
    fs.mkdirSync(SSL_DIR, { recursive: true });
  }

  if (fs.existsSync(CERT_PATH) && fs.existsSync(KEY_PATH)) {
    console.log('[SSL] Loading cached self-signed HTTPS certificate...');
    return {
      key: fs.readFileSync(KEY_PATH),
      cert: fs.readFileSync(CERT_PATH)
    };
  }

  console.log('[SSL] Generating dynamic self-signed certificate for local IP:', LOCAL_IP);
  const attrs = [
    { name: 'commonName', value: LOCAL_IP },
    { name: 'organizationName', value: 'AetherMic Local Network' },
    { shortName: 'OU', value: 'Lecture Hall Walkie-Talkie' }
  ];

  // Include IP and localhost in Subject Alternative Names (SAN)
  const pems = selfsigned.generate(attrs, {
    days: 365,
    keySize: 2048,
    algorithm: 'sha256',
    extensions: [
      {
        name: 'subjectAltName',
        altNames: [
          { type: 2, value: 'localhost' },
          { type: 7, ip: LOCAL_IP },
          { type: 7, ip: '127.0.0.1' }
        ]
      }
    ]
  });

  fs.writeFileSync(CERT_PATH, pems.cert, 'utf8');
  fs.writeFileSync(KEY_PATH, pems.private, 'utf8');
  console.log('[SSL] Certificate successfully generated and cached in ./ssl');

  return {
    key: pems.private,
    cert: pems.cert
  };
}

const sslCredentials = getSslCredentials();

// 3. Express App Setup
const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const studentUrl = `https://${LOCAL_IP}:${PORT}/student`;
const hostUrl = `https://${LOCAL_IP}:${PORT}/host`;

// Pre-generate QR Code Data URL
let cachedQrDataUrl = '';
qrcode.toDataURL(studentUrl, {
  width: 320,
  margin: 2,
  color: {
    dark: '#0f172a',
    light: '#ffffff'
  }
}).then(url => {
  cachedQrDataUrl = url;
}).catch(err => {
  console.error('[QR] Error generating QR code:', err);
});

// REST API
app.get('/api/info', (req, res) => {
  res.json({
    localIp: LOCAL_IP,
    port: PORT,
    studentUrl,
    hostUrl,
    qrDataUrl: cachedQrDataUrl
  });
});

app.get('/api/qr', async (req, res) => {
  try {
    const qrBuffer = await qrcode.toBuffer(studentUrl, { type: 'png', width: 400, margin: 2 });
    res.type('image/png').send(qrBuffer);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate QR' });
  }
});

app.get('/student', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'student.html'));
});

app.get('/host', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'host.html'));
});

app.get('/presentation', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'presentation.html'));
});

app.get('/AetherMic_Presentation.pptx', (req, res) => {
  res.download(path.join(__dirname, 'AetherMic_Presentation.pptx'));
});

const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#f59e0b"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2" fill="none" stroke="#f59e0b" stroke-width="2"/><line x1="12" y1="19" x2="12" y2="23" stroke="#f59e0b" stroke-width="2"/><line x1="8" y1="23" x2="16" y2="23" stroke="#f59e0b" stroke-width="2"/></svg>`;

app.get('/favicon.ico', (req, res) => {
  res.type('image/svg+xml').send(FAVICON_SVG);
});

app.get('/favicon.svg', (req, res) => {
  res.type('image/svg+xml').send(FAVICON_SVG);
});

// Default root serves student UI
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 4. HTTPS Server & Socket.io
const server = https.createServer(sslCredentials, app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  perMessageDeflate: false,
  httpCompression: false,
  maxHttpBufferSize: 1e7 // 10MB
});

// Concurrency Mutex & Room State
let currentSpeaker = null; // { socketId, studentId, studentName, startedAt, timer }
const connectedStudents = new Map(); // socketId -> { studentId, studentName }
const connectedHosts = new Set(); // socketId

function broadcastAudienceCount() {
  io.emit('audience_count', connectedStudents.size);
}

function releaseLine() {
  if (currentSpeaker) {
    if (currentSpeaker.timer) {
      clearTimeout(currentSpeaker.timer);
    }
    const freedSpeaker = currentSpeaker;
    currentSpeaker = null;
    io.emit('line_free');
    console.log(`[MUTEX] Line released. Channel is now IDLE (previously: ${freedSpeaker.studentName})`);
  }
}

io.on('connection', (socket) => {
  // Student registration
  socket.on('register_student', (data) => {
    socket.join('students');
    const studentName = (data && data.studentName && data.studentName.trim()) 
      ? data.studentName.trim() 
      : 'Anonymous Operator';
    const studentId = (data && data.studentId) || socket.id;

    connectedStudents.set(socket.id, {
      studentId,
      studentName
    });
    broadcastAudienceCount();

    // Send current channel state to newly connected student
    if (currentSpeaker) {
      socket.emit('line_busy', {
        studentId: currentSpeaker.studentId,
        studentName: currentSpeaker.studentName
      });
    } else {
      socket.emit('line_free');
    }
  });

  // Host registration
  socket.on('register_host', () => {
    socket.join('hosts');
    connectedHosts.add(socket.id);
    socket.emit('audience_count', connectedStudents.size);

    if (currentSpeaker) {
      socket.emit('line_busy', {
        studentId: currentSpeaker.studentId,
        studentName: currentSpeaker.studentName
      });
    } else {
      socket.emit('line_free');
    }
  });

  // Student profile update
  socket.on('update_profile', (data) => {
    if (data && data.studentName) {
      const sanitizedName = data.studentName.trim();
      if (connectedStudents.has(socket.id)) {
        const info = connectedStudents.get(socket.id);
        info.studentName = sanitizedName;
      }
      if (currentSpeaker && currentSpeaker.socketId === socket.id) {
        currentSpeaker.studentName = sanitizedName;
        io.emit('line_busy', {
          studentId: currentSpeaker.studentId,
          studentName: currentSpeaker.studentName
        });
      }
    }
  });

  // Single-Speaker Mutex: Request to speak
  socket.on('request_line', (data) => {
    const studentInfo = connectedStudents.get(socket.id) || data || {};
    const name = (data && data.studentName && data.studentName.trim()) || studentInfo.studentName || 'Student';

    if (connectedStudents.has(socket.id)) {
      connectedStudents.get(socket.id).studentName = name;
    }

    if (currentSpeaker === null) {
      // Grant Mutex
      console.log(`[MUTEX] Granted line to: ${name} (${socket.id})`);

      // 60-second safety watchdog
      const timer = setTimeout(() => {
        if (currentSpeaker && currentSpeaker.socketId === socket.id) {
          console.log(`[WATCHDOG] Max transmission limit (60s) reached for: ${name}. Releasing line.`);
          socket.emit('line_revoked', { reason: 'Maximum speech duration (60s) reached' });
          releaseLine();
        }
      }, 60000);

      currentSpeaker = {
        socketId: socket.id,
        studentId: studentInfo.studentId,
        studentName: name,
        startedAt: Date.now(),
        timer
      };

      // Notify requester
      socket.emit('line_granted');

      // Broadcast busy state to all other students & hosts
      socket.broadcast.emit('line_busy', {
        studentId: currentSpeaker.studentId,
        studentName: currentSpeaker.studentName
      });
    } else {
      // Channel is currently occupied
      console.log(`[MUTEX] Denied line to: ${name} - Channel in use by: ${currentSpeaker.studentName}`);
      socket.emit('line_denied', {
        reason: `Channel busy: ${currentSpeaker.studentName} is speaking`,
        currentSpeaker: {
          studentName: currentSpeaker.studentName
        }
      });
    }
  });

  // Student voluntarily releases line
  socket.on('release_line', () => {
    if (currentSpeaker && currentSpeaker.socketId === socket.id) {
      releaseLine();
    }
  });

  // Professor Host forcibly overrides/releases line
  socket.on('force_release_line', () => {
    if (currentSpeaker) {
      console.log(`[HOST OVERRIDE] Professor released channel from: ${currentSpeaker.studentName}`);
      io.to(currentSpeaker.socketId).emit('line_revoked', {
        reason: 'Professor ended transmission'
      });
      releaseLine();
    }
  });

  // Audio Chunk Relay (Only transmitted from authorized lock holder -> Hosts only)
  socket.on('audio_chunk', (chunk) => {
    if (currentSpeaker && currentSpeaker.socketId === socket.id) {
      // Forward binary chunk strictly to hosts (never back to students) with guaranteed in-order delivery
      io.to('hosts').emit('audio_chunk', chunk);
    }
  });

  // Disconnection cleanup
  socket.on('disconnect', () => {
    if (connectedStudents.has(socket.id)) {
      connectedStudents.delete(socket.id);
      broadcastAudienceCount();
    }
    if (connectedHosts.has(socket.id)) {
      connectedHosts.delete(socket.id);
    }

    // If the active speaker disconnects unexpectedly, instantly free the line
    if (currentSpeaker && currentSpeaker.socketId === socket.id) {
      console.log(`[MUTEX] Active speaker disconnected abruptly. Auto-releasing line.`);
      releaseLine();
    }
  });
});

// 5. Start Server & Print Terminal Instructions
server.listen(PORT, '0.0.0.0', async () => {
  console.log('\n' + '='.repeat(64));
  console.log('       🎙️  AETHERMIC LOCAL WI-FI WALKIE-TALKIE SERVER');
  console.log('='.repeat(64));
  console.log(`  Local IP Detected : ${LOCAL_IP}`);
  console.log(`  Port              : ${PORT}`);
  console.log(`  HTTPS Status      : SECURE (Self-Signed SSL Active)`);
  console.log('-'.repeat(64));
  console.log(`  📢 Professor Host : ${hostUrl}`);
  console.log(`  📱 Student Mobile : ${studentUrl}`);
  console.log('-'.repeat(64));
  console.log('  📲 SCAN QR CODE WITH MOBILE PHONE TO JOIN:');

  try {
    const terminalQr = await qrcode.toString(studentUrl, { type: 'terminal', small: true });
    console.log(terminalQr);
  } catch (err) {
    // Terminal QR optional
  }

  console.log('='.repeat(64));
  console.log('  🛡️  FIRST-TIME MOBILE BROWSER SSL INSTRUCTIONS:');
  console.log('  Because modern mobile browsers require HTTPS for microphone access:');
  console.log('  • Apple Safari (iOS):');
  console.log('    Tap "Show Details" at bottom -> tap "visit this website"');
  console.log('  • Google Chrome (Android / Desktop):');
  console.log('    Tap "Advanced" -> tap "Proceed to 192.168.x.x (unsafe)"');
  console.log('='.repeat(64) + '\n');
});
