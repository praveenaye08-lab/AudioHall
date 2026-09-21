/**
 * End-to-End Automated Integration Test Suite for AetherMic
 * Verifies:
 * 1. Host & Student socket registration
 * 2. Audience count synchronization
 * 3. Single-Speaker Mutex (Student A grants, Student B blocked)
 * 4. Binary PCM Audio chunk forwarding (Host receives, Student B does not)
 * 5. Voluntarily releasing line (Student A releases -> Student B can speak)
 * 6. Host override line release
 * 7. Abrupt student disconnection auto-release
 */

const { io } = require('socket.io-client');
const assert = require('assert');

// Allow self-signed certificates in Node test client
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const SERVER_URL = 'https://localhost:3000';

async function runTests() {
  console.log('🧪 Starting AetherMic End-to-End Integration Tests...\n');

  function createClient(name) {
    return io(SERVER_URL, {
      transports: ['websocket'],
      rejectUnauthorized: false,
      reconnection: false
    });
  }

  const hostSocket = createClient('Host');
  const studentASocket = createClient('Student A');
  const studentBSocket = createClient('Student B');

  try {
    // Step 1: Wait for all clients to connect
    await Promise.all([
      new Promise(resolve => hostSocket.on('connect', resolve)),
      new Promise(resolve => studentASocket.on('connect', resolve)),
      new Promise(resolve => studentBSocket.on('connect', resolve))
    ]);
    console.log('✅ 1. All 3 clients connected via TLS Socket.io');

    // Step 2: Register identities
    hostSocket.emit('register_host');
    studentASocket.emit('register_student', { studentId: 'std_A', studentName: 'Alice (Row 1)' });
    studentBSocket.emit('register_student', { studentId: 'std_B', studentName: 'Bob (Row 8)' });

    // Verify Audience count reaches 2
    const audienceCount = await new Promise(resolve => {
      hostSocket.on('audience_count', (count) => {
        if (count === 2) resolve(count);
      });
    });
    assert.strictEqual(audienceCount, 2, 'Expected 2 registered students');
    console.log(`✅ 2. Audience count broadcast verified: ${audienceCount} students`);

    // Step 3: Student A requests line -> should be granted
    const [grantedA, busyB, busyHost] = await Promise.all([
      new Promise(resolve => studentASocket.once('line_granted', () => resolve(true))),
      new Promise(resolve => studentBSocket.once('line_busy', data => resolve(data))),
      new Promise(resolve => hostSocket.once('line_busy', data => resolve(data))),
      new Promise(resolve => {
        studentASocket.emit('request_line', { studentId: 'std_A', studentName: 'Alice (Row 1)' });
        resolve();
      })
    ]);

    assert.strictEqual(grantedA, true, 'Student A should be granted line');
    assert.strictEqual(busyB.studentName, 'Alice (Row 1)', 'Student B should receive busy state for Alice');
    assert.strictEqual(busyHost.studentName, 'Alice (Row 1)', 'Host should receive busy state for Alice');
    console.log('✅ 3. Single-Speaker Mutex granted to Student A and broadcast to all others');

    // Step 4: Student B attempts to speak while Student A is speaking -> should be DENIED
    const deniedB = await new Promise(resolve => {
      studentBSocket.emit('request_line', { studentId: 'std_B', studentName: 'Bob (Row 8)' });
      studentBSocket.once('line_denied', resolve);
    });
    assert(deniedB.reason.includes('Channel busy'), 'Student B should receive line_denied');
    console.log('✅ 4. Concurrency lock verified: Student B denied while Student A transmits');

    // Step 5: Student A streams binary PCM audio chunk -> Host receives it, Student B does NOT
    let hostReceivedChunk = false;
    let studentBReceivedChunk = false;

    hostSocket.once('audio_chunk', (chunk) => {
      hostReceivedChunk = true;
    });
    studentBSocket.once('audio_chunk', () => {
      studentBReceivedChunk = true;
    });

    // Send 1024-sample Int16 PCM buffer (2048 bytes)
    const mockPcmChunk = new Int16Array(1024);
    for (let i = 0; i < mockPcmChunk.length; i++) {
      mockPcmChunk[i] = Math.sin(i / 10) * 15000;
    }
    studentASocket.emit('audio_chunk', mockPcmChunk.buffer);

    // Wait 200ms to verify reception
    await new Promise(resolve => setTimeout(resolve, 200));
    assert.strictEqual(hostReceivedChunk, true, 'Host should receive binary audio chunk');
    assert.strictEqual(studentBReceivedChunk, false, 'Student B must NOT receive audio (anti-feedback)');
    console.log('✅ 5. Binary PCM Audio streamed to Host only (Zero acoustic room feedback)');

    // Step 6: Student A releases line -> Channel becomes free
    const [freeB, freeHost] = await Promise.all([
      new Promise(resolve => studentBSocket.once('line_free', resolve)),
      new Promise(resolve => hostSocket.once('line_free', resolve)),
      new Promise(resolve => {
        studentASocket.emit('release_line');
        resolve();
      })
    ]);
    console.log('✅ 6. Student A released line. Channel free event received by Student B & Host');

    // Step 7: Now Student B requests line -> Should be granted
    const grantedB = await new Promise(resolve => {
      studentBSocket.emit('request_line', { studentId: 'std_B', studentName: 'Bob (Row 8)' });
      studentBSocket.once('line_granted', () => resolve(true));
    });
    assert.strictEqual(grantedB, true, 'Student B should be granted line now');
    console.log('✅ 7. Student B successfully acquired line');

    // Step 8: Professor Host uses Force Override to clear channel
    const [revokedB, overrideFree] = await Promise.all([
      new Promise(resolve => studentBSocket.once('line_revoked', resolve)),
      new Promise(resolve => hostSocket.once('line_free', resolve)),
      new Promise(resolve => {
        hostSocket.emit('force_release_line');
        resolve();
      })
    ]);
    console.log('✅ 8. Host override verified: Host cleared channel and Student B revoked');

    // Step 9: Disconnect mid-speech test
    // Student B requests line again
    await new Promise(resolve => {
      studentBSocket.emit('request_line', { studentId: 'std_B', studentName: 'Bob (Row 8)' });
      studentBSocket.once('line_granted', resolve);
    });

    // Student B abruptly disconnects
    const freeAfterDisconnect = await new Promise(resolve => {
      hostSocket.once('line_free', resolve);
      studentBSocket.disconnect();
    });
    console.log('✅ 9. Abrupt disconnect handling verified: Lock immediately released when speaker disconnects');

    // Cleanup remaining sockets
    studentASocket.disconnect();
    hostSocket.disconnect();

    console.log('\n🎉 ALL 9 END-TO-END TESTS PASSED SUCCESSFULLY!\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  }
}

runTests();
