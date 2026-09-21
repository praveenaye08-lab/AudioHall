/**
 * AetherMic PowerPoint Generator
 * Generates an industrial studio-styled 7-slide .pptx presentation deck
 */

const PptxGenJS = require('pptxgenjs');
const path = require('path');

const pptx = new PptxGenJS();

// Presentation Properties
pptx.layout = 'LAYOUT_16x9'; // 10 x 5.625 inches
pptx.title = 'AetherMic - Local Wi-Fi Walkie-Talkie for Lecture Halls';
pptx.author = 'AetherMic Project Team';
pptx.subject = 'Real-Time Audio Networking & EdTech';

// Shape Constants
const SHAPE_RECT = pptx.shapes.RECTANGLE || 'rect';
const SHAPE_ROUND_RECT = pptx.shapes.ROUNDED_RECTANGLE || 'roundRect';
const SHAPE_LINE = pptx.shapes.LINE || 'line';
const SHAPE_OVAL = pptx.shapes.OVAL || 'ellipse';

// Industrial Palette Constants
const COLOR_BG = '0D0F11';
const COLOR_SURFACE = '16191D';
const COLOR_CARD = '21262D';
const COLOR_BORDER = '30363D';
const COLOR_AMBER = 'F59E0B';
const COLOR_AMBER_LIGHT = 'FBBF24';
const COLOR_RED = 'EF4444';
const COLOR_GREEN = '22C55E';
const COLOR_TEXT = 'E6EDF3';
const COLOR_TEXT_MUTED = '8B949E';

// Helper: Common Header across slides
function addSlideHeader(slide, title, category) {
  slide.background = { color: COLOR_BG };

  // Top Accent Bar
  slide.addShape(SHAPE_RECT, {
    x: 0.6,
    y: 0.45,
    w: 0.1,
    h: 0.55,
    fill: { color: COLOR_AMBER },
    line: { color: COLOR_AMBER }
  });

  // Category Tag
  slide.addText(category.toUpperCase(), {
    x: 0.85,
    y: 0.42,
    w: 8.0,
    h: 0.25,
    fontSize: 9,
    fontFace: 'Consolas',
    color: COLOR_AMBER,
    bold: true
  });

  // Slide Title
  slide.addText(title, {
    x: 0.85,
    y: 0.65,
    w: 8.5,
    h: 0.45,
    fontSize: 20,
    fontFace: 'Arial',
    color: COLOR_TEXT,
    bold: true
  });

  // Header Divider
  slide.addShape(SHAPE_LINE, {
    x: 0.6,
    y: 1.2,
    w: 8.8,
    h: 0,
    line: { color: COLOR_BORDER, width: 1 }
  });
}

// ==========================================================================
// SLIDE 1: TITLE & EXECUTIVE OVERVIEW
// ==========================================================================
{
  const slide = pptx.addSlide();
  slide.background = { color: COLOR_BG };

  // Brand Badge
  slide.addShape(SHAPE_ROUND_RECT, {
    x: 0.8,
    y: 1.0,
    w: 2.2,
    h: 0.4,
    rectRadius: 0.08,
    fill: { color: COLOR_CARD },
    line: { color: COLOR_AMBER, width: 1.5 }
  });
  slide.addText('STUDIO AUDIO TR-100', {
    x: 0.8,
    y: 1.0,
    w: 2.2,
    h: 0.4,
    align: 'center',
    fontSize: 9,
    fontFace: 'Consolas',
    color: COLOR_AMBER,
    bold: true
  });

  // Main Title
  slide.addText('AETHERMIC', {
    x: 0.8,
    y: 1.55,
    w: 8.4,
    h: 0.9,
    fontSize: 44,
    fontFace: 'Arial',
    color: COLOR_TEXT,
    bold: true
  });

  // Subtitle
  slide.addText('Ultra-Low-Latency Local Wi-Fi Walkie-Talkie for Lecture Halls', {
    x: 0.8,
    y: 2.45,
    w: 8.4,
    h: 0.45,
    fontSize: 16,
    fontFace: 'Arial',
    color: COLOR_AMBER_LIGHT
  });

  // Description / Core Pitch
  slide.addText(
    'A high-performance, browser-based push-to-talk audio system operating 100% over campus local Wi-Fi. Students scan an on-screen QR code to turn their smartphones into wireless broadcast microphones connected directly to the room speakers—with zero external internet dependency.',
    {
      x: 0.8,
      y: 3.0,
      w: 8.4,
      h: 0.9,
      fontSize: 11.5,
      fontFace: 'Arial',
      color: COLOR_TEXT_MUTED,
      lineSpacing: 16
    }
  );

  // 4 Feature Metric Badges
  const badges = [
    { label: 'ZERO INTERNET', val: '100% Offline LAN' },
    { label: 'CONCURRENCY MUTEX', val: 'Single-Speaker Lock' },
    { label: 'END-TO-END LATENCY', val: '< 100ms Glass-to-Ear' },
    { label: 'HARDWARE SECURITY', val: 'Dynamic Local SSL' }
  ];

  badges.forEach((b, i) => {
    const bx = 0.8 + i * 2.15;
    slide.addShape(SHAPE_ROUND_RECT, {
      x: bx,
      y: 4.15,
      w: 2.0,
      h: 0.9,
      rectRadius: 0.08,
      fill: { color: COLOR_SURFACE },
      line: { color: COLOR_BORDER, width: 1 }
    });
    slide.addText(b.label, {
      x: bx + 0.1,
      y: 4.25,
      w: 1.8,
      h: 0.25,
      fontSize: 8,
      fontFace: 'Consolas',
      color: COLOR_AMBER,
      bold: true
    });
    slide.addText(b.val, {
      x: bx + 0.1,
      y: 4.55,
      w: 1.8,
      h: 0.35,
      fontSize: 11,
      fontFace: 'Arial',
      color: COLOR_TEXT,
      bold: true
    });
  });
}

