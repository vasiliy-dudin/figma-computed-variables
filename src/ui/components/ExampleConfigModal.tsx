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
			<div style={{ width: '280px', padding: '0 16px 16px' }}>

				<SectionLabel top={16}>Modes</SectionLabel>
				{(['1', '2'] as const).map((v) => (
					<RadioItem
						key={v}
						label={v === '1' ? '1 mode' : '2 modes'}
						checked={modeCount === v}
						onChange={() => setModeCount(v)}
					/>
				))}

				<SectionLabel top={16}>Optional fields</SectionLabel>
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

				<div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
					<Button secondary onClick={onClose}>Cancel</Button>
					<Button onClick={handleConfirm}>OK</Button>
				</div>

			</div>
		</Modal>
	);
}

function SectionLabel({ children, top }: { children: string; top: number }) {
	return (
		<div style={{
			fontWeight: 600,
			fontSize: '12px',
			color: 'var(--figma-color-text)',
			marginTop: `${top}px`,
			marginBottom: '8px',
		}}>
			{children}
		</div>
	);
}

function RadioItem({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
	return (
		<div
			onClick={onChange}
			style={{
				display: 'flex',
				alignItems: 'center',
				gap: '8px',
				height: '24px',
				cursor: 'pointer',
				userSelect: 'none',
			}}
		>
			<div style={{
				width: '14px',
				height: '14px',
				borderRadius: '50%',
				border: `1px solid ${checked ? 'var(--figma-color-border-brand-strong)' : 'var(--figma-color-border-strong)'}`,
				backgroundColor: checked ? 'var(--figma-color-bg-inverse)' : 'var(--figma-color-bg)',
				boxShadow: '0 0 0 2.5px var(--figma-color-bg) inset',
				flexShrink: 0,
			}} />
			<span style={{ fontSize: '12px', color: 'var(--figma-color-text)' }}>{label}</span>
		</div>
	);
}

function CheckboxItem({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
	return (
		<div
			onClick={() => onChange(!checked)}
			style={{
				display: 'flex',
				alignItems: 'center',
				gap: '8px',
				height: '24px',
				cursor: 'pointer',
				userSelect: 'none',
			}}
		>
			<div style={{
				width: '16px',
				height: '16px',
				borderRadius: 'var(--border-radius-4)',
				border: `1px solid ${checked ? 'var(--figma-color-border-brand-strong)' : 'var(--figma-color-border)'}`,
				backgroundColor: checked ? 'var(--figma-color-bg-brand)' : 'var(--figma-color-bg-secondary)',
				flexShrink: 0,
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
			}}>
				{checked && (
					<svg width="10" height="8" viewBox="0 0 10 8" fill="none">
						<path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
					</svg>
				)}
			</div>
			<span style={{ fontSize: '12px', color: 'var(--figma-color-text)' }}>{label}</span>
		</div>
	);
}
