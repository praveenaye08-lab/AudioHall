/**
 * AetherMic Student Audio Transmitter
 * Industrial Studio Hardware Controller
 */

(function () {
  'use strict';

  // State
  let socket = null;
  let audioContext = null;
  let mediaStream = null;
  let scriptProcessor = null;
  let isTransmitting = false;
  let isRequesting = false;
  let isLineBusy = false;
  let currentSpeakerName = '';
  let pttMode = 'hold'; // 'hold' (Momentary) or 'toggle' (Latched)
  let isToggledOn = false;
  let transmitTimerInterval = null;
  let transmitSeconds = 0;

  // Student Identity State
  const studentId = localStorage.getItem('aether_student_id') || ('std_' + Math.random().toString(36).substring(2, 9));
  localStorage.setItem('aether_student_id', studentId);

  let studentName = localStorage.getItem('aether_student_name') || '';

  // DOM Elements
  const headerOperatorName = document.getElementById('headerOperatorName');
  const editNameBtn = document.getElementById('editNameBtn');
  const rfStatusLed = document.getElementById('rfStatusLed');
  const rfStatusLabel = document.getElementById('rfStatusLabel');
  const modeHoldBtn = document.getElementById('modeHold');
  const modeToggleBtn = document.getElementById('modeToggle');
  const statusBanner = document.getElementById('statusBanner');
  const statusTitle = document.getElementById('statusTitle');
  const statusSubtitle = document.getElementById('statusSubtitle');
  const statusTag = document.getElementById('statusTag');
  const micSection = document.getElementById('micSection');
  const pttButton = document.getElementById('pttButton');
  const pttText = document.getElementById('pttText');
  const pttSubtext = document.getElementById('pttSubtext');
  const studentVuWrapper = document.getElementById('studentVuWrapper');
  const ledSegmentsContainer = document.getElementById('ledSegments');
  const liveTimer = document.getElementById('liveTimer');
  const onboardingModal = document.getElementById('onboardingModal');
  const onboardingForm = document.getElementById('onboardingForm');
  const inputOperatorName = document.getElementById('inputOperatorName');
  const inputOperatorSeat = document.getElementById('inputOperatorSeat');
  const permModal = document.getElementById('permModal');
  const grantPermBtn = document.getElementById('grantPermBtn');

  // Build 24-Segment Hardware LED Meter with Decoupled rAF Rendering
  const TOTAL_SEGMENTS = 24;
  const ledElements = [];
  let latestRmsPercent = 0;
  let lastRenderedActiveSegments = -1;
  let vuAnimFrameId = null;

  function initVuMeter() {
    ledSegmentsContainer.innerHTML = '';
    ledElements.length = 0;
    for (let i = 0; i < TOTAL_SEGMENTS; i++) {
      const seg = document.createElement('div');
      seg.className = 'led-seg';
      if (i < 14) {
        seg.classList.add('zone-green');
      } else if (i < 20) {
        seg.classList.add('zone-amber');
      } else {
        seg.classList.add('zone-red');
      }
      ledSegmentsContainer.appendChild(seg);
      ledElements.push(seg);
    }
  }

  function startVuMeterLoop() {
    function tick() {
      if (!isTransmitting) {
        resetVuLevel();
        vuAnimFrameId = null;
        return;
      }

      const activeCount = Math.round((latestRmsPercent / 100) * TOTAL_SEGMENTS);
      if (activeCount !== lastRenderedActiveSegments) {
        lastRenderedActiveSegments = activeCount;
        for (let i = 0; i < TOTAL_SEGMENTS; i++) {
          if (i < activeCount) {
            if (!ledElements[i].classList.contains('lit')) {
              ledElements[i].classList.add('lit');
            }
          } else {
            if (ledElements[i].classList.contains('lit')) {
              ledElements[i].classList.remove('lit');
            }
          }
        }
      }

      vuAnimFrameId = requestAnimationFrame(tick);
    }

    if (!vuAnimFrameId) {
      vuAnimFrameId = requestAnimationFrame(tick);
    }
  }

  function stopVuMeterLoop() {
    if (vuAnimFrameId) {
      cancelAnimationFrame(vuAnimFrameId);
      vuAnimFrameId = null;
    }
    resetVuLevel();
  }

  function resetVuLevel() {
    lastRenderedActiveSegments = -1;
    for (let i = 0; i < TOTAL_SEGMENTS; i++) {
      ledElements[i].classList.remove('lit');
    }
  }

  // Identity Onboarding Flow
  function updateOperatorDisplay() {
    if (studentName && studentName.trim().length > 0) {
      headerOperatorName.textContent = studentName;
    } else {
      headerOperatorName.textContent = 'UNASSIGNED';
    }
  }

  function openOnboardingModal() {
    // Parse existing name if it has (Seat) notation
    if (studentName) {
      const match = studentName.match(/^(.*?)(?:\s*\((.*?)\))?$/);
      if (match) {
        inputOperatorName.value = match[1] ? match[1].trim() : '';
        inputOperatorSeat.value = match[2] ? match[2].trim() : '';
      } else {
        inputOperatorName.value = studentName;
        inputOperatorSeat.value = '';
      }
    } else {
      inputOperatorName.value = '';
      inputOperatorSeat.value = '';
    }
    onboardingModal.classList.add('active');
    setTimeout(() => inputOperatorName.focus(), 150);
  }

  function closeOnboardingModal() {
    onboardingModal.classList.remove('active');
  }

  onboardingForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const rawName = inputOperatorName.value.trim();
    const rawSeat = inputOperatorSeat.value.trim();

    if (!rawName) {
      inputOperatorName.focus();
      return;
    }

    let formatted = rawName;
    if (rawSeat) {
      formatted = `${rawName} (${rawSeat})`;
    }

    studentName = formatted;
    localStorage.setItem('aether_student_name', studentName);
    updateOperatorDisplay();
    closeOnboardingModal();

    if (socket && socket.connected) {
      socket.emit('update_profile', { studentName });
    }
  });

  editNameBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openOnboardingModal();
  });

  // Mode Selection: Momentary (Hold) vs Latched (Tap)
  modeHoldBtn.addEventListener('click', () => setMode('hold'));
  modeToggleBtn.addEventListener('click', () => setMode('toggle'));

  function setMode(mode) {
    if (isTransmitting) {
      stopTransmission();
    }
    pttMode = mode;
    isToggledOn = false;

    modeHoldBtn.classList.toggle('active', mode === 'hold');
    modeHoldBtn.setAttribute('aria-checked', mode === 'hold' ? 'true' : 'false');

    modeToggleBtn.classList.toggle('active', mode === 'toggle');
    modeToggleBtn.setAttribute('aria-checked', mode === 'toggle' ? 'true' : 'false');

    updatePttText();
  }

  function updatePttText() {
    if (isLineBusy) {
      pttText.textContent = 'LINE OCCUPIED';
      pttSubtext.textContent = currentSpeakerName ? `IN USE BY ${currentSpeakerName.toUpperCase()}` : 'CHANNEL BUSY';
    } else if (isTransmitting) {
      pttText.textContent = 'LIVE TRANSMITTING';
      pttSubtext.textContent = pttMode === 'hold' ? 'RELEASE TO END' : 'TAP SWITCH TO END';
    } else {
      pttText.textContent = pttMode === 'hold' ? 'HOLD TO TALK' : 'TAP TO TALK';
      pttSubtext.textContent = pttMode === 'hold' ? 'PRESS & HOLD SWITCH' : 'TAP SWITCH TO START';
    }
  }

  // Audio Packet Accumulator (Balanced 512 samples @ 16kHz = 32ms = 1024 bytes)
  const PACKET_SAMPLES = 512;
  const sampleAccumulator = new Int16Array(PACKET_SAMPLES);
  let accumulatedCount = 0;

  // Initialize Socket.io Connection
  function initSocket() {
    socket = io({
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 25,
      reconnectionDelay: 1000
    });
    socket.binaryType = 'arraybuffer';

    socket.on('connect', () => {
      rfStatusLed.className = 'hardware-led online';
      rfStatusLabel.textContent = 'ONLINE';
      
      socket.emit('register_student', {
        studentId,
        studentName: studentName || 'Anonymous Operator'
      });
    });

    socket.on('disconnect', () => {
      rfStatusLed.className = 'hardware-led offline';
      rfStatusLabel.textContent = 'LINK LOST';
      if (isTransmitting) {
        stopTransmission();
      }
      setBannerState('busy', 'RF LINK LOST // DISCONNECTED', 'Attempting automatic reconnection to console...', 'OFFLINE');
    });

    socket.on('line_granted', () => {
      accumulatedCount = 0;
      isRequesting = false;
      isTransmitting = true;
      if (audioContext) window.AetherAudio.playKeyChime(audioContext);
      if (navigator.vibrate) navigator.vibrate(45);
      setTransmittingState(true);
    });

    socket.on('line_denied', (data) => {
      isRequesting = false;
      isTransmitting = false;
      isToggledOn = false;
      if (audioContext) window.AetherAudio.playBusyTone(audioContext);
      if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
      
      const spk = (data.currentSpeaker && data.currentSpeaker.studentName) ? data.currentSpeaker.studentName : 'Another operator';
      setBannerState('busy', 'LINE ACCESS REJECTED', `Channel in use by ${spk}`, 'REJECTED');
      setTimeout(() => {
        if (!isLineBusy && !isTransmitting) {
          setBannerState('ready', 'CHANNEL CLEAR // READY', 'Hold or tap the tactile switch to transmit voice to the hall', 'IDLE');
        }
      }, 2500);
    });

    socket.on('line_busy', (data) => {
      isLineBusy = true;
      currentSpeakerName = data.studentName || 'Another Student';
      if (isTransmitting && data.studentId !== studentId) {
        stopTransmission();
      }
      setBusyState(true, currentSpeakerName);
    });

    socket.on('line_free', () => {
      isLineBusy = false;
      currentSpeakerName = '';
      if (!isTransmitting) {
        setBusyState(false);
      }
    });

    socket.on('line_revoked', (data) => {
      stopTransmission();
      setBannerState('busy', 'TRANSMISSION TERMINATED', data.reason || 'Channel released by professor', 'REVOKED');
      setTimeout(() => {
        if (!isLineBusy) {
          setBannerState('ready', 'CHANNEL CLEAR // READY', 'Hold or tap the tactile switch to transmit voice to the hall', 'IDLE');
        }
      }, 2000);
    });
  }

  // Web Audio & Microphone Capture
  async function setupAudio() {
    if (audioContext && mediaStream) {
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      return true;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
          channelCount: 1
        }
      });

      mediaStream = stream;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      try {
        audioContext = new AudioCtx({ sampleRate: 16000, latencyHint: 'interactive' });
      } catch (e) {
        audioContext = new AudioCtx({ latencyHint: 'interactive' });
      }

      const source = audioContext.createMediaStreamSource(stream);
      // If native 16kHz is active, 512 samples = 32ms. If 48kHz, 1024 samples = 21.3ms.
      const bufferSize = audioContext.sampleRate <= 16000 ? 512 : 1024;
      scriptProcessor = audioContext.createScriptProcessor(bufferSize, 1, 1);

      scriptProcessor.onaudioprocess = (e) => {
        if (!isTransmitting || !socket || !socket.connected) {
          return;
        }

        const inputFloat = e.inputBuffer.getChannelData(0);

        // Atomic RMS calculation for decoupled visualizer (zero DOM touch in audio loop)
        const rms = window.AetherAudio.calculateRMS(inputFloat);
        latestRmsPercent = Math.min(100, Math.round(rms * 320));

        // High-speed single pass downsampling & 16-bit PCM integer quantization
        const downsampledInt16 = window.AetherAudio.downsampleAndConvertToInt16(
          inputFloat,
          audioContext.sampleRate,
          16000
        );

        // Accumulate into balanced 512-sample (32ms) packets to eliminate Wi-Fi packet starvation
        let inputOffset = 0;
        while (inputOffset < downsampledInt16.length) {
          const needed = PACKET_SAMPLES - accumulatedCount;
          const toCopy = Math.min(needed, downsampledInt16.length - inputOffset);
          sampleAccumulator.set(downsampledInt16.subarray(inputOffset, inputOffset + toCopy), accumulatedCount);
          accumulatedCount += toCopy;
          inputOffset += toCopy;

          if (accumulatedCount === PACKET_SAMPLES) {
            // Emit guaranteed 512-sample binary packet (1024 bytes)
            const packetBuffer = sampleAccumulator.slice().buffer;
            socket.emit('audio_chunk', packetBuffer);
            accumulatedCount = 0;
          }
        }
      };

      // Silence gain node prevents local room feedback
      const silenceGain = audioContext.createGain();
      silenceGain.gain.value = 0;
      source.connect(scriptProcessor);
      scriptProcessor.connect(silenceGain);
      silenceGain.connect(audioContext.destination);

      permModal.classList.remove('active');
      return true;
    } catch (err) {
      console.error('Microphone access denied:', err);
      permModal.classList.add('active');
      return false;
    }
  }

  // PTT Handlers
  async function handlePressStart(e) {
    if (e.cancelable) e.preventDefault();
    if (isLineBusy || isRequesting) return;

    // Check if operator name has been set
    if (!studentName || studentName.trim().length === 0) {
      openOnboardingModal();
      return;
    }

    const ready = await setupAudio();
    if (!ready) return;

    if (pttMode === 'hold') {
      requestLine();
    } else {
      // Toggle / Latched mode
      if (!isToggledOn) {
        isToggledOn = true;
        requestLine();
      } else {
        isToggledOn = false;
        stopTransmission();
      }
    }
  }

  function handlePressEnd(e) {
    if (e && e.cancelable) e.preventDefault();
    if (pttMode === 'hold' && (isTransmitting || isRequesting)) {
      stopTransmission();
    }
  }

  function requestLine() {
    isRequesting = true;
    setBannerState('ready', 'REQUESTING MIC LOCK...', 'Negotiating transmission mutex with server', 'SYNC');
    pttText.textContent = 'REQUESTING...';
    socket.emit('request_line', {
      studentId,
      studentName
    });
  }

  function stopTransmission() {
    if (isTransmitting || isRequesting) {
      const wasSpeaking = isTransmitting;
      isTransmitting = false;
      isRequesting = false;
      isToggledOn = false;

      // Flush any trailing accumulated samples
      if (accumulatedCount > 0 && socket && socket.connected) {
        const remaining = sampleAccumulator.subarray(0, accumulatedCount);
        const flushBuffer = remaining.slice().buffer;
        socket.emit('audio_chunk', flushBuffer);
      }
      accumulatedCount = 0;

      if (wasSpeaking && audioContext) {
        window.AetherAudio.playRogerBeep(audioContext);
      }
      if (navigator.vibrate) {
        navigator.vibrate([20, 20]);
      }
      if (socket && socket.connected) {
        socket.emit('release_line');
      }
      setTransmittingState(false);
    }
  }

  // UI State Controls
  function setTransmittingState(active) {
    if (active) {
      micSection.classList.add('transmitting');
      pttButton.classList.add('transmitting');
      pttButton.classList.remove('busy');
      studentVuWrapper.classList.add('active');
      updatePttText();
      startVuMeterLoop();

      setBannerState('transmitting', 'ON AIR // LIVE TRANSMISSION', 'Audio streaming live to auditorium monitors', 'ON AIR');

      // Elapsed Timer
      transmitSeconds = 0;
      liveTimer.textContent = '00:00';
      clearInterval(transmitTimerInterval);
      transmitTimerInterval = setInterval(() => {
        transmitSeconds++;
        const mins = String(Math.floor(transmitSeconds / 60)).padStart(2, '0');
        const secs = String(transmitSeconds % 60).padStart(2, '0');
        liveTimer.textContent = `${mins}:${secs}`;
      }, 1000);
    } else {
      micSection.classList.remove('transmitting');
      pttButton.classList.remove('transmitting');
      studentVuWrapper.classList.remove('active');
      stopVuMeterLoop();
      clearInterval(transmitTimerInterval);
      liveTimer.textContent = '00:00';

      if (isLineBusy) {
        setBusyState(true, currentSpeakerName);
      } else {
        setBusyState(false);
      }
    }
  }

  function setBusyState(busy, speaker = '') {
    if (busy) {
      micSection.classList.add('busy');
      pttButton.classList.add('busy');
      pttButton.disabled = true;
      updatePttText();
      setBannerState('busy', 'CH LOCKED // LINE BUSY', `Line currently occupied by: ${speaker}`, 'BUSY');
    } else {
      micSection.classList.remove('busy');
      pttButton.classList.remove('busy');
      pttButton.disabled = false;
      updatePttText();
      setBannerState('ready', 'CHANNEL CLEAR // READY', 'Hold or tap the tactile switch to transmit voice to the hall', 'IDLE');
    }
  }

  function setBannerState(type, title, subtitle, tag) {
    statusBanner.className = `annunciator-banner ${type}`;
    statusTitle.textContent = title;
    statusSubtitle.textContent = subtitle;
    statusTag.textContent = tag;
  }

  // Pointer & Touch Events
  pttButton.addEventListener('pointerdown', handlePressStart);
  window.addEventListener('pointerup', handlePressEnd);
  window.addEventListener('pointercancel', handlePressEnd);
  pttButton.addEventListener('contextmenu', (e) => e.preventDefault());

  grantPermBtn.addEventListener('click', async () => {
    await setupAudio();
  });

  // Initialization
  initVuMeter();
  updateOperatorDisplay();
  initSocket();

  // If no operator name has been saved, prompt gate modal on load
  if (!studentName || studentName.trim().length === 0) {
    setTimeout(() => {
      openOnboardingModal();
    }, 400);
  }
})();
