// Diagnostic-only client; never attaches to the user's browser/profile.
import net from 'node:net';
export async function connectMarionette(port) {
  const socket = net.connect(port, '127.0.0.1');
  let buffer = Buffer.alloc(0),
    id = 0;
  const pending = new Map();
  let greet, rejectGreeting;
  const greeting = new Promise((resolve, reject) => {
    greet = resolve;
    rejectGreeting = reject;
  });
  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (true) {
      const colon = buffer.indexOf(58);
      if (colon < 0) return;
      const length = Number(buffer.subarray(0, colon).toString());
      if (buffer.length < colon + 1 + length) return;
      const packet = JSON.parse(buffer.subarray(colon + 1, colon + 1 + length));
      buffer = buffer.subarray(colon + 1 + length);
      if (!Array.isArray(packet)) {
        greet(packet);
        continue;
      }
      const callback = pending.get(packet[1]);
      if (callback) {
        pending.delete(packet[1]);
        clearTimeout(callback.timer);
        packet[2]
          ? callback.reject(new Error(JSON.stringify(packet[2])))
          : callback.resolve(packet[3]);
      }
    }
  });
  socket.on('error', (error) => {
    rejectGreeting(error);
    for (const p of pending.values()) {
      clearTimeout(p.timer);
      p.reject(error);
    }
  });
  let greetingTimer;
  try {
    await Promise.race([
      greeting,
      new Promise((_, reject) => {
        greetingTimer = setTimeout(() => reject(new Error('Marionette greeting timeout')), 10000);
      }),
    ]);
  } catch (error) {
    socket.destroy();
    throw error;
  } finally {
    clearTimeout(greetingTimer);
  }
  return {
    async command(command, parameters = {}) {
      const request = ++id;
      const message = JSON.stringify([0, request, command, parameters]);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(request);
          reject(new Error(`${command} timeout`));
        }, 10000);
        pending.set(request, { resolve, reject, timer });
        socket.write(`${Buffer.byteLength(message)}:${message}`);
      });
    },
    close: () => socket.destroy(),
  };
}
