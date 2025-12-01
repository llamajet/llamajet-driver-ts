import { describe, it, expect } from 'vitest';
import { ClearCore } from '../../src/lib/clearcore';
import { Duplex } from 'stream';

class TestStream extends Duplex {
  override _read(_size: number) { }
  override _write(_chunk: any, _encoding: BufferEncoding, callback: (error?: Error | null) => void) {
    callback();
  }
}

describe('Robot contract', () => {
  it('should be possible to implement the Robot interface', () => {
    const robot = new ClearCore(new TestStream() as any);
    expect(robot).toBeDefined();
  });
});
