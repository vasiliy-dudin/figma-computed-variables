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
		<div class="empty-state">
			<p class="empty-state-heading">How would you like to start?</p>
			<div class="empty-state-actions">
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
