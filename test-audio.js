/**
 * Unit Tests for Audio Utilities (AetherAudio)
 */

const assert = require('assert');
const {
  downsampleBuffer,
  downsampleAndConvertToInt16,
  floatToInt16,
  int16ToFloat,
  calculateRMS,
  smoothChunkBoundaries,
  resetSmoothing
} = require('./public/js/audio-processor');

console.log('🧪 Starting Audio Utilities Unit Tests...\n');

// Test 1: Float32 to Int16 conversion & bounds clamping
const inputFloats = new Float32Array([-1.5, -1.0, -0.5, 0, 0.5, 1.0, 1.5]);
const convertedInt16 = floatToInt16(inputFloats);

assert.strictEqual(convertedInt16[0], -32768, 'Clamped minimum should be -32768');
assert.strictEqual(convertedInt16[1], -32768, '-1.0 should map to -32768');
assert.strictEqual(convertedInt16[3], 0, '0.0 should map to 0');
assert.strictEqual(convertedInt16[5], 32767, '1.0 should map to 32767');
assert.strictEqual(convertedInt16[6], 32767, 'Clamped maximum should be 32767');
console.log('✅ 1. Float32 to Int16 conversion and boundary clamping verified');

// Test 2: Int16 to Float32 roundtrip conversion
const reconstructedFloats = int16ToFloat(convertedInt16);
assert(Math.abs(reconstructedFloats[1] - (-1.0)) < 0.001, 'Reconstructed -1.0 within tolerance');
assert(Math.abs(reconstructedFloats[3] - 0) < 0.001, 'Reconstructed 0 within tolerance');
assert(Math.abs(reconstructedFloats[5] - 1.0) < 0.001, 'Reconstructed 1.0 within tolerance');
console.log('✅ 2. Int16 to Float32 reconstruction precision verified');

// Test 3: Downsampling from 48kHz to 16kHz (3:1 ratio)
const sampleRate48k = 48000;
const sampleRate16k = 16000;
const input48k = new Float32Array(4800); // 100ms at 48kHz
for (let i = 0; i < input48k.length; i++) {
  input48k[i] = Math.sin(2 * Math.PI * 440 * (i / sampleRate48k)); // 440Hz tone
}

const downsampled = downsampleBuffer(input48k, sampleRate48k, sampleRate16k);
assert.strictEqual(downsampled.length, 1600, 'Downsampled length should be exactly 1600 samples (100ms at 16kHz)');
console.log('✅ 3. Downsampling from 48kHz to 16kHz verified (exact sample ratio)');

// Test 4: RMS Volume Calculation
const silence = new Float32Array(1000).fill(0);
assert.strictEqual(calculateRMS(silence), 0, 'Silence should have RMS of 0');

const fullScaleSine = new Float32Array(1000);
for (let i = 0; i < fullScaleSine.length; i++) {
  fullScaleSine[i] = Math.sin(i);
}
const rms = calculateRMS(fullScaleSine);
assert(Math.abs(rms - 0.707) < 0.05, `RMS of full-scale sine should be ~0.707, got ${rms}`);
console.log('✅ 4. RMS volume calculation verified');

// Test 5: Single-pass downsampling and Int16 conversion
const directInt16 = downsampleAndConvertToInt16(input48k, sampleRate48k, sampleRate16k);
assert.strictEqual(directInt16.length, 1600, 'Direct Int16 conversion length should be 1600');
const separateInt16 = floatToInt16(downsampled);
// Compare first 100 samples
let maxDiff = 0;
for (let i = 0; i < 100; i++) {
  const diff = Math.abs(directInt16[i] - separateInt16[i]);
  if (diff > maxDiff) maxDiff = diff;
}
assert(maxDiff <= 1, `Direct Int16 should match separate pipeline within 1 LSB, max diff: ${maxDiff}`);
console.log('✅ 5. Single-pass downsampleAndConvertToInt16 verified against two-pass pipeline');

// Test 6: Boundary smoothing initial ramp-up (eliminates key-up DC pop)
resetSmoothing();
const chunk1 = new Float32Array(512).fill(1.0); // Constant 1.0 signal
smoothChunkBoundaries(chunk1);
// First sample should be 0.0 (weight 0 / 24)
assert.strictEqual(chunk1[0], 0, 'First sample of stream should ramp from 0.0 to prevent pop');
// Sample at index 12 should be ~0.5
assert(Math.abs(chunk1[12] - 0.5) < 0.05, 'Mid-fade sample should be ~0.5');
// Sample at index 24 and beyond should be unattenuated (1.0)
assert.strictEqual(chunk1[24], 1.0, 'Samples after fade window should remain unattenuated');
console.log('✅ 6. Stream start boundary micro-ramp verified (eliminates DC click/pop)');

// Test 7: Inter-chunk boundary crossfade eliminates step discontinuities
// Chunk 1 ended at 1.0. Chunk 2 starts with a step jump to -1.0.
const chunk2 = new Float32Array(512).fill(-1.0);
smoothChunkBoundaries(chunk2);
// Sample 0 of chunk2 should smoothly match chunk1's last sample (1.0 * (1-0) + (-1.0) * 0 = 1.0)
assert(Math.abs(chunk2[0] - 1.0) < 0.001, `Chunk 2 boundary sample 0 should match chunk 1 end (1.0), got ${chunk2[0]}`);
// Mid-fade at index 12 should be ~0.0 (1.0 * 0.5 + (-1.0) * 0.5 = 0.0)
assert(Math.abs(chunk2[12] - 0.0) < 0.05, `Chunk 2 sample 12 should be smooth transition ~0.0, got ${chunk2[12]}`);
// Sample 24 should reach target -1.0
assert.strictEqual(chunk2[24], -1.0, 'Chunk 2 sample after fade should reach full target -1.0');

// Test resetSmoothing
resetSmoothing();
const chunkAfterReset = new Float32Array(512).fill(0.8);
smoothChunkBoundaries(chunkAfterReset);
assert.strictEqual(chunkAfterReset[0], 0, 'After resetSmoothing, next stream should ramp from 0 again');
console.log('✅ 7. Inter-chunk sample crossfade and resetSmoothing verified (eliminates boundary clicks)');

console.log('\n🎉 ALL 7 AUDIO UNIT TESTS PASSED SUCCESSFULLY!\n');
