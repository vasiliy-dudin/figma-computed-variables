import { h } from 'preact';
import { Banner } from '@create-figma-plugin/ui';
import { ValidationError } from '@core/types';

interface ErrorDisplayProps {
	errors: ValidationError[];
}

export function ErrorDisplay({ errors }: ErrorDisplayProps) {
	if (errors.length === 0) return null;

	return (
		<div class="error-display">
			<Banner icon="⚠" variant="warning">
				<strong>Validation Errors ({errors.length})</strong>
				<ul class="error-list">
					{errors.map((error, i) => (
						<li key={i} class="error-list-item">
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
