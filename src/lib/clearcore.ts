import { SerialPort, ReadlineParser } from "serialport";
import {
  MotorState,
  MotorMoveParameters,
  MotorVelocityParameters,
  DigitalPinWriteParameters,
  PinMode,
} from "../models/clearcore";
import { Duplex } from "stream";

export interface IClearCore {
  getVersion(): Promise<string>;
  expansionBoardsState(): Promise<{ nrBoards: number; nrPorts: number }>;
  resetBuffer(): Promise<void>;

  readMotors(...motors: number[]): Promise<MotorState[]>;
  enableMotors(...motors: number[]): Promise<void>;
  disableMotors(...motors: number[]): Promise<void>;
  moveMotors(...motors: MotorMoveParameters[]): Promise<void>;
  setMotorsHome(...motors: number[]): Promise<void>;
  setMotorsVelocity(...motors: MotorVelocityParameters[]): Promise<void>;
  stopMotors(...motors: number[]): Promise<void>;
  motorsSetEStopPin(pin: number): Promise<void>;
  disableAllMotors(): Promise<void>;

  setPinsMode(mode: PinMode, ...pins: number[]): Promise<void>;
  readDigitalSensors(...sensors: number[]): Promise<boolean[]>;
  readAnalogSensors(...sensors: number[]): Promise<number[]>;
  writeDigitalPins(...pins: DigitalPinWriteParameters[]): Promise<void>;
}

/**
 * A type guard to check if the port is a real SerialPort instance.
 * This function helps TypeScript narrow down the type from `SerialPort | Duplex` to just `SerialPort`.
 */
function isSerialPort(port: SerialPort | Duplex): port is SerialPort {
  return port instanceof SerialPort;
}

const MAX_COMMAND_ID = 1000000;

export class ClearCore implements IClearCore {
  public port: SerialPort | Duplex;
  private parser: ReadlineParser;
  private commandQueue: Promise<any> = Promise.resolve();
  private enabledMotors: Set<number> = new Set();
  private commandIdCounter = 0;

