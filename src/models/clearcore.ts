export interface MotorState {
	isWritable: boolean;
	enabled: boolean;
	stepsComplete: boolean;
	isInHardwareFault: boolean;
	hlfbState: HLFBState;
	hlfbMode: number;
	position: number;
}

export interface MotorMoveParameters {
	id: number;
	steps: number;
	velocity: number;
	acceleration: number;
}

export interface MotorVelocityParameters {
	id: number;
	velocity: number;
	acceleration: number;
}

export interface DigitalPinWriteParameters {
	id: number;
	value: boolean;
}

export enum HLFBState {
	DeAsserted = 0,
	Asserted = 1,
	HasMeasurement = 2,
	Unknown = 3,
}

export enum PinMode {
	DigitalInput = 0,
	DigitalOutput = 1,
	AnalogInput = 2,
	AnalogOutput = 3,
}
