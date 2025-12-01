import { Duplex } from 'stream';
import { MockBinding } from '@serialport/binding-mock';

export class MockSerialPort extends Duplex {
  override _read(_size: number) {}

  override _write(chunk: any, _encoding: BufferEncoding, callback: (error?: Error | null) => void) {
    this.push(chunk);
    callback();
  }
}

export { MockBinding };
