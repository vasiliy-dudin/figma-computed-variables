import { h } from 'preact';
import { useRef } from 'preact/hooks';
import { sendToPlugin } from '@ui/messaging';

const MIN_WIDTH = 400;
const MIN_HEIGHT = 300;

export function ResizeHandle() {
	const startPos = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

	function handleMouseDown(e: MouseEvent): void {
		e.preventDefault();
		startPos.current = {
			x: e.clientX,
			y: e.clientY,
			w: window.innerWidth,
			h: window.innerHeight,
		};
		window.addEventListener('mousemove', handleMouseMove);
		window.addEventListener('mouseup', handleMouseUp);
	}

	function handleMouseMove(e: MouseEvent): void {
		if (!startPos.current) return;
		const width = Math.max(MIN_WIDTH, startPos.current.w + e.clientX - startPos.current.x);
		const height = Math.max(MIN_HEIGHT, startPos.current.h + e.clientY - startPos.current.y);
		sendToPlugin({ type: 'RESIZE_WINDOW', width: Math.round(width), height: Math.round(height) });
	}

	function handleMouseUp(): void {
		startPos.current = null;
		window.removeEventListener('mousemove', handleMouseMove);
		window.removeEventListener('mouseup', handleMouseUp);
	}

	return (
		<div
			onMouseDown={handleMouseDown}
			style={{
				position: 'absolute',
				bottom: 0,
				right: 0,
				width: '24px',
				height: '24px',
				cursor: 'nwse-resize',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
			}}
		>
			<svg
				width="16"
				height="16"
				viewBox="0 0 24 24"
				style={{ pointerEvents: 'none' }}
			>
				<path d="M22.354 9.354l-.707-.707-13 13 .707.707zm0 7l-.707-.707-6 6 .707.707z"/>
				<path fill="none" d="M0 0h24v24H0z"/>
			</svg>
		</div>
	);
}
