import { Button } from '@create-figma-plugin/ui';
import { h } from 'preact';
import { DocsDropdown } from './DocsDropdown';

interface ToolbarProps {
	onImport: () => void;
	onApply: () => void;
	onSave: () => void;
	hasErrors: boolean;
	isEmpty: boolean;
	saveSuccess: number;
	applySuccess: number;
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
	saveSuccess, 
	applySuccess,
	onOpenDocsDropdown,
	onCloseDocsDropdown,
	isDocsDropdownOpen
}: ToolbarProps) {
	if (isEmpty) {
		return (
			<div style={{ padding: '12px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}>
				<Button onClick={onImport} secondary>
					Import from Variables
				</Button>
			</div>
		);
	}

	return (
		<div style={{ padding: '12px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
			<div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
				<Button onClick={onImport} secondary>
					Import from Variables
				</Button>
				<div style={{ position: 'relative' }}>
					<Button onClick={onOpenDocsDropdown} secondary>
						<span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
							Examples and docs
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
			<div style={{ display: 'flex', gap: '8px' }}>
				<Button onClick={onApply} disabled={hasErrors}>
					{applySuccess > 0 ? "✓ Applied" : "Apply to Variables"}
				</Button>
				<Button onClick={onSave} disabled={hasErrors}>
					{saveSuccess > 0 ? "✓ Saved" : "Save"}
				</Button>
			</div>
		</div>
	);
}