// ==========================================================================
// SLIDE 2: SYSTEM ARCHITECTURE & INDUSTRIAL UI
// ==========================================================================
{
  const slide = pptx.addSlide();
  addSlideHeader(slide, 'System Architecture & 3-Tier Topology', 'SYSTEM ARCHITECTURE');

  const tiers = [
    {
      tier: '01. TRANSMITTER (MOBILE)',
      title: 'Student Audio Client (/student)',
      accent: COLOR_AMBER,
      points: [
        'Pre-transmission operator name/seat onboarding gate',
        'Tactile circular PTT button with physical depression',
        'Momentary (Hold) vs Latched (Tap) trigger modes',
        'Hardware 24-segment discrete LED VU meter (-30 to +3 dB)',
        'Native haptic feedback & radio key/roger sound effects'
      ]
    },
    {
      tier: '02. MUTEX ENGINE (CORE)',
      title: 'Local Node.js HTTPS Server (server.js)',
      accent: COLOR_GREEN,
      points: [
        'Single-Speaker Concurrency Mutex prevents cross-talk',
        '60-second safety watchdog & abrupt disconnect cleanup',
        'Dynamic self-signed SSL generator for mobile HTTPS',
        'Strict unidirectional binary audio relay to host only',
        'Local physical network IP auto-detection & QR generation'
      ]
    },
    {
      tier: '03. RECEIVER (CONSOLE)',
      title: 'Professor Host Console (/host)',
      accent: COLOR_RED,
      points: [
        'Prominent illuminated studio ON AIR annunciator',
        'Active student callsign in large bold typography',
        '60 FPS oscilloscope trace & 30-bar VU peak meter',
        'Classroom master gain booster (0%-200%) & mute',
        'Live transmission audit log with timestamps & durations'
      ]
    }
  ];

  tiers.forEach((t, i) => {
    const tx = 0.6 + i * 2.98;
    slide.addShape(SHAPE_ROUND_RECT, {
      x: tx,
      y: 1.45,
      w: 2.85,
      h: 3.75,
      rectRadius: 0.08,
      fill: { color: COLOR_SURFACE },
      line: { color: COLOR_BORDER, width: 1 }
    });

    slide.addShape(SHAPE_ROUND_RECT, {
      x: tx + 0.15,
      y: 1.6,
      w: 2.55,
      h: 0.35,
      rectRadius: 0.05,
      fill: { color: COLOR_CARD },
      line: { color: t.accent, width: 1 }
    });
    slide.addText(t.tier, {
      x: tx + 0.15,
      y: 1.6,
      w: 2.55,
      h: 0.35,
      align: 'center',
      fontSize: 8.5,
      fontFace: 'Consolas',
      color: t.accent,
      bold: true
    });

    slide.addText(t.title, {
      x: tx + 0.15,
      y: 2.05,
      w: 2.55,
      h: 0.45,
      fontSize: 11.5,
      fontFace: 'Arial',
      color: COLOR_TEXT,
      bold: true
    });

    const bulletText = t.points.map(p => ({
      text: p + '\n',
      options: {
        fontSize: 9.5,
        fontFace: 'Arial',
        color: COLOR_TEXT_MUTED,
        bullet: true,
        lineSpacing: 14
      }
    }));
    slide.addText(bulletText, {
      x: tx + 0.15,
      y: 2.55,
      w: 2.55,
      h: 2.5
    });
  });
}

