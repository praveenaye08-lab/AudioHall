# 🎙️ AetherMic: Real-Time Local Wi-Fi Walkie-Talkie

A high-performance, zero-internet, real-time push-to-talk (PTT) web application designed for large lecture halls. It enables back-bench college students to speak directly through the professor's front-room computer and speakers using their mobile phones over the local Wi-Fi network.

---

## 🌟 Key Features

- **Zero External Internet Required**: Runs 100% locally over LAN / Wi-Fi.
- **Auto Self-Signed SSL**: Modern mobile browsers (iOS Safari & Android Chrome) block microphone access (`getUserMedia`) over unencrypted HTTP. AetherMic dynamically generates and caches local SSL certificates so microphones work seamlessly.
- **Single-Speaker Concurrency Mutex**:
  - Only one student can transmit audio at any given time.
  - When Student A speaks, all other students' buttons instantly switch to a locked amber/red "Channel Busy" state.
- **Ultra-Low Latency Audio Engine**:
  - Downsampled 16kHz mono 16-bit PCM streaming over binary WebSockets (Socket.io).
  - High-precision Web Audio API timeline scheduling on the Host.
  - Sub-100ms end-to-end latency with zero audio drift or stuttering.
- **Realistic Walkie-Talkie Audio Effects**:
  - Synthesized dual-tone key-up radio chirp when transmission begins.
  - Classic "Roger beep" audio confirmation on release.
  - Low error bonk when the line is busy.
- **60 FPS Real-Time Visualizer**:
  - Oscilloscope waveform and peak VU meter rendered at 60 FPS on HTML5 Canvas.
- **Professor / Host Command Center (`/host`)**:
  - Dynamic QR code for instant phone camera scanning.
  - Real-time connected students counter.
  - Master mute switch and 0%-200% volume booster.
  - Emergency channel override ("Force Release Mic").
  - **Live Question & Transmission History Log**: Records student name, duration, and timestamp of every question asked.
- **Student Mobile Interface (`/student` or `/`)**:
  - High-contrast OLED dark mode with iOS notch / safe-area insets.
  - Dual modes: **Press & Hold (PTT)** or **Tap-to-Talk (Toggle)**.
  - Vivid ripple waves, live VU meter, and haptic feedback.
  - Zero acoustic feedback (students never receive audio back to their speakers).

---

## 🚀 Quick Start

### Option A: 1-Click Launchers (Windows)
Double-click either launcher script in the project directory:
- `start.bat` (Command Prompt)
- `start.ps1` (PowerShell)

### Option B: Terminal Command

```bash
# Navigate to the project directory
cd e:\AetherMic

# Install dependencies (Express, Socket.io, Selfsigned, QRCode, CORS)
npm install

# Start the server
npm start
```

---

## 📡 Connecting in the Classroom

1. **Professor**: Open `https://localhost:3000/host` on the classroom computer connected to the speakers.
   - Click **"Enable Audio Output"** to activate the audio engine.
2. **Students**: Scan the on-screen QR code from a mobile phone camera on the same Wi-Fi, or open:
   ```
   https://<YOUR_LOCAL_IP>:3000/student
   ```

---

## 🛡️ Accepting the Self-Signed Certificate on Mobile

Because mobile browsers mandate HTTPS for microphone access on non-localhost IP addresses, students will see a one-time local security alert:

- **Apple Safari (iOS / iPhone)**:
  1. Tap **"Show Details"** at the bottom.
  2. Tap **"visit this website"** -> tap **"Visit Website"** in the popup.
  3. Tap **"Allow"** when prompted for microphone access.
- **Google Chrome (Android / Desktop)**:
  1. Tap **"Advanced"**.
  2. Tap **"Proceed to 192.168.x.x (unsafe)"**.
  3. Tap **"Allow"** when prompted for microphone access.

---

## 📂 Project Structure

```
e:\AetherMic\
├── server.js                      # HTTPS server, IP detection, dynamic SSL, single-speaker mutex
├── package.json                   # Dependencies, scripts, and configuration
├── start.bat                      # 1-Click Windows Batch launcher
├── start.ps1                      # 1-Click PowerShell launcher
├── test-audio.js                  # Unit tests for PCM downsampler, converters, and RMS
├── test-e2e.js                    # End-to-end integration test suite
├── ssl/                           # Auto-generated cert.pem & key.pem (created on first run)
└── public/
    ├── index.html                 # Student mobile PTT interface
    ├── student.html               # Dedicated /student endpoint
    ├── host.html                  # Professor dashboard & visualizer
    ├── favicon.svg                # Microphone vector favicon
    ├── css/
    │   ├── student.css            # Mobile dark mode, ripple animations, tactile buttons, safe-area insets
    │   └── host.css               # Command-center dashboard, visualizer, & history log styles
    └── js/
        ├── audio-processor.js     # PCM downsampler, converter, and synthesized radio chimes
        ├── audio-worklet-processor.js # Modern AudioWorklet thread processor
        ├── student.js             # Student mic capture, PTT state machine, Socket.io client
        └── host.js                # Host audio scheduler, 60 FPS Canvas wave, VU meter, & history log
```

---

## 🧪 Running Automated Tests

```bash
# Run both unit and E2E integration test suites
npm test

# Run audio processor unit tests only
npm run test:audio

# Run end-to-end socket & mutex tests only
npm run test:e2e
```
