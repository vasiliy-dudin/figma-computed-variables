import { Button } from '@create-figma-plugin/ui';
import { h } from 'preact';

interface ToolbarProps {
	onImport: () => void;
	onApply: () => void;
	onSave: () => void;
	hasErrors: boolean;
}

export function Toolbar({ onImport, onApply, onSave, hasErrors }: ToolbarProps) {
	return (
		<div style={{ padding: '12px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
			<div>
				<Button onClick={onImport} secondary>
					Import from Variables
				</Button>
			</div>
			<div style={{ display: 'flex', gap: '8px' }}>
				<Button onClick={onApply} disabled={hasErrors}>
					Apply to Variables
				</Button>
				<Button onClick={onSave} disabled={hasErrors}>
					Save
				</Button>
			</div>
		</div>
	);
}