// ==========================================================================
// SLIDE 3: TOOLS & TECHNOLOGY STACK
// ==========================================================================
{
  const slide = pptx.addSlide();
  addSlideHeader(slide, 'Technology Stack & Engineering Tools', 'TOOLS & TECHNOLOGY');

  const rows = [
    [
      { text: 'CATEGORY', options: { bold: true, color: COLOR_AMBER, fontFace: 'Consolas', fontSize: 9 } },
      { text: 'TOOLS / TECHNOLOGIES', options: { bold: true, color: COLOR_AMBER, fontFace: 'Consolas', fontSize: 9 } },
      { text: 'ROLE IN AETHERMIC', options: { bold: true, color: COLOR_AMBER, fontFace: 'Consolas', fontSize: 9 } }
    ],
    [
      { text: 'Backend Runtime', options: { bold: true, color: COLOR_TEXT, fontSize: 9.5 } },
      { text: 'Node.js, Express', options: { color: COLOR_TEXT, fontSize: 9.5 } },
      { text: 'Lightweight, event-driven HTTP/HTTPS local application server', options: { color: COLOR_TEXT_MUTED, fontSize: 9 } }
    ],
    [
      { text: 'Real-Time Protocol', options: { bold: true, color: COLOR_TEXT, fontSize: 9.5 } },
      { text: 'Socket.io (WebSockets)', options: { color: COLOR_TEXT, fontSize: 9.5 } },
      { text: 'Sub-millisecond binary packet relay and state synchronization', options: { color: COLOR_TEXT_MUTED, fontSize: 9 } }
    ],
    [
      { text: 'Audio Engine (DSP)', options: { bold: true, color: COLOR_TEXT, fontSize: 9.5 } },
      { text: 'Web Audio API', options: { color: COLOR_TEXT, fontSize: 9.5 } },
      { text: 'Microphone capture, 16kHz downsampling, and jitter-free timeline playback', options: { color: COLOR_TEXT_MUTED, fontSize: 9 } }
    ],
    [
      { text: 'Security & TLS', options: { bold: true, color: COLOR_TEXT, fontSize: 9.5 } },
      { text: 'selfsigned (X.509 PKI)', options: { color: COLOR_TEXT, fontSize: 9.5 } },
      { text: 'Dynamic local SSL generation to satisfy mobile getUserMedia HTTPS rules', options: { color: COLOR_TEXT_MUTED, fontSize: 9 } }
    ],
    [
      { text: 'QR Code Generator', options: { bold: true, color: COLOR_TEXT, fontSize: 9.5 } },
      { text: 'qrcode (Buffer / Data URL)', options: { color: COLOR_TEXT, fontSize: 9.5 } },
      { text: 'Generates high-contrast projector QR code for instant mobile phone join', options: { color: COLOR_TEXT_MUTED, fontSize: 9 } }
    ],
    [
      { text: 'Frontend Core', options: { bold: true, color: COLOR_TEXT, fontSize: 9.5 } },
      { text: 'HTML5, CSS3, Vanilla JS', options: { color: COLOR_TEXT, fontSize: 9.5 } },
      { text: 'Zero heavy UI frameworks (<50KB footprint) for instant mobile loading', options: { color: COLOR_TEXT_MUTED, fontSize: 9 } }
    ],
    [
      { text: 'Haptics & Audio FX', options: { bold: true, color: COLOR_TEXT, fontSize: 9.5 } },
      { text: 'Vibration API, Oscillators', options: { color: COLOR_TEXT, fontSize: 9.5 } },
      { text: 'Native vibration feedback, walkie-talkie key chirps, and roger beeps', options: { color: COLOR_TEXT_MUTED, fontSize: 9 } }
    ]
  ];

  slide.addTable(rows, {
    x: 0.6,
    y: 1.45,
    w: 8.8,
    colW: [2.0, 2.4, 4.4],
    border: { pt: 1, color: COLOR_BORDER },
    fill: COLOR_SURFACE,
    autoPage: false
  });
}

