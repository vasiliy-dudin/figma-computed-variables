import { h } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { EditorView, basicSetup } from 'codemirror';
import { keymap } from '@codemirror/view';
import { json } from '@codemirror/lang-json';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorState } from '@codemirror/state';

interface JsonEditorProps {
	value: string;
	onChange: (value: string) => void;
}

export function JsonEditor({ value, onChange }: JsonEditorProps) {
	const editorRef = useRef<HTMLDivElement>(null);
	const viewRef = useRef<EditorView | null>(null);

	useEffect(() => {
		if (!editorRef.current) return;

		const startState = EditorState.create({
			doc: value,
			extensions: [
				basicSetup,
				json(),
				oneDark,
				keymap.of([
					{
						key: 'Tab',
						run(view) {
							const { state } = view;
							const hasSelection = state.selection.ranges.some(r => !r.empty);

							if (!hasSelection) {
								view.dispatch(state.update(
									state.replaceSelection('  '),
									{ scrollIntoView: true, userEvent: 'input' }
								));
								return true;
							}

							const processedLines = new Set<number>();
							const changes: { from: number; insert: string }[] = [];

							for (const range of state.selection.ranges) {
								const fromLine = state.doc.lineAt(range.from);
								const toLine = state.doc.lineAt(range.to);

								for (let n = fromLine.number; n <= toLine.number; n++) {
									if (processedLines.has(n)) continue;
									processedLines.add(n);
									changes.push({ from: state.doc.line(n).from, insert: '  ' });
								}
							}

							view.dispatch(state.update({ changes, scrollIntoView: true, userEvent: 'input' }));
							return true;
						},
					},
					{
						key: 'Shift-Tab',
						run(view) {
							const { state } = view;
							const processedLines = new Set<number>();
							const changes: { from: number; to: number }[] = [];

							for (const range of state.selection.ranges) {
								const fromLine = state.doc.lineAt(range.from);
								const toLine = state.doc.lineAt(range.to);

								for (let n = fromLine.number; n <= toLine.number; n++) {
									if (processedLines.has(n)) continue;
									processedLines.add(n);

									const line = state.doc.line(n);
									const spaces = line.text.match(/^ {1,2}/)?.[0].length ?? 0;
									if (spaces > 0) {
										changes.push({ from: line.from, to: line.from + spaces });
									}
								}
							}

							if (changes.length === 0) return false;
							view.dispatch(state.update({ changes, scrollIntoView: true, userEvent: 'input' }));
							return true;
						},
					},
				]),
				EditorView.updateListener.of((update) => {
					if (update.docChanged) {
						onChange(update.state.doc.toString());
					}
				}),
			],
		});

		viewRef.current = new EditorView({
			state: startState,
			parent: editorRef.current,
		});

		return () => {
			viewRef.current?.destroy();
		};
	}, []);

	// Sync editor content when value is updated externally (e.g. Import, Load).
	// After user input, value === doc.toString() so no dispatch occurs — no infinite loop.
	useEffect(() => {
		if (viewRef.current && value !== viewRef.current.state.doc.toString()) {
			viewRef.current.dispatch({
				changes: {
					from: 0,
					to: viewRef.current.state.doc.length,
					insert: value,
				},
			});
		}
	}, [value]);

	return <div ref={editorRef} style={{ height: '100%', overflow: 'auto' }} />;
}
