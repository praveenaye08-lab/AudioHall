/**
 * AetherMic Audio Utilities
 * Low-latency PCM Downsampler, Converter, and Audio Scheduler
 */

// Downsample Float32 audio buffer from inputSampleRate to targetSampleRate using fractional linear interpolation
function downsampleBuffer(buffer, inputSampleRate, targetSampleRate = 16000) {
  if (targetSampleRate === inputSampleRate || buffer.length === 0) {
    return buffer;
  }
  if (targetSampleRate > inputSampleRate) {
    // If target rate is higher, return as-is
    return buffer;
  }

  const sampleRateRatio = inputSampleRate / targetSampleRate;
  const newLength = Math.round(buffer.length / sampleRateRatio);
  const result = new Float32Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const position = i * sampleRateRatio;
    const index = Math.floor(position);
    const frac = position - index;
    const s0 = buffer[index];
    const s1 = (index + 1 < buffer.length) ? buffer[index + 1] : s0;
    result[i] = s0 * (1 - frac) + s1 * frac;
  }

  return result;
}

// Convert Float32Array (-1.0 to 1.0) to Int16Array (-32768 to 32767)
function floatToInt16(float32Array) {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return int16Array;
}

// Downsample and convert Float32Array to Int16Array in a single high-speed linear interpolated pass
function downsampleAndConvertToInt16(buffer, inputSampleRate, targetSampleRate = 16000) {
  if (targetSampleRate >= inputSampleRate || buffer.length === 0) {
    return floatToInt16(buffer);
  }

  const sampleRateRatio = inputSampleRate / targetSampleRate;
  const newLength = Math.round(buffer.length / sampleRateRatio);
  const int16 = new Int16Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const position = i * sampleRateRatio;
    const index = Math.floor(position);
    const frac = position - index;
    const s0 = buffer[index];
    const s1 = (index + 1 < buffer.length) ? buffer[index + 1] : s0;
    const sample = s0 * (1 - frac) + s1 * frac;
    const s = Math.max(-1, Math.min(1, sample));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }

  return int16;
}

// Convert Int16Array back to Float32Array for AudioBuffer playback
function int16ToFloat(int16Array) {
  const float32Array = new Float32Array(int16Array.length);
  for (let i = 0; i < int16Array.length; i++) {
    const int = int16Array[i];
    float32Array[i] = int < 0 ? int / 0x8000 : int / 0x7FFF;
  }
  return float32Array;
}

// Audio Frame Boundary Smoothing & De-Clicking (1.5ms / 24 samples @ 16kHz)
let prevLastSample = null;
let isFirstChunkOfStream = true;
const FADE_SAMPLES = 24; // ~1.5ms at 16kHz

function resetSmoothing() {
  prevLastSample = null;
  isFirstChunkOfStream = true;
}

function smoothChunkBoundaries(float32Array) {
  if (!float32Array || float32Array.length === 0) {
    return float32Array;
  }

  const len = float32Array.length;
  const fadeCount = Math.min(FADE_SAMPLES, Math.floor(len / 4));

  if (isFirstChunkOfStream) {
    // 1.5ms micro-ramp at stream start to eliminate DC-offset pop
    for (let i = 0; i < fadeCount; i++) {
      const weight = i / fadeCount;
      float32Array[i] *= weight;
    }
    isFirstChunkOfStream = false;
  } else if (prevLastSample !== null) {
    // Crossfade chunk boundary from previous chunk's final sample to prevent step discontinuity
    for (let i = 0; i < fadeCount; i++) {
      const weight = i / fadeCount;
      float32Array[i] = prevLastSample * (1 - weight) + float32Array[i] * weight;
    }
  }

  // Record final sample of current chunk for next boundary interpolation
  prevLastSample = float32Array[len - 1];
  return float32Array;
}

// Calculate RMS (Root Mean Square) volume level (0.0 to 1.0)
function calculateRMS(float32Array) {
  let sum = 0;
  for (let i = 0; i < float32Array.length; i++) {
    sum += float32Array[i] * float32Array[i];
  }
  return Math.sqrt(sum / float32Array.length);
}

// Synthesize radio mic-up chirp / key tone
function playKeyChime(audioCtx) {
  if (!audioCtx || audioCtx.state !== 'running') return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const now = audioCtx.currentTime;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(850, now);
    osc.frequency.exponentialRampToValueAtTime(1250, now + 0.05);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.06);
  } catch (e) {
    // Ignore audio fx errors
  }
}

// Synthesize classic roger beep on release
function playRogerBeep(audioCtx) {
  if (!audioCtx || audioCtx.state !== 'running') return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const now = audioCtx.currentTime;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1150, now);

    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.07);
  } catch (e) {
    // Ignore audio fx errors
  }
}

// Synthesize channel busy denial tone
function playBusyTone(audioCtx) {
  if (!audioCtx || audioCtx.state !== 'running') return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const now = audioCtx.currentTime;

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.setValueAtTime(160, now + 0.08);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.16);
  } catch (e) {
    // Ignore audio fx errors
  }
}

// Export for window or module
if (typeof window !== 'undefined') {
  window.AetherAudio = {
    downsampleBuffer,
    downsampleAndConvertToInt16,
    floatToInt16,
    int16ToFloat,
    calculateRMS,
    smoothChunkBoundaries,
    resetSmoothing,
    playKeyChime,
    playRogerBeep,
    playBusyTone
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    downsampleBuffer,
    downsampleAndConvertToInt16,
    floatToInt16,
    int16ToFloat,
    calculateRMS,
    smoothChunkBoundaries,
    resetSmoothing
  };
}