// ==========================================================================
// SLIDE 4: END-TO-END OPERATIONAL FLOW
// ==========================================================================
{
  const slide = pptx.addSlide();
  addSlideHeader(slide, 'End-to-End Operational Lifecycle', 'OPERATIONAL FLOW');

  const steps = [
    {
      num: '01',
      title: 'Scan QR & Connect',
      desc: 'Student joins classroom Wi-Fi and scans projector QR code to access https://<LOCAL_IP>:3000/student'
    },
    {
      num: '02',
      title: 'Operator Onboarding',
      desc: 'Pre-transmission modal requires Name & Roll/Seat No before unlocking mic access. Persisted in localStorage.'
    },
    {
      num: '03',
      title: 'PTT Mutex Request',
      desc: 'Student presses tactile button. Server evaluates lock: grants exclusively or returns line busy tone.'
    },
    {
      num: '04',
      title: 'Live Audio Streaming',
      desc: 'Audio downsampled to 16kHz 16-bit mono linear PCM and relayed as binary WebSocket chunks.'
    },
    {
      num: '05',
      title: 'Jitter-Free Playback',
      desc: 'Host AudioContext schedules chunks seamlessly on timeline. Host visualizer displays waveform & 30-bar VU.'
    },
    {
      num: '06',
      title: 'Release & Audit Log',
      desc: 'Student releases switch ➔ Roger beep plays ➔ Mutex released ➔ Transmission logged with exact timestamp.'
    }
  ];

  steps.forEach((s, idx) => {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const sx = 0.6 + col * 2.98;
    const sy = 1.45 + row * 1.85;

    slide.addShape(SHAPE_ROUND_RECT, {
      x: sx,
      y: sy,
      w: 2.85,
      h: 1.7,
      rectRadius: 0.08,
      fill: { color: COLOR_SURFACE },
      line: { color: COLOR_BORDER, width: 1 }
    });

    slide.addShape(SHAPE_ROUND_RECT, {
      x: sx + 0.15,
      y: sy + 0.15,
      w: 0.55,
      h: 0.35,
      rectRadius: 0.05,
      fill: { color: COLOR_CARD },
      line: { color: COLOR_AMBER, width: 1 }
    });
    slide.addText(s.num, {
      x: sx + 0.15,
      y: sy + 0.15,
      w: 0.55,
      h: 0.35,
      align: 'center',
      fontSize: 10,
      fontFace: 'Consolas',
      color: COLOR_AMBER,
      bold: true
    });

    slide.addText(s.title, {
      x: sx + 0.8,
      y: sy + 0.15,
      w: 1.9,
      h: 0.35,
      fontSize: 11,
      fontFace: 'Arial',
      color: COLOR_TEXT,
      bold: true
    });

    slide.addText(s.desc, {
      x: sx + 0.15,
      y: sy + 0.6,
      w: 2.55,
      h: 0.95,
      fontSize: 9,
      fontFace: 'Arial',
      color: COLOR_TEXT_MUTED,
      lineSpacing: 13
    });
  });
}

