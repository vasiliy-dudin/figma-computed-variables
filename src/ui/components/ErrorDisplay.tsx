import { h } from 'preact';
import { Banner } from '@create-figma-plugin/ui';
import { ValidationError } from '@core/types';

interface ErrorDisplayProps {
	errors: ValidationError[];
}

export function ErrorDisplay({ errors }: ErrorDisplayProps) {
	if (errors.length === 0) return null;

	return (
		<div style={{ padding: '12px', borderTop: '1px solid var(--color-border)' }}>
			<Banner icon="⚠" variant="warning">
				<strong>Validation Errors ({errors.length})</strong>
				<ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
					{errors.map((error, i) => (
						<li key={i} style={{ marginBottom: '4px' }}>
							<strong>{error.collection}</strong>
							{error.token && `, token "${error.token}"`}
							{error.mode && ` (${error.mode})`}: {error.message}
						</li>
					))}
				</ul>
			</Banner>
		</div>
	);
}
