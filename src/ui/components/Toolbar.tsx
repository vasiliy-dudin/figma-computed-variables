import { Button } from '@create-figma-plugin/ui';
import { h } from 'preact';
import { DocsDropdown } from './DocsDropdown';
import type { ApplyStatus } from '@core/messages';

interface ToolbarProps {
	onImport: () => void;
	onApply: () => void;
	onSave: () => void;
	hasErrors: boolean;
	isEmpty: boolean;
	applyStatus: ApplyStatus;
	onOpenDocsDropdown: () => void;
	onCloseDocsDropdown: () => void;
	isDocsDropdownOpen: boolean;
}

export function Toolbar({
	onImport,
	onApply,
	onSave,
	hasErrors,
	isEmpty,
	applyStatus,
	onOpenDocsDropdown,
	onCloseDocsDropdown,
	isDocsDropdownOpen
}: ToolbarProps) {
	if (isEmpty) {
		return (
			<div class="toolbar">
				<Button onClick={onImport} secondary>Import from Variables</Button>
			</div>
		);
	}

	return (
		<div class="toolbar toolbar--between">
			<div class="layout-row">
				<Button onClick={onImport} secondary>Import from Variables</Button>
				<div class="position-relative">
					<Button onClick={onOpenDocsDropdown} secondary>
						<span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
							Help
							<svg width="8" height="6" viewBox="0 0 8 6" fill="none">
								<path d="M1 1L4 4L7 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
							</svg>
						</span>
					</Button>
					<DocsDropdown
						isOpen={isDocsDropdownOpen}
						onClose={onCloseDocsDropdown}
					/>
				</div>
			</div>
			<div class="layout-row">
				<Button onClick={onSave} disabled={hasErrors} secondary>Save</Button>
				<Button onClick={onApply} disabled={hasErrors || applyStatus === 'running'}>
					{applyStatus === 'queued' ? 'Apply queued…' : applyStatus === 'running' ? 'Applying…' : 'Apply to Variables'}
				</Button>
			</div>
		</div>
	);
}