// ==========================================================================
// SLIDE 5: KEY TECHNICAL INNOVATIONS
// ==========================================================================
{
  const slide = pptx.addSlide();
  addSlideHeader(slide, 'Technical Innovations & Problem-Solving', 'CORE INNOVATIONS');

  const innovations = [
    {
      title: 'Dynamic Local SSL Generator (X.509)',
      problem: 'Mobile browsers (iOS Safari & Chrome) strictly forbid getUserMedia microphone capture over plain HTTP unless on localhost.',
      solution: 'AetherMic automatically detects the physical network adapter and synthesizes in-memory X.509 certificates with Subject Alternative Names (SAN) matching the host machine local IP.',
      color: COLOR_AMBER
    },
    {
      title: 'Single-Speaker Mutex & Watchdog',
      problem: 'Multiple students transmitting simultaneously causes catastrophic acoustic chaos, echo, and packet collision.',
      solution: 'Atomic server-side Mutex grants exclusive line access to one speaker. A 60-second safety watchdog and abrupt socket disconnect hook immediately release the lock if a student drops Wi-Fi.',
      color: COLOR_GREEN
    },
    {
      title: 'Downsampled 16kHz PCM Binary Pipeline',
      problem: 'Full WebRTC mesh involves heavy ICE/STUN/TURN signaling, while 48kHz stereo consumes excessive local Wi-Fi bandwidth.',
      solution: 'Raw Float32 audio is downsampled client-side to 16kHz mono 16-bit linear PCM and pushed over binary WebSockets (~32 KB/s), achieving sub-100ms latency with zero audio drift.',
      color: COLOR_RED
    }
  ];

  innovations.forEach((inv, i) => {
    const iy = 1.45 + i * 1.25;

    slide.addShape(SHAPE_ROUND_RECT, {
      x: 0.6,
      y: iy,
      w: 8.8,
      h: 1.15,
      rectRadius: 0.08,
      fill: { color: COLOR_SURFACE },
      line: { color: COLOR_BORDER, width: 1 }
    });

    slide.addShape(SHAPE_RECT, {
      x: 0.6,
      y: iy,
      w: 0.08,
      h: 1.15,
      fill: { color: inv.color }
    });

    slide.addText(inv.title, {
      x: 0.85,
      y: iy + 0.1,
      w: 8.4,
      h: 0.3,
      fontSize: 12,
      fontFace: 'Arial',
      color: inv.color,
      bold: true
    });

    slide.addText(
      [
        { text: 'CHALLENGE: ', options: { bold: true, color: COLOR_TEXT, fontSize: 9 } },
        { text: inv.problem + '  ', options: { color: COLOR_TEXT_MUTED, fontSize: 9 } },
        { text: 'SOLUTION: ', options: { bold: true, color: COLOR_TEXT, fontSize: 9 } },
        { text: inv.solution, options: { color: COLOR_TEXT_MUTED, fontSize: 9 } }
      ],
      {
        x: 0.85,
        y: iy + 0.45,
        w: 8.4,
        h: 0.6,
        lineSpacing: 13
      }
    );
  });
}

// ==========================================================================
// SLIDE 6: ADVANTAGES & VALUE PROPOSITIONS
// ==========================================================================
{
  const slide = pptx.addSlide();
  addSlideHeader(slide, 'Key Advantages & Unique Selling Points', 'BENEFITS & ADVANTAGES');

  const advantages = [
    { title: 'Zero Hardware Cost', desc: 'Leverages smartphones students already own and classroom speakers already on the podium.' },
    { title: 'Zero Internet Dependency', desc: 'Operates 100% offline over local Wi-Fi. Unaffected by campus internet drops or slow bandwidth.' },
    { title: 'Frictionless Experience', desc: 'No mobile app installation, no App Store downloads, and no user registration required.' },
    { title: 'Full Speaker Accountability', desc: 'Professor dashboard logs student names and seat numbers alongside exact speech duration.' },
    { title: 'Zero Acoustic Feedback', desc: 'Voice streams strictly to the podium speakers; audio is never fed back to mobile handsets.' },
    { title: 'Tactile Industrial UX', desc: 'Hardware-grade interface with mechanical depression, 24-segment LED meter, and native haptics.' }
  ];

  advantages.forEach((adv, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const ax = 0.6 + col * 2.98;
    const ay = 1.45 + row * 1.85;

    slide.addShape(SHAPE_ROUND_RECT, {
      x: ax,
      y: ay,
      w: 2.85,
      h: 1.7,
      rectRadius: 0.08,
      fill: { color: COLOR_SURFACE },
      line: { color: COLOR_BORDER, width: 1 }
    });

    slide.addShape(SHAPE_OVAL, {
      x: ax + 0.15,
      y: ay + 0.2,
      w: 0.25,
      h: 0.25,
      fill: { color: COLOR_AMBER }
    });

    slide.addText(adv.title, {
      x: ax + 0.5,
      y: ay + 0.15,
      w: 2.2,
      h: 0.35,
      fontSize: 11,
      fontFace: 'Arial',
      color: COLOR_TEXT,
      bold: true
    });

    slide.addText(adv.desc, {
      x: ax + 0.15,
      y: ay + 0.6,
      w: 2.55,
      h: 0.95,
      fontSize: 9.5,
      fontFace: 'Arial',
      color: COLOR_TEXT_MUTED,
      lineSpacing: 14
    });
  });
}

