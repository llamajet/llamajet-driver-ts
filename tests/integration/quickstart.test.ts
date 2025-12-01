import { describe, it, expect } from "vitest";
import { ClearCore } from "../../src/lib/clearcore";
import { Duplex } from "stream";

class TestStream extends Duplex {
  override _read(_size: number) { }
  override _write(
    chunk: any,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ) {
    if (chunk.toString() === "0;GET_VERSION;0\n") {
      this.push(
        Buffer.from(
          "0;0;1;2;3;4;5;6;7;8;9;10;11;12;13;14;15;16;17;18;19;20;\n",
        ),
      );
    } else if (chunk.toString() === "0;EXPANSION_BOARDS_STATE;0\n") {
      this.push(Buffer.from("0;0;2;16;\n"));
    } else if (chunk.toString() === "\r") {
      // No response for reset buffer
    } else if (chunk.toString() === "0;MOTORS_STATE;1;5\n") {
      this.push(Buffer.from("0;0;1;1;1;0;1;0;100;1;0;1;0;1;0;200;\n"));
    } else if (chunk.toString() === "0;MOTORS_ENABLE;1;5\n") {
      this.push(Buffer.from("0;0;\n"));
    } else if (chunk.toString() === "0;MOTORS_MOVE;4;1;100;1000;10000\n") {
      this.push(Buffer.from("0;0;\n"));
    } else if (chunk.toString() === "0;MOTORS_HOME;1;5\n") {
      this.push(Buffer.from("0;0;\n"));
    } else if (chunk.toString() === "0;MOTORS_SET_VELOCITY;3;1;1000;10000\n") {
      this.push(Buffer.from("0;0;\n"));
    } else if (chunk.toString() === "0;MOTORS_STOP_ABRUPT;1;5\n") {
      this.push(Buffer.from("0;0;\n"));
    } else if (chunk.toString() === "0;MOTORS_SET_ESTOP_PIN;1;1\n") {
      this.push(Buffer.from("0;0;\n"));
    } else if (chunk.toString() === "0;MOTORS_ENABLE;1;0\n") {
      this.push(Buffer.from("0;0;\n"));
    } else if (chunk.toString() === "0;PINS_MODE_SET;2;5;1\n") {
      this.push(Buffer.from("0;0;\n"));
    } else if (chunk.toString() === "0;DSENSORS_STATE;1;5\n") {
      this.push(Buffer.from("0;0;1;0;\n"));
    } else if (chunk.toString() === "0;ASENSORS_STATE;1;5\n") {
      this.push(Buffer.from("0;0;100;200;\n"));
    } else if (chunk.toString() === "0;DPINS_SET;3;5;1;0\n") {
      this.push(Buffer.from("0;0;\n"));
    }
    callback();
  }
}

describe("Quickstart", () => {
  it("should be possible to get the version", async () => {
    const stream = new TestStream();
    const robot = new ClearCore(stream as any);

    const version = await robot.getVersion();
    expect(version).toBe("1234567891011121314151617181920");
  });

  it("should be possible to get the expansion boards state", async () => {
    const stream = new TestStream();
    const robot = new ClearCore(stream as any);

    const state = await robot.expansionBoardsState();
    expect(state).toEqual({ nrBoards: 2, nrPorts: 16 });
  });

  it("should be possible to reset the buffer", async () => {
    const stream = new TestStream();
    const robot = new ClearCore(stream as any);
    await robot.resetBuffer();
  });

  it("should be possible to read motors", async () => {
    const stream = new TestStream();
    const robot = new ClearCore(stream as any);
    const states = await robot.readMotors(0, 2);
    expect(states).toEqual([
      {
        isWritable: true,
        enabled: true,
        stepsComplete: true,
        isInHardwareFault: false,
        hlfbState: 1,
        hlfbMode: 0,
        position: 100,
      },
      {
        isWritable: true,
        enabled: false,
        stepsComplete: true,
        isInHardwareFault: false,
        hlfbState: 1,
        hlfbMode: 0,
        position: 200,
      },
    ]);
  });

  it("should be possible to enable motors", async () => {
    const stream = new TestStream();
    const robot = new ClearCore(stream as any);
    await robot.enableMotors(0, 2);
  });

  it("should be possible to move motors", async () => {
    const stream = new TestStream();
    const robot = new ClearCore(stream as any);
    await robot.moveMotors({
      id: 0,
      steps: 100,
      velocity: 1000,
      acceleration: 10000,
    });
  });

  it("should be possible to set motors home", async () => {
    const stream = new TestStream();
    const robot = new ClearCore(stream as any);
    await robot.setMotorsHome(0, 2);
  });

  it("should be possible to set motors velocity", async () => {
    const stream = new TestStream();
    const robot = new ClearCore(stream as any);
    await robot.setMotorsVelocity({
      id: 0,
      velocity: 1000,
      acceleration: 10000,
    });
  });

  it("should be possible to stop motors", async () => {
    const stream = new TestStream();
    const robot = new ClearCore(stream as any);
    await robot.stopMotors(0, 2);
  });

  it("should be possible to set estop pin", async () => {
    const stream = new TestStream();
    const robot = new ClearCore(stream as any);
    await robot.motorsSetEStopPin(1);
  });

  it("should be possible to disable all motors", async () => {
    const stream = new TestStream();
    const robot = new ClearCore(stream as any);
    await robot.disableAllMotors();
  });

  it("should be possible to set pins mode", async () => {
    const stream = new TestStream();
    const robot = new ClearCore(stream as any);
    await robot.setPinsMode(1, 0, 2);
  });

  it("should be possible to read digital sensors", async () => {
    const stream = new TestStream();
    const robot = new ClearCore(stream as any);
    const states = await robot.readDigitalSensors(0, 2);
    expect(states).toEqual([true, false]);
  });

  it("should be possible to read analog sensors", async () => {
    const stream = new TestStream();
    const robot = new ClearCore(stream as any);
    const states = await robot.readAnalogSensors(0, 2);
    expect(states).toEqual([100, 200]);
  });

  it("should be possible to write digital pins", async () => {
    const stream = new TestStream();
    const robot = new ClearCore(stream as any);
    await robot.writeDigitalPins(
      { id: 0, value: true },
      { id: 2, value: false },
    );
  });
});
