/**
 * AetherMic Host Receiver Console Client
 * Real-time audio reception, AudioContext timeline scheduling, and 30-Bar Segmented VU Meter
 */

(function () {
  'use strict';

  // State
  let socket = null;
  let audioContext = null;
  let masterGain = null;
  let analyser = null;
  let nextPlayTime = 0;
  let isMuted = false;
  let currentVolume = 1.0;
  let isAudioUnlocked = false;
  let activeSpeaker = null;
  let speakerTimerInterval = null;
  let speakerSeconds = 0;
  let animationFrameId = null;

  // Visualizer data
  let timeDomainData = null;
  let frequencyData = null;

  // DOM Elements
  const audioInitBanner = document.getElementById('audioInitBanner');
  const audioInitBtn = document.getElementById('audioInitBtn');
  const hostStatusDot = document.getElementById('hostStatusDot');
  const hostStatusText = document.getElementById('hostStatusText');
  const studentCountBadge = document.getElementById('studentCountBadge');
  const speakerStage = document.getElementById('speakerStage');
  const speakerName = document.getElementById('speakerName');
  const speakerMeta = document.getElementById('speakerMeta');
  const speakerTimer = document.getElementById('speakerTimer');
  const overrideBtn = document.getElementById('overrideBtn');
  const canvas = document.getElementById('audioVisualizer');
  const canvasCtx = canvas.getContext('2d');
  const hostVuTrack = document.getElementById('hostVuTrack');
  const vuMeterVal = document.getElementById('vuMeterVal');
  const volumeSlider = document.getElementById('volumeSlider');
  const volumeValueLabel = document.getElementById('volumeValueLabel');
  const muteToggleBtn = document.getElementById('muteToggleBtn');
  const qrImage = document.getElementById('qrImage');
  const studentUrlText = document.getElementById('studentUrlText');
  const copyUrlBtn = document.getElementById('copyUrlBtn');
  const historyList = document.getElementById('historyList');
  const historyEmpty = document.getElementById('historyEmpty');
  const clearLogBtn = document.getElementById('clearLogBtn');

  // Build 30-Bar Hardware Segmented VU Meter
  const HOST_SEGMENTS = 30;
  const hostLedElements = [];
  let lastRenderedHostCount = -1;
  let lastDbString = '';

  function initHostVuMeter() {
    hostVuTrack.innerHTML = '';
    hostLedElements.length = 0;
    for (let i = 0; i < HOST_SEGMENTS; i++) {
      const seg = document.createElement('div');
      seg.className = 'host-led-seg';
      if (i < 18) {
        seg.classList.add('green');
      } else if (i < 25) {
        seg.classList.add('amber');
      } else {
        seg.classList.add('red');
      }
      hostVuTrack.appendChild(seg);
      hostLedElements.push(seg);
    }
  }

  function setHostVuPercent(percent) {
    const activeCount = Math.round((percent / 100) * HOST_SEGMENTS);
    if (activeCount !== lastRenderedHostCount) {
      lastRenderedHostCount = activeCount;
      for (let i = 0; i < HOST_SEGMENTS; i++) {
        if (i < activeCount) {
          if (!hostLedElements[i].classList.contains('lit')) {
            hostLedElements[i].classList.add('lit');
          }
        } else {
          if (hostLedElements[i].classList.contains('lit')) {
            hostLedElements[i].classList.remove('lit');
          }
        }
      }
    }

    const dbVal = percent <= 0 ? -999 : Math.round(-40 + (percent * 0.46));
    const newDbText = dbVal === -999 ? '-INF dB' : `${dbVal > 0 ? '+' : ''}${dbVal} dB`;
    if (newDbText !== lastDbString) {
      lastDbString = newDbText;
      vuMeterVal.textContent = newDbText;
    }
  }

  // Sharp Canvas Resizing with Cached Dimensions (Prevents 60 FPS layout thrashing)
  let cachedCanvasWidth = 0;
  let cachedCanvasHeight = 0;

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    cachedCanvasWidth = rect.width;
    cachedCanvasHeight = rect.height;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvasCtx.scale(dpr, dpr);
  }
  window.addEventListener('resize', resizeCanvas);

  // Initialize Web Audio Engine
  function initAudioEngine() {
    if (audioContext) {
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      isAudioUnlocked = true;
      audioInitBanner.style.display = 'none';
      return;
    }

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioCtx();

    // Master Gain for volume & mute
    masterGain = audioContext.createGain();
    masterGain.gain.value = currentVolume;

    // Analyser Node for Visualizer
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.8;

    timeDomainData = new Uint8Array(analyser.fftSize);
    frequencyData = new Uint8Array(analyser.frequencyBinCount);

    // Audio routing: Chunks -> MasterGain -> Analyser -> Output Speakers
    masterGain.connect(analyser);
    analyser.connect(audioContext.destination);

    nextPlayTime = audioContext.currentTime;
    isAudioUnlocked = true;
    audioInitBanner.style.display = 'none';

    // Start 60 FPS Visualizer render loop
    startVisualizer();
  }

  // Active Playout Source Tracking & Instant Queue Flusher
  const activeSourceNodes = new Set();
  const TARGET_JITTER_BUFFER = 0.040; // 40ms optimal lookahead buffer (keeps total latency ~75-85ms)
  const MAX_PLAYOUT_LATENCY = 0.120;  // 120ms max queue lag ceiling

  function flushAudioBuffer() {
    for (const src of activeSourceNodes) {
      try {
        src.stop();
        src.disconnect();
      } catch (e) {}
    }
    activeSourceNodes.clear();
    nextPlayTime = 0;
    if (window.AetherAudio && window.AetherAudio.resetSmoothing) {
      window.AetherAudio.resetSmoothing();
    }
  }

  // Audio Chunk Scheduler (Jitter-Proof, Gapless Playout Pipeline)
  function playPcmChunk(rawBuffer) {
    if (!audioContext || audioContext.state !== 'running') {
      return;
    }

    const int16 = new Int16Array(rawBuffer);
    if (int16.length === 0) return;

    // Convert Int16 to Float32
    const float32 = window.AetherAudio.int16ToFloat(int16);

    // Apply micro crossfade to chunk boundaries to prevent clipping clicks & step discontinuities
    if (window.AetherAudio && window.AetherAudio.smoothChunkBoundaries) {
      window.AetherAudio.smoothChunkBoundaries(float32);
    }

    const audioBuffer = audioContext.createBuffer(1, float32.length, 16000);
    audioBuffer.getChannelData(0).set(float32);

    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(masterGain);

    const now = audioContext.currentTime;
    let startAt;

    if (nextPlayTime <= now) {
      // Buffer underrun or initial packet: reset smoothing to ramp up cleanly from silence
      if (window.AetherAudio && window.AetherAudio.resetSmoothing) {
        window.AetherAudio.resetSmoothing();
      }
      startAt = now + TARGET_JITTER_BUFFER;
      nextPlayTime = startAt + audioBuffer.duration;
    } else if (nextPlayTime - now > MAX_PLAYOUT_LATENCY) {
      // Network stall backlog burst: drop old backlog cleanly without overlapping voices
      for (const src of activeSourceNodes) {
        try {
          src.stop();
          src.disconnect();
        } catch (e) {}
      }
      activeSourceNodes.clear();

      startAt = now + 0.025; // Snap cleanly to live voice
      nextPlayTime = startAt + audioBuffer.duration;
    } else {
      // Healthy queue: seamless gapless concatenation
      startAt = nextPlayTime;
      nextPlayTime += audioBuffer.duration;
    }

    source.start(startAt);

    activeSourceNodes.add(source);
    source.onended = () => {
      activeSourceNodes.delete(source);
    };
  }

  // 60 FPS Real-time Oscilloscope & Segmented VU Meter Loop
  function startVisualizer() {
    function render() {
      animationFrameId = requestAnimationFrame(render);
      if (!analyser) return;

      analyser.getByteTimeDomainData(timeDomainData);
      analyser.getByteFrequencyData(frequencyData);

      const width = cachedCanvasWidth || canvas.width;
      const height = cachedCanvasHeight || canvas.height;

      canvasCtx.clearRect(0, 0, width, height);

      // Dark raster grid lines
      canvasCtx.strokeStyle = 'rgba(48, 54, 61, 0.35)';
      canvasCtx.lineWidth = 1;
      canvasCtx.beginPath();
      // Center horizontal line
      canvasCtx.moveTo(0, height / 2);
      canvasCtx.lineTo(width, height / 2);
      // Top and bottom 25% raster lines
      canvasCtx.moveTo(0, height * 0.25);
      canvasCtx.lineTo(width, height * 0.25);
      canvasCtx.moveTo(0, height * 0.75);
      canvasCtx.lineTo(width, height * 0.75);
      canvasCtx.stroke();

      // Waveform line: Studio Amber / Safety Red
      const isSpeaking = !!activeSpeaker;
      const waveColor = isSpeaking ? '#ef4444' : '#f59e0b';

      canvasCtx.lineWidth = 2;
      canvasCtx.strokeStyle = waveColor;
      canvasCtx.shadowBlur = 0; // Disable heavy blur filter to preserve 60 FPS without GPU lag
      canvasCtx.beginPath();

      const step = 2;
      const sliceWidth = (width / timeDomainData.length) * step;
      let x = 0;

      for (let i = 0; i < timeDomainData.length; i += step) {
        const v = timeDomainData[i] / 128.0;
        const y = (v * height) / 2;

        if (i === 0) {
          canvasCtx.moveTo(x, y);
        } else {
          canvasCtx.lineTo(x, y);
        }
        x += sliceWidth;
      }
      canvasCtx.stroke();

      // Peak amplitude calculation with dirty check
      let maxAmp = 0;
      for (let i = 0; i < timeDomainData.length; i += step) {
        const deviation = Math.abs(timeDomainData[i] - 128);
        if (deviation > maxAmp) {
          maxAmp = deviation;
        }
      }

      let vuPercent = Math.min(100, Math.round((maxAmp / 100) * 100));
      if (!isSpeaking || isMuted) {
        vuPercent = 0;
      }

      setHostVuPercent(vuPercent);
    }

    render();
  }

  // Socket.io Connection & Events
  function initSocket() {
    socket = io({
      transports: ['websocket', 'polling']
    });
    socket.binaryType = 'arraybuffer';

    socket.on('connect', () => {
      hostStatusDot.style.background = '#22c55e';
      hostStatusDot.style.boxShadow = '0 0 8px rgba(34, 197, 94, 0.4)';
      hostStatusText.textContent = 'SERVER ONLINE';
      socket.emit('register_host');
    });

    socket.on('disconnect', () => {
      hostStatusDot.style.background = '#ef4444';
      hostStatusDot.style.boxShadow = 'none';
      hostStatusText.textContent = 'DISCONNECTED';
      setSpeakerInactive();
    });

    socket.on('audience_count', (count) => {
      studentCountBadge.textContent = `${count} ${count === 1 ? 'OPERATOR' : 'OPERATORS'} ONLINE`;
    });

    socket.on('line_busy', (data) => {
      setSpeakerActive(data.studentName || 'Student', data.studentId);
    });

    socket.on('line_free', () => {
      setSpeakerInactive();
    });

    socket.on('audio_chunk', (chunk) => {
      if (!isMuted) {
        playPcmChunk(chunk);
      }
    });
  }

  // Speaker UI State Handlers
  function setSpeakerActive(name, id) {
    flushAudioBuffer(); // Clean slate for new speaker
    activeSpeaker = { name, id };
    speakerStage.classList.add('active');
    speakerName.textContent = name.toUpperCase();
    speakerMeta.textContent = 'TRANSMISSION ENGAGED // RECEIVING AUDIO (16kHz PCM)';
    overrideBtn.style.display = 'inline-flex';

    speakerSeconds = 0;
    speakerTimer.textContent = '00:00';
    clearInterval(speakerTimerInterval);
    speakerTimerInterval = setInterval(() => {
      speakerSeconds++;
      const m = String(Math.floor(speakerSeconds / 60)).padStart(2, '0');
      const s = String(speakerSeconds % 60).padStart(2, '0');
      speakerTimer.textContent = `${m}:${s}`;
    }, 1000);
  }

  function setSpeakerInactive() {
    if (activeSpeaker && speakerSeconds > 0) {
      addHistoryItem(activeSpeaker.name, speakerSeconds);
    }
    activeSpeaker = null;
    speakerStage.classList.remove('active');
    speakerName.textContent = 'CHANNEL IDLE';
    speakerMeta.textContent = 'Awaiting student transmission lock...';
    speakerTimer.textContent = '00:00';
    overrideBtn.style.display = 'none';
    clearInterval(speakerTimerInterval);
    flushAudioBuffer();
    setHostVuPercent(0);
  }

  function addHistoryItem(name, durationSecs) {
    if (historyEmpty) {
      historyEmpty.style.display = 'none';
    }

    const row = document.createElement('div');
    row.className = 'history-row';

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

    row.innerHTML = `
      <div class="history-left">
        <span class="history-time-stamp">[${timeStr}]</span>
        <span class="history-speaker">${name}</span>
      </div>
      <span class="history-duration-badge">${durationSecs}s</span>
    `;

    historyList.insertBefore(row, historyList.firstChild);
  }

  if (clearLogBtn) {
    clearLogBtn.addEventListener('click', () => {
      historyList.innerHTML = '';
      if (historyEmpty) {
        historyEmpty.style.display = 'block';
        historyList.appendChild(historyEmpty);
      }
    });
  }

  // Controls Handlers
  audioInitBtn.addEventListener('click', () => {
    initAudioEngine();
  });

  volumeSlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    currentVolume = val / 100;
    volumeValueLabel.textContent = `${val}%`;
    if (masterGain && !isMuted) {
      masterGain.gain.setValueAtTime(currentVolume, audioContext.currentTime);
    }
  });

  muteToggleBtn.addEventListener('click', () => {
    isMuted = !isMuted;
    if (isMuted) {
      muteToggleBtn.classList.add('muted');
      muteToggleBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="1" y1="1" x2="23" y2="23"/>
          <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
          <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/>
          <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
        </svg>
        <span>MUTED</span>
      `;
      flushAudioBuffer();
      if (masterGain) {
        masterGain.gain.setValueAtTime(0, audioContext.currentTime);
      }
    } else {
      muteToggleBtn.classList.remove('muted');
      muteToggleBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
        </svg>
        <span>MUTE AUDIO</span>
      `;
      if (masterGain) {
        masterGain.gain.setValueAtTime(currentVolume, audioContext.currentTime);
      }
    }
  });

  overrideBtn.addEventListener('click', () => {
    if (socket && socket.connected) {
      socket.emit('force_release_line');
    }
    setSpeakerInactive();
  });

  // Fetch Server Info & Dynamic QR Code
  async function loadServerInfo() {
    try {
      const res = await fetch('/api/info');
      const data = await res.json();
      if (data.studentUrl) {
        studentUrlText.textContent = data.studentUrl;
      }
      if (data.qrDataUrl) {
        qrImage.src = data.qrDataUrl;
      }
    } catch (err) {
      console.error('Failed to load server info:', err);
    }
  }

  copyUrlBtn.addEventListener('click', async () => {
    const url = studentUrlText.textContent;
    try {
      await navigator.clipboard.writeText(url);
      copyUrlBtn.textContent = 'COPIED TO CLIPBOARD!';
      setTimeout(() => {
        copyUrlBtn.textContent = 'COPY LINK TO CLIPBOARD';
      }, 2000);
    } catch (err) {
      console.warn('Clipboard write failed:', err);
    }
  });

  // Startup
  initHostVuMeter();
  resizeCanvas();
  loadServerInfo();
  initSocket();

  // Try auto-unlocking AudioContext if page was interacted with
  document.body.addEventListener('click', () => {
    if (!isAudioUnlocked) {
      initAudioEngine();
    }
  }, { once: true });
})();
