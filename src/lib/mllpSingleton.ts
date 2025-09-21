import { MLLPServer, buildAck, mllpWrap } from './mllpServer';
import type net from 'net';

let instance: MLLPServer | null = null;

function ensure(port: number, host: string) {
  if (!instance) {
    instance = new MLLPServer(host, port, async (hl7: string, socket: net.Socket) => {
      // TODO: route to your pipeline, log, etc.
      const ack = buildAck(hl7, 'AA');
      socket.write(mllpWrap(ack));
    });
  }
  return instance;
}

export function getServer() {
  return instance;
}

export function startServer(port = 6000, host = '127.0.0.1') {
  const s = ensure(port, host);
  if (!s.running) s.start();
  return s.status();
}

export function stopServer() {
  const s = getServer();
  if (s) s.stop();
  return s?.status() ?? { running: false };
}

export function statusServer() {
  const s = getServer();
  return s?.status() ?? { running: false };
}