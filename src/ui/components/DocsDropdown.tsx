import { h } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

interface DocLink {
	label: string;
	url: string;
}

const DOC_LINKS: DocLink[] = [
	{ label: 'Token Modifications', url: 'https://github.com/vasiliy-dudin/figma-computed-variables' },
	{ label: 'JSON Examples', url: 'https://github.com/vasiliy-dudin/figma-computed-variables' },
	{ label: 'About the plugin', url: 'https://github.com/vasiliy-dudin/figma-computed-variables' },
];

interface DocsDropdownProps {
	isOpen: boolean;
	onClose: () => void;
}

export function DocsDropdown({ isOpen, onClose }: DocsDropdownProps) {
	const dropdownRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!isOpen) return;

		const handleClickOutside = (e: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
				onClose();
			}
		};

		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, [isOpen, onClose]);

	if (!isOpen) return null;

	return (
		<div
			ref={dropdownRef}
			style={{
				position: 'absolute',
				bottom: '100%',
				left: '0',
				marginBottom: '4px',
				backgroundColor: '#FFFFFF',
				border: '1px solid var(--color-border)',
				borderRadius: '6px',
				boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
				zIndex: 100,
				minWidth: '180px'
			}}
		>
			<div style={{ padding: '4px' }}>
				{DOC_LINKS.map((link) => (
					<a
						href={link.url}
						target="_blank"
						rel="noopener noreferrer"
						style={{
							display: 'block',
							padding: '8px 12px',
							borderRadius: '4px',
							fontSize: '13px',
							color: 'var(--color-text)',
							textDecoration: 'underline'
						}}
						onMouseEnter={(e) => {
							e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)';
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.backgroundColor = 'transparent';
						}}
					>
						{link.label}
					</a>
				))}
			</div>
		</div>
	);
}
