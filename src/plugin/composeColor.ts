import type { AlphaIntent } from '@core/types';
import type { VariableIndex } from '@plugin/variableIndex';

// Figma's opacity range for a composed colour; alpha() amounts above it clamp to opaque anyway.
const MIN_OPACITY_PERCENT = 0;
const MAX_OPACITY_PERCENT = 100;

/**
 * Figma's composed colour: a colour variable value made of a colour and a separate opacity,
 * where at least one of the two is a reference to another variable. Introduced for plugins
 * by Plugin API update 139 (2026-09-17) and not yet in @figma/plugin-typings (1.138.0).
 * Figma writes and reads the same shape, including for values set by hand in its UI, and
 * opacity is a percentage on a 0-100 scale — both confirmed in real Figma on 2026-09-21,
 * where `opacity: 50` resolves to alpha 0.5.
 */
export interface VariableComposedColor {
	color: VariableAlias | RGB;
	opacity: VariableAlias | number;
}

/** The colour side of a composed colour: a referenced variable or a literal colour. */
export type ComposedColorSource =
	| { kind: 'alias'; id: string }
	| { kind: 'rgb'; value: RGB };

/** The opacity side of a composed colour: a referenced variable or a 0-100 percentage. */
export type ComposedOpacity =
	| { kind: 'alias'; id: string }
	| { kind: 'percent'; value: number };

export interface ComposedColorParts {
	color: ComposedColorSource;
	opacity: ComposedOpacity;
}

/**
 * Reads a composed colour, or returns null for any other value.
 * Takes `unknown` rather than `VariableValue`: the typings' VariableValue union does not
 * describe this shape yet, so it cannot express what this function recognises.
 */
export function readComposedColor(value: unknown): ComposedColorParts | null {
	if (!isVariableComposedColor(value)) return null;
	return { color: toColorSource(value.color), opacity: toOpacity(value.opacity) };
}

/**
 * Writes an alpha() intent as a native composed colour: a reference to the base variable plus
 * an opacity, which is a reference to the amount token's variable when that paints the same
 * colour, and the clamped percentage otherwise. Returns false — leaving the caller to write
 * the computed colour — when the base variable does not exist yet or Figma rejects the value.
 */
export function writeComposedColor(variable: Variable, modeId: string, intent: AlphaIntent, index: VariableIndex): boolean {
	const target = index.find(intent.targetPath);
	if (!target) return false;

	const value: VariableComposedColor = {
		color: { type: 'VARIABLE_ALIAS', id: target.id },
		opacity: opacityFor(intent, index),
	};

	try {
		// The typings (1.138.0) do not describe composed colours yet, so VariableValue cannot hold one.
		variable.setValueForMode(modeId, value as unknown as VariableValue);
		return true;
	} catch (err) {
		console.warn(`[writeComposedColor] Figma rejected a composed colour for "${variable.name}"; writing the computed colour instead.`, err);
		return false;
	}
}

function opacityFor(intent: AlphaIntent, index: VariableIndex): VariableAlias | number {
	const opacityVariable = intent.opacityTokenPath ? index.find(intent.opacityTokenPath) : null;
	if (opacityVariable?.resolvedType === 'FLOAT') {
		return { type: 'VARIABLE_ALIAS', id: opacityVariable.id };
	}
	return Math.min(MAX_OPACITY_PERCENT, Math.max(MIN_OPACITY_PERCENT, intent.percent));
}

function toColorSource(color: VariableAlias | RGB): ComposedColorSource {
	return isVariableAlias(color) ? { kind: 'alias', id: color.id } : { kind: 'rgb', value: color };
}

function toOpacity(opacity: VariableAlias | number): ComposedOpacity {
	return typeof opacity === 'number' ? { kind: 'percent', value: opacity } : { kind: 'alias', id: opacity.id };
}

function isVariableComposedColor(value: unknown): value is VariableComposedColor {
	if (typeof value !== 'object' || value === null) return false;

	const candidate = value as { color?: unknown; opacity?: unknown };
	const colorIsValid = isVariableAlias(candidate.color) || isRgb(candidate.color);
	const opacityIsValid = isVariableAlias(candidate.opacity) || isFiniteNumber(candidate.opacity);
	return colorIsValid && opacityIsValid;
}

function isVariableAlias(value: unknown): value is VariableAlias {
	if (typeof value !== 'object' || value === null) return false;
	const candidate = value as { type?: unknown; id?: unknown };
	return candidate.type === 'VARIABLE_ALIAS' && typeof candidate.id === 'string';
}

function isRgb(value: unknown): value is RGB {
	if (typeof value !== 'object' || value === null) return false;
	const candidate = value as { r?: unknown; g?: unknown; b?: unknown };
	return isFiniteNumber(candidate.r) && isFiniteNumber(candidate.g) && isFiniteNumber(candidate.b);
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value);
}
