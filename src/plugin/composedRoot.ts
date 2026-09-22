import { readComposedColor, isVariableAlias } from '@plugin/composeColor';

/** What Import knows while formatting one value: every loaded variable, and where the value sits. */
export interface ImportContext {
	byId: Map<string, Variable>;
	// The collection and mode of the value being formatted.
	collectionId: string;
	modeId: string;
}

/** One hop from a variable: to its alias target, or to the colour side of its composed colour. */
interface Step {
	id: string;
	throughComposed: boolean;
}

/**
 * The variable a composed colour's colour really comes from, for Import to reference.
 * Figma replaces a base's alpha rather than multiplying it, so {glass, 42} with glass = {brand, 50}
 * paints brand at 42 %. Import must say alpha({brand}, 42%): alpha({glass}, 42%) would mean
 * 42 % of 50 % to the plugin, and the next Apply would halve the colour.
 *
 * Walks from the target through plain aliases and composed colours; the root is the colour side
 * of the last composed colour on the way. With no composed colour on the way the target itself is
 * returned, as before. The walk stops where it cannot tell the next step for certain — see step().
 */
export function findComposedRoot(targetId: string, context: ImportContext): string {
	let root = targetId;
	let current = targetId;
	const walked = new Set<string>();

	while (!walked.has(current)) {
		walked.add(current);
		const next = step(current, context);
		if (!next) break;
		if (next.throughComposed) root = next.id;
		current = next.id;
	}
	return root;
}

/**
 * The next hop, or null to stop. A variable in the collection being imported is read in the
 * mode being imported. A variable in another collection has its own modes, and which one Figma
 * would use depends on where the colour is consumed, so it is followed only when every one of
 * its modes leads to the same next variable.
 */
function step(variableId: string, context: ImportContext): Step | null {
	const variable = context.byId.get(variableId);
	if (!variable) return null;

	if (variable.variableCollectionId === context.collectionId) {
		return stepFrom(variable.valuesByMode[context.modeId]);
	}

	const steps = Object.values(variable.valuesByMode).map(stepFrom);
	const [first] = steps;
	const allSame = steps.every(s => s !== null && first !== null && s.id === first.id && s.throughComposed === first.throughComposed);
	return allSame ? first : null;
}

function stepFrom(value: unknown): Step | null {
	const composed = readComposedColor(value);
	if (composed) {
		// A literal colour side has no variable to reference, so the walk ends before it.
		return composed.color.kind === 'alias' ? { id: composed.color.id, throughComposed: true } : null;
	}
	return isVariableAlias(value) ? { id: value.id, throughComposed: false } : null;
}
