/** What Apply did differently from what was asked, shown until dismissed or the next Apply. */
export interface ApplyNoticeContent {
	notes: string[];
	// A warning when something went wrong (Figma refused a value); plain info when it was deliberate.
	isWarning: boolean;
}

const pluralValues = (count: number): string => (count === 1 ? 'value' : 'values');

/**
 * What Apply did differently from what was asked, or null when it did exactly that. Staying
 * silent would read as if every alpha() had become a live reference.
 * - some alpha() values are fixed colours because Figma refused a linked one, which usually
 *   means an outdated Figma app — a warning;
 * - opacity references over a translucent colour were left in place, deliberately.
 */
export function applyNoticeFor(preservedComposedColors: number, rejectedComposedColors: number): ApplyNoticeContent | null {
	const notes: string[] = [];
	if (rejectedComposedColors > 0) {
		notes.push(`${rejectedComposedColors} alpha() ${pluralValues(rejectedComposedColors)} saved as fixed colours instead of linked ones: Figma refused the linked value. Update the Figma app and apply again.`);
	}
	if (preservedComposedColors > 0) {
		notes.push(`Kept ${preservedComposedColors} opacity-reference ${pluralValues(preservedComposedColors)} over translucent colours unchanged: rewriting them would change their colour.`);
	}
	return notes.length === 0 ? null : { notes, isWarning: rejectedComposedColors > 0 };
}
