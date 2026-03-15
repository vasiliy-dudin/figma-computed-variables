import { h } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { Button, Modal } from '@create-figma-plugin/ui';
import type { ExampleOptions } from '@core/constants';

interface ExampleConfigModalProps {
	open: boolean;
	onClose: () => void;
	onConfirm: (options: ExampleOptions) => void;
}

export function ExampleConfigModal({ open, onClose, onConfirm }: ExampleConfigModalProps) {
	const [modeCount, setModeCount] = useState<'1' | '2'>('2');
	const [includeDescription, setIncludeDescription] = useState(false);
	const [includeScope, setIncludeScope] = useState(false);

	// Reset to defaults each time the modal opens
	useEffect(() => {
		if (open) {
			setModeCount('2');
			setIncludeDescription(false);
			setIncludeScope(false);
		}
	}, [open]);

	function handleConfirm(): void {
		onConfirm({ modeCount, includeDescription, includeScope });
	}

	return (
		<Modal
			open={open}
			title="Example JSON options"
			onCloseButtonClick={onClose}
			onEscapeKeyDown={onClose}
			onOverlayClick={onClose}
		>
			<div class="modal-body">

				<SectionLabel>Modes</SectionLabel>
				{(['1', '2'] as const).map((v) => (
					<RadioItem
						key={v}
						label={v === '1' ? '1 mode' : '2 modes'}
						checked={modeCount === v}
						onChange={() => setModeCount(v)}
					/>
				))}

				<SectionLabel>Optional fields</SectionLabel>
				<CheckboxItem
					label="Include $description"
					checked={includeDescription}
					onChange={setIncludeDescription}
				/>
				<CheckboxItem
					label="Include $scope"
					checked={includeScope}
					onChange={setIncludeScope}
				/>

				<div class="modal-actions">
					<Button secondary onClick={onClose}>Cancel</Button>
					<Button onClick={handleConfirm}>OK</Button>
				</div>

			</div>
		</Modal>
	);
}

function SectionLabel({ children }: { children: string }) {
	return (
		<div class="section-label">{children}</div>
	);
}

function RadioItem({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
	return (
		<div class="select-row" onClick={onChange}>
			<div class={`radio-dot${checked ? ' radio-dot--checked' : ''}`} />
			<span class="select-row-label">{label}</span>
		</div>
	);
}

function CheckboxItem({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
	return (
		<div class="select-row" onClick={() => onChange(!checked)}>
			<div class={`checkbox-box${checked ? ' checkbox-box--checked' : ''}`}>
				{checked && (
					<svg width="10" height="8" viewBox="0 0 10 8" fill="none">
						<path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
					</svg>
				)}
			</div>
			<span class="select-row-label">{label}</span>
		</div>
	);
}
