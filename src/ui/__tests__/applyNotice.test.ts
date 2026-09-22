import { describe, expect, it } from 'vitest';
import { applyNoticeFor } from '../applyNotice';

describe('applyNoticeFor', () => {
	it('shows nothing when Apply did exactly what was asked', () => {
		expect(applyNoticeFor(0, 0)).toBeNull();
	});

	it('warns when Figma refused linked values', () => {
		const notice = applyNoticeFor(0, 3);
		expect(notice?.isWarning).toBe(true);
		expect(notice?.notes).toHaveLength(1);
		expect(notice?.notes[0]).toMatch(/^3 alpha\(\) values saved as fixed colours/);
		expect(notice?.notes[0]).toContain('Update the Figma app');
	});

	it('informs, without warning, about values kept deliberately', () => {
		const notice = applyNoticeFor(1, 0);
		expect(notice?.isWarning).toBe(false);
		expect(notice?.notes[0]).toMatch(/^Kept 1 opacity-reference value over/);
	});

	it('lists both, refusals first, and still warns', () => {
		const notice = applyNoticeFor(2, 1);
		expect(notice?.isWarning).toBe(true);
		expect(notice?.notes).toHaveLength(2);
		expect(notice?.notes[0]).toMatch(/^1 alpha\(\) value saved/);
		expect(notice?.notes[1]).toMatch(/^Kept 2 opacity-reference values/);
	});
});