  constructor(port: SerialPort | Duplex) {
    this.port = port;
    this.parser = this.port.pipe(new ReadlineParser({ delimiter: "\n" }));
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (isSerialPort(this.port)) {
        if (this.port.isOpen) {
          return resolve();
        }
        this.port.on("open", resolve);
        this.port.on("error", reject);
      } else {
        resolve();
      }
    });
  }

  async disconnect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const callback = (err?: Error | null) => {
        if (err) return reject(err);
        resolve();
      };
      if (isSerialPort(this.port) && this.port.isOpen) {
        this.port.close(callback);
      } else {
        this.port.destroy();
        resolve();
      }
    });
  }

  private sendCommand(command: string, timeoutMs = 100): Promise<string> {
    this.commandQueue = this.commandQueue.then(
      () =>
        new Promise((resolve, reject) => {
          // Reset the buffer before sending the command.
          this.resetBuffer();

          let timeoutId: NodeJS.Timeout;

          // Add the command ID to the command string.
          const currentCommandId = this.commandIdCounter;
          const commandWithId = `${currentCommandId};${command}`;

          // Increment the command ID counter.
          this.commandIdCounter++;
          this.commandIdCounter %= MAX_COMMAND_ID;

          // Forward declare the error listener so dataListener can access it.
          let errorListener: (err: Error) => void;

          const dataListener = (data: Buffer | string) => {
            clearTimeout(timeoutId);
            this.port.removeListener("error", errorListener);

            // Check that the response id matches the command id.
            const id = parseInt(
              data.toString().trim().split(";")[0] ?? "-1",
              10,
            );
            if (id !== currentCommandId) {
              reject(
                new Error(
                  `Command ID mismatch. Sent: ${currentCommandId}, Received: ${id}. Response: "${data}"`,
                ),
              );
              return;
            }

            resolve(data.toString().trim());
          };

          errorListener = (err: Error) => {
            clearTimeout(timeoutId);
            this.parser.removeListener("data", dataListener);
            reject(err);
          };

          timeoutId = setTimeout(() => {
            this.parser.removeListener("data", dataListener);
            this.port.removeListener("error", errorListener);
            reject(
              new Error(
                `Command "${commandWithId}" timed out after ${timeoutMs}ms`,
              ),
            );
          }, timeoutMs);

          this.parser.once("data", dataListener);
          this.port.once("error", errorListener);

          this.port.write(
            `${commandWithId}\n`,
            (err: Error | null | undefined) => {
              if (err) {
                // If the write itself fails, trigger the error handling.
                errorListener(err);
              }
            },
          );
        }),
    );
    return this.commandQueue;
  }

  async resetBuffer(): Promise<void> {
    // Assign this.port to a local constant.
    const port = this.port;

    // Perform the type check on the constant.
    if (isSerialPort(port)) {
      // Inside this block, `port` is now guaranteed to be of type `SerialPort`.
      // This narrowed type is preserved inside the Promise closure.
      return new Promise((resolve, reject) => {
        // Use the local constant `port` here, NOT `this.port`.
        port.flush((err: Error | null | undefined) => {
          if (err) return reject(err);
          resolve();
        });
      });
    }

    // If it's a generic Duplex stream, there's no flush method.
    return Promise.resolve();
  }

  async getVersion(): Promise<string> {
    const response = await this.sendCommand("GET_VERSION;0");
    const parts = response.split(";");
    return parts.slice(2, 22).join("");
  }

  async expansionBoardsState(): Promise<{ nrBoards: number; nrPorts: number }> {
    const response = await this.sendCommand("EXPANSION_BOARDS_STATE;0");
    const parts = response.split(";");
    return {
      nrBoards: parseInt(parts[2] ?? "0", 10),
      nrPorts: parseInt(parts[3] ?? "0", 10),
    };
  }

  async readMotors<T extends number[]>(
    ...motors: T
  ): Promise<{ [K in keyof T]: MotorState }> {
    const selector = motors.reduce((acc, motor) => acc | (1 << motor), 0);
    const response = await this.sendCommand(`MOTORS_STATE;1;${selector}`);
    const parts = response.split(";").slice(2, -1);
    const states: MotorState[] = [];
    for (let i = 0; i < parts.length; i += 7) {
      states.push({
        isWritable: parts[i] === "1",
        enabled: parts[i + 1] === "1",
        stepsComplete: parts[i + 2] === "1",
        isInHardwareFault: parts[i + 3] === "1",
        hlfbState: parseInt(parts[i + 4] ?? "0", 10),
        hlfbMode: parseInt(parts[i + 5] ?? "0", 10),
        position: parseInt(parts[i + 6] ?? "0", 10),
      });
    }
    return states as { [K in keyof T]: MotorState };
  }

  private async setEnabledMotors(...motors: number[]): Promise<void> {
    const selector = motors.reduce((acc, motor) => acc | (1 << motor), 0);
    await this.sendCommand(`MOTORS_ENABLE;1;${selector}`);
  }

  async enableMotors(...motors: number[]): Promise<void> {
    for (const motor of motors) {
      this.enabledMotors.add(motor);
    }
    await this.setEnabledMotors(...this.enabledMotors);
  }

  async disableMotors(...motors: number[]): Promise<void> {
    for (const motor of motors) {
      this.enabledMotors.delete(motor);
    }
    await this.setEnabledMotors(...this.enabledMotors);
  }

  async moveMotors(...motors: MotorMoveParameters[]): Promise<void> {
    const selector = motors.reduce((acc, motor) => acc | (1 << motor.id), 0);
    const args = motors
      .map((m) => `${m.steps};${m.velocity};${m.acceleration}`)
      .join(";");
    await this.sendCommand(
      `MOTORS_MOVE;${1 + motors.length * 3};${selector};${args}`,
    );
  }

  async setMotorsHome(...motors: number[]): Promise<void> {
    const selector = motors.reduce((acc, motor) => acc | (1 << motor), 0);
    await this.sendCommand(`MOTORS_HOME;1;${selector}`);
  }

  async setMotorsVelocity(...motors: MotorVelocityParameters[]): Promise<void> {
    const selector = motors.reduce((acc, motor) => acc | (1 << motor.id), 0);
    const args = motors.map((m) => `${m.velocity};${m.acceleration}`).join(";");
    await this.sendCommand(
      `MOTORS_SET_VELOCITY;${1 + motors.length * 2};${selector};${args}`,
    );
  }

  async stopMotors(...motors: number[]): Promise<void> {
    const selector = motors.reduce((acc, motor) => acc | (1 << motor), 0);
    await this.sendCommand(`MOTORS_STOP_ABRUPT;1;${selector}`);
  }

  async motorsSetEStopPin(pin: number): Promise<void> {
    await this.sendCommand(`MOTORS_SET_ESTOP_PIN;1;${pin}`);
  }

  async disableAllMotors(): Promise<void> {
    await this.sendCommand(`MOTORS_ENABLE;1;0`);
  }

  async setPinsMode(mode: PinMode, ...pins: number[]): Promise<void> {
    const selector = pins.reduce((acc, pin) => acc | (1 << pin), 0);
    await this.sendCommand(`PINS_MODE_SET;2;${selector};${mode}`);
  }

  async readDigitalSensors<T extends number[]>(
    ...sensors: T
  ): Promise<{ [K in keyof T]: boolean }> {
    const selector = sensors.reduce((acc, sensor) => acc | (1 << sensor), 0);
    const response = await this.sendCommand(`DSENSORS_STATE;1;${selector}`);
    return response
      .split(";")
      .slice(2, -1)
      .map((s) => s === "1") as { [K in keyof T]: boolean };
  }

  async readAnalogSensors<T extends number[]>(
    ...sensors: T
  ): Promise<{ [K in keyof T]: number }> {
    const selector = sensors.reduce((acc, sensor) => acc | (1 << sensor), 0);
    const response = await this.sendCommand(`ASENSORS_STATE;1;${selector}`);
    return response
      .split(";")
      .slice(2, -1)
      .map((s) => parseInt(s, 10)) as { [K in keyof T]: number };
  }

  async writeDigitalPins(...pins: DigitalPinWriteParameters[]): Promise<void> {
    const selector = pins.reduce((acc, pin) => acc | (1 << pin.id), 0);
    const values = pins.map((p) => `${p.value ? 1 : 0}`).join(";");
    await this.sendCommand(
      `DPINS_SET;${1 + pins.length};${selector};${values}`,
    );
  }
}
