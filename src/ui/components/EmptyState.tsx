import { h } from 'preact';
import { useState } from 'preact/hooks';
import { Button } from '@create-figma-plugin/ui';
import { ExampleConfigModal } from './ExampleConfigModal';
import type { ExampleOptions } from '@core/constants';

interface EmptyStateProps {
	onLoadExample: (options: ExampleOptions) => void;
	onStartFromScratch: () => void;
}

export function EmptyState({ onLoadExample, onStartFromScratch }: EmptyStateProps) {
	const [isModalOpen, setIsModalOpen] = useState(false);

	return (
		<div style={{
			display: 'flex',
			flexDirection: 'column',
			alignItems: 'center',
			justifyContent: 'center',
			height: '100%',
			gap: '12px',
			padding: '32px',
			textAlign: 'center',
		}}>
			<p style={{ margin: 0, fontWeight: 600 }}>How would you like to start?</p>
			<div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
				<Button onClick={() => setIsModalOpen(true)} secondary>
					Load example JSON
				</Button>
				<Button onClick={onStartFromScratch}>
					Start from scratch
				</Button>
			</div>
			<ExampleConfigModal
				open={isModalOpen}
				onClose={() => setIsModalOpen(false)}
				onConfirm={(options) => { setIsModalOpen(false); onLoadExample(options); }}
			/>
		</div>
	);
}
