import { h } from 'preact';
import { Button } from '@create-figma-plugin/ui';

interface EmptyStateProps {
	onLoadExample: () => void;
	onStartFromScratch: () => void;
}

export function EmptyState({ onLoadExample, onStartFromScratch }: EmptyStateProps) {
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
				<Button onClick={onLoadExample} secondary>
					Load example JSON
				</Button>
				<Button onClick={onStartFromScratch}>
					Start from scratch
				</Button>
			</div>
		</div>
	);
}
