import { h } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { EditorView, basicSetup } from 'codemirror';
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

	// Update editor when value changes externally
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
