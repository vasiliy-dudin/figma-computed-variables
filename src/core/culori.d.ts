// Type definitions for culori
declare module 'culori' {
	export interface Color {
		mode: string;
		// sRGB channels
		r?: number;
		g?: number;
		b?: number;
		// oklch / oklab / lch channels
		l?: number;
		c?: number;
		h?: number;
		alpha?: number;
	}

	export function parse(color: string): Color | undefined;
	export function formatHex(color: Color): string | undefined;
	export function formatRgb(color: Color): string | undefined;
	export function converter(mode: string): (color: Color) => Color;
}
