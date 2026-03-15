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
		<div ref={dropdownRef} class="dropdown">
			<div class="dropdown-inner">
				{DOC_LINKS.map((link) => (
					<a
						href={link.url}
						target="_blank"
						rel="noopener noreferrer"
						class="dropdown-link"
					>
						{link.label}
					</a>
				))}
			</div>
		</div>
	);
}
