import { h } from 'preact';

interface FooterProps {
	tokenCount: number;
	collectionCount: number;
}

export function Footer({ tokenCount, collectionCount }: FooterProps) {
	return (
		<div style={{ 
			borderTop: '1px solid var(--color-border, #e0e0e0)', 
			background: 'var(--color-bg-secondary)',
			display: 'flex',
			alignItems: 'center',
			padding: '8px 12px',
			gap: '16px',
			fontSize: '12px',
			color: 'var(--color-text-secondary)',
			flexShrink: 0
		}}>
			<div style={{ fontSize: '12px' }}>
				Status: {tokenCount} tokens | {collectionCount} collections
			</div>
			<div style={{ display: 'flex', gap: '16px' }}>
				<a
					href="https://github.com/vasiliy-dudin/figma-computed-variables/issues"
					target="_blank"
					rel="noopener noreferrer"
					style={{ 
						color: 'inherit', 
						textDecoration: 'underline'
					}}
				>
					Report issue
				</a>
			</div>
		</div>
	);
}
