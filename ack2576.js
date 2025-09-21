const net = require('node:net');
const VT = 0x0b, FS = 0x1c, CR = 0x0d;

function findFrames(buf) {
  const frames = [];
  let i = 0;
  while (i < buf.length) {
    // find VT
    while (i < buf.length && buf[i] !== VT) i++;
    if (i >= buf.length) break;
    const start = i + 1; // after VT
    // find FS CR
    let fs = -1;
    for (let j = start; j + 1 < buf.length; j++) {
      if (buf[j] === FS && buf[j + 1] === CR) { fs = j; break; }
    }
    if (fs === -1) break; // incomplete frame
    const payload = buf.slice(start, fs); // content between VT and FS
    frames.push({ start: i, end: fs + 2, payload });
    i = fs + 2; // continue after FS CR
  }
  return frames;
}

function frameHL7(msg) {
  return Buffer.concat([Buffer.from([VT]), Buffer.from(msg, 'utf8'), Buffer.from([FS, CR])]);
}

const server = net.createServer(socket => {
  let buf = Buffer.alloc(0);
  socket.on('data', chunk => {
    buf = Buffer.concat([buf, chunk]);

    const frames = findFrames(buf);
    for (const f of frames) {
      const shown = f.payload.toString('utf8').replace(/\r/g, '\\r');
      console.log('\n--- MLLP IN ---\n' + shown + '\n---------------');

      // Minimal ACK (always AA)
      const ts = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0,14);
      const ack = `MSH|^~\\&|ACK|ACKAPP|ACKFAC|RECV|${ts}||ACK^R01|ACK1|P|2.5.1\rMSA|AA|ACK-CONTROL-ID\r`;
      socket.write(frameHL7(ack));
    }

    // drop consumed bytes (up to last complete frame end)
    if (frames.length) {
      const lastEnd = frames[frames.length - 1].end;
      buf = buf.slice(lastEnd);
    }
  });
});

server.listen(2576, '127.0.0.1', () => console.log('ACK server listening on 2576'));
