import { h } from 'preact';

interface StatusBarProps {
	tokenCount: number;
	collectionCount: number;
}

export function StatusBar({ tokenCount, collectionCount }: StatusBarProps) {
	return (
		<div class="status-bar">
			Status: {tokenCount} tokens | {collectionCount} collections
		</div>
	);
}
