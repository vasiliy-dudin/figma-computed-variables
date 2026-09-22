import { h } from 'preact';
import { Banner } from '@create-figma-plugin/ui';
import type { ApplyNoticeContent } from '@ui/applyNotice';

interface ApplyNoticeProps {
	notice: ApplyNoticeContent;
	onDismiss: () => void;
}

/**
 * Persistent note after a successful Apply. A toast is too brief and too narrow for this:
 * it disappears after two seconds and does not wrap, so a long note was cut off and missed.
 */
export function ApplyNotice({ notice, onDismiss }: ApplyNoticeProps) {
	return (
		<div class="error-display">
			<Banner icon={notice.isWarning ? '⚠' : 'ℹ'} variant={notice.isWarning ? 'warning' : undefined}>
				<ul class="error-list">
					{notice.notes.map((note, i) => (
						<li key={i} class="error-list-item">{note}</li>
					))}
				</ul>
				<button type="button" class="apply-notice-dismiss" onClick={onDismiss}>
					Dismiss
				</button>
			</Banner>
		</div>
	);
}
