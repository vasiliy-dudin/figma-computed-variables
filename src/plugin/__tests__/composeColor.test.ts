import { describe, expect, it } from 'vitest';
import { isComposeColorValue, readComposeColor, ComposeColorValue } from '../composeColor';

// Captured verbatim from TMP-overlay @ 1:0 in the task-1 spike.
const REAL_COMPOSE_COLOR: ComposeColorValue = {
	type: 'VARIABLE_EXPRESSION',
	expressionFunction: 'COMPOSE_COLOR',
	expressionArguments: [{ type: 'VARIABLE_ALIAS', id: 'VariableID:1:3' }, 50],
};

describe('isComposeColorValue', () => {
	it('accepts the real payload captured from Figma', () => {
		expect(isComposeColorValue(REAL_COMPOSE_COLOR)).toBe(true);
	});

	it('rejects a plain VARIABLE_ALIAS', () => {
		expect(isComposeColorValue({ type: 'VARIABLE_ALIAS', id: 'VariableID:1:3' })).toBe(false);
	});

	it('rejects a flat RGBA color', () => {
		expect(isComposeColorValue({ r: 0, g: 0, b: 1, a: 1 })).toBe(false);
	});

	it('rejects a plain number or string value', () => {
		expect(isComposeColorValue(42)).toBe(false);
		expect(isComposeColorValue('#0000ff')).toBe(false);
	});

	it('rejects a VARIABLE_EXPRESSION with a different function', () => {
		expect(isComposeColorValue({
			type: 'VARIABLE_EXPRESSION',
			expressionFunction: 'ADDITION',
			expressionArguments: [1, 2],
		})).toBe(false);
	});

	it('rejects malformed expressionArguments', () => {
		expect(isComposeColorValue({
			type: 'VARIABLE_EXPRESSION',
			expressionFunction: 'COMPOSE_COLOR',
			expressionArguments: [{ type: 'VARIABLE_ALIAS', id: 'x' }],
		})).toBe(false);

		expect(isComposeColorValue({
			type: 'VARIABLE_EXPRESSION',
			expressionFunction: 'COMPOSE_COLOR',
			expressionArguments: [{ type: 'VARIABLE_ALIAS', id: 'x' }, '50'],
		})).toBe(false);
	});
});

describe('readComposeColor', () => {
	it('extracts the target id and percentage', () => {
		expect(readComposeColor(REAL_COMPOSE_COLOR)).toEqual({
			targetId: 'VariableID:1:3',
			percent: 50,
		});
	});

	it('extracts a fractional percentage unchanged', () => {
		const value: ComposeColorValue = {
			type: 'VARIABLE_EXPRESSION',
			expressionFunction: 'COMPOSE_COLOR',
			expressionArguments: [{ type: 'VARIABLE_ALIAS', id: 'VariableID:1:4' }, 12.5],
		};
		expect(readComposeColor(value)).toEqual({ targetId: 'VariableID:1:4', percent: 12.5 });
	});
});
