import { h } from 'preact';

interface FooterProps {
	tokenCount: number;
	collectionCount: number;
}

export function Footer({ tokenCount, collectionCount }: FooterProps) {
	return (
		<div class="footer">
			<div>
				{tokenCount} tokens | {collectionCount} collections
			</div>
			<div class="footer-links">
				<a
					href="https://github.com/vasiliy-dudin/figma-computed-variables/issues"
					target="_blank"
					rel="noopener noreferrer"
				>
					Report issue
				</a>
			</div>
		</div>
	);
}
