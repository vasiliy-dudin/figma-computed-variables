// Type definitions for culori
declare module 'culori' {
  export interface Color {
    mode: string;
    r?: number;
    g?: number;
    b?: number;
    alpha?: number;
  }

  export function parse(color: string): Color | undefined;
  export function formatHex(color: Color): string | undefined;
  export function formatRgb(color: Color): string | undefined;
}
