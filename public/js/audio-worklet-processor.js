/**
 * AetherMic AudioWorklet Processor
 * Real-time audio stream worker thread
 */

class AetherAudioWorkletProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 512;
    this.buffer = new Float32Array(this.bufferSize);
    this.offset = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || !input[0]) {
      return true;
    }

    const channelData = input[0];
    for (let i = 0; i < channelData.length; i++) {
      this.buffer[this.offset++] = channelData[i];

      if (this.offset >= this.bufferSize) {
        // Send filled buffer back to main thread
        this.port.postMessage(this.buffer.slice());
        this.offset = 0;
      }
    }

    return true;
  }
}

registerProcessor('aether-audio-processor', AetherAudioWorkletProcessor);
