import { h } from 'preact';

interface StatusBarProps {
  tokenCount: number;
  collectionCount: number;
}

export function StatusBar({ tokenCount, collectionCount }: StatusBarProps) {
  return (
    <div style={{ padding: '8px 12px', borderTop: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
      Status: {tokenCount} tokens | {collectionCount} collections
    </div>
  );
}
