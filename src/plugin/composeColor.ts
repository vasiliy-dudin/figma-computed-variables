/**
 * Figma's alias-with-opacity value ("Composed Color"). Absent from
 * @figma/plugin-typings@1.137.0 — the shape below is confirmed by Figma's own
 * schema-validation errors (see PLANNING.md "Established facts"). The plugin can
 * only ever read this shape: writing it is deliberately rejected by the API.
 */
export interface ComposeColorValue {
	type: 'VARIABLE_EXPRESSION';
	expressionFunction: 'COMPOSE_COLOR';
	expressionArguments: [VariableAlias, number];
}

/**
 * Narrows a variable value to a Composed Color, rejecting any other VARIABLE_EXPRESSION function.
 * Takes `unknown` rather than `VariableValue`: the typings' VariableValue union has no
 * VARIABLE_EXPRESSION member at all, so it cannot describe the real runtime shape this
 * function is built to recognize (see PLANNING.md "Established facts").
 */
export function isComposeColorValue(value: unknown): value is ComposeColorValue {
	if (typeof value !== 'object' || value === null) return false;

	const expression = value as { type?: unknown; expressionFunction?: unknown; expressionArguments?: unknown };
	if (expression.type !== 'VARIABLE_EXPRESSION') return false;
	if (expression.expressionFunction !== 'COMPOSE_COLOR') return false;

	const args = expression.expressionArguments;
	if (!Array.isArray(args) || args.length !== 2) return false;

	const [target, percent] = args;
	return isVariableAlias(target) && typeof percent === 'number';
}

function isVariableAlias(value: unknown): value is VariableAlias {
	return (
		typeof value === 'object' &&
		value !== null &&
		'type' in value &&
		(value as { type: unknown }).type === 'VARIABLE_ALIAS' &&
		'id' in value &&
		typeof (value as { id: unknown }).id === 'string'
	);
}

/** Extracts the alias target and opacity percentage (0-100 scale) from a Composed Color value. */
export function readComposeColor(value: ComposeColorValue): { targetId: string; percent: number } {
	const [alias, percent] = value.expressionArguments;
	return { targetId: alias.id, percent };
}
