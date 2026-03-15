import { h } from 'preact';

interface ToastProps {
	message: string;
}

export function Toast({ message }: ToastProps) {
	return <div class="toast">{message}</div>;
}