// ==========================================================================
// SLIDE 7: LIMITATIONS & FUTURE ROADMAP
// ==========================================================================
{
  const slide = pptx.addSlide();
  addSlideHeader(slide, 'Current Limitations & Future Development', 'LIMITATIONS & ROADMAP');

  // Left Column: Limitations
  slide.addShape(SHAPE_ROUND_RECT, {
    x: 0.6,
    y: 1.45,
    w: 4.25,
    h: 3.75,
    rectRadius: 0.08,
    fill: { color: COLOR_SURFACE },
    line: { color: COLOR_BORDER, width: 1 }
  });

  slide.addShape(SHAPE_ROUND_RECT, {
    x: 0.8,
    y: 1.65,
    w: 3.85,
    h: 0.4,
    rectRadius: 0.05,
    fill: { color: '281416' },
    line: { color: COLOR_RED, width: 1 }
  });
  slide.addText('CURRENT LIMITATIONS (DISADVANTAGES)', {
    x: 0.8,
    y: 1.65,
    w: 3.85,
    h: 0.4,
    align: 'center',
    fontSize: 9,
    fontFace: 'Consolas',
    color: COLOR_RED,
    bold: true
  });

  const limits = [
    { label: 'Self-Signed SSL Prompt:', text: 'Because SSL certs are generated locally, mobile users must tap "Show Details > Visit Website" on first launch.' },
    { label: 'Same Wi-Fi Subnet Required:', text: 'Devices must share the same physical router or VLAN; client isolation (AP isolation) must be turned off.' },
    { label: 'Uncompressed PCM Bandwidth:', text: '16kHz linear PCM uses ~256 kbps. While light for 1 speaker, compressed codecs are more efficient for large halls.' }
  ];

  let limText = [];
  limits.forEach(l => {
    limText.push({ text: l.label + ' ', options: { bold: true, color: COLOR_TEXT, fontSize: 9.5 } });
    limText.push({ text: l.text + '\n\n', options: { color: COLOR_TEXT_MUTED, fontSize: 9, lineSpacing: 14 } });
  });
  slide.addText(limText, {
    x: 0.8,
    y: 2.2,
    w: 3.85,
    h: 2.8
  });

  // Right Column: Roadmap
  slide.addShape(SHAPE_ROUND_RECT, {
    x: 5.15,
    y: 1.45,
    w: 4.25,
    h: 3.75,
    rectRadius: 0.08,
    fill: { color: COLOR_SURFACE },
    line: { color: COLOR_BORDER, width: 1 }
  });

  slide.addShape(SHAPE_ROUND_RECT, {
    x: 5.35,
    y: 1.65,
    w: 3.85,
    h: 0.4,
    rectRadius: 0.05,
    fill: { color: '142217' },
    line: { color: COLOR_GREEN, width: 1 }
  });
  slide.addText('ENGINEERING ROADMAP (NEXT STEPS)', {
    x: 5.35,
    y: 1.65,
    w: 3.85,
    h: 0.4,
    align: 'center',
    fontSize: 9,
    fontFace: 'Consolas',
    color: COLOR_GREEN,
    bold: true
  });

  const roadmap = [
    { label: 'Opus WebAssembly Codec:', text: 'Integrate client-side Opus compression to reduce network bandwidth by 75% for 500+ student auditoriums.' },
    { label: 'Live AI Subtitles / Captions:', text: 'Incorporate real-time speech-to-text (Whisper.cpp) displaying the student question on the main screen.' },
    { label: 'Orderly Speaker Queueing:', text: 'Allow students to enter a virtual waiting line when channel is busy rather than repeatedly tapping.' }
  ];

  let roadText = [];
  roadmap.forEach(r => {
    roadText.push({ text: r.label + ' ', options: { bold: true, color: COLOR_TEXT, fontSize: 9.5 } });
    roadText.push({ text: r.text + '\n\n', options: { color: COLOR_TEXT_MUTED, fontSize: 9, lineSpacing: 14 } });
  });
  slide.addText(roadText, {
    x: 5.35,
    y: 2.2,
    w: 3.85,
    h: 2.8
  });
}

// Output PPTX File
const outputPath = path.join(__dirname, 'AetherMic_Presentation.pptx');
pptx.writeFile({ fileName: outputPath })
  .then(fileName => {
    console.log(`✅ PowerPoint presentation generated successfully at: ${fileName}`);
  })
  .catch(err => {
    console.error('❌ Error generating presentation:', err);
  });
