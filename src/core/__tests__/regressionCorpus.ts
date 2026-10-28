import type { Token, TokenJSON, TokenType, TokenValue } from '../types';

type Scope = Token['$scope'];

const COLOR_OPACITY: Scope = 'COLOR_OPACITY';

function token(type: TokenType, value: TokenValue, scope?: Scope): Token {
	return scope === undefined ? { $type: type, $value: value } : { $type: type, $value: value, $scope: scope };
}

const color = (value: TokenValue): Token => token('color', value);
const num = (value: TokenValue, scope?: Scope): Token => token('number', value, scope);
const str = (value: TokenValue): Token => token('string', value);

/** The expression table and the "Excluding tokens" example from docs/index.html. */
export const DOCS_EXAMPLES: TokenJSON = {
	color: {
		primary: color('#0066FF'),
		alias: color('{color.primary}'),
		alpha: color('alpha({color.primary}, 50%)'),
		darken: color('darken({color.primary}, 30%)'),
		lighten: color('lighten({color.primary}, 30%)'),
		saturate: color('saturate({color.primary}, 50%)'),
		desaturate: color('desaturate({color.primary}, 65%)'),
		hueShift: color('hueShift({color.primary}, 30deg)'),
	},
	spacing: {
		base: num(8),
		double: num('{spacing.base} * 2'),
		_base: num(8),
		xs: num('{spacing._base} * 1'),
		sm: num('{spacing._base} * 1.5'),
		md: num('{spacing._base} * 2'),
		lg: num('{spacing._base} * 3'),
		xl: num('{spacing._base} * 4'),
	},
	font: {
		family: str('Inter'),
		stack: str('{font.family}, sans-serif'),
	},
};

/** Number math, including JS-only forms that the new evaluator must keep. */
export const MATH_CASES: TokenJSON = {
	math: {
		a: num(8),
		b: num(3),
		neg: num(-4),
		big: num(1e21),
		modes: num({ light: 4, dark: 6 }),
		aliasA: num('{math.a}'),
		add: num('{math.a} + {math.b}'),
		sub: num('{math.a} - {math.b}'),
		mul: num('{math.a} * {math.b}'),
		div: num('{math.a} / {math.b}'),
		remainder: num('{math.a} % {math.b}'),
		power: num('{math.b} ** 2'),
		powerRightAssoc: num('2 ** 3 ** 2'),
		precedence: num('{math.a} + {math.b} * 2'),
		parentheses: num('({math.a} + {math.b}) / 2'),
		unaryMinus: num('-{math.a}'),
		unaryPlus: num('+{math.a} * 2'),
		minusNegative: num('{math.a} - {math.neg}'),
		timesNegative: num('{math.b} * {math.neg}'),
		floating: num('0.1 + 0.2'),
		exponentLiteral: num('1e3 * {math.a}'),
		bigOperand: num('{math.big} * 2'),
		literalOnly: num('10 / 4'),
		chain: num('{math.add} * 2'),
		throughAlias: num('{math.aliasA} * 2'),
		perMode: num({ light: '{math.modes} * 2', dark: '{math.modes} / 4' }),
		mathRound: num('Math.round({math.a} * 1.3)'),
		mathMinMax: num('Math.max({math.a}, {math.b}, 20) - Math.min({math.a}, {math.b})'),
		mathPi: num('Math.PI * 2'),
		mathNested: num('Math.floor(Math.sqrt({math.a}) * 10) / 10'),
		mathPow: num('Math.pow({math.b}, 3)'),
		mathAbs: num('Math.abs({math.neg})'),
		percentLiteral: num('50%'),
		numericString: num('12'),
	},
};

/** Every colour function with every amount form accepted today. */
export const COLOR_CASES: TokenJSON = {
	base: {
		blue: color('#0066FF'),
		modes: color({ light: '#0066FF', dark: '#3388FF' }),
		oklch: color('oklch(0.65 0.2 250)'),
		translucent: color('#0066FF80'),
		gray: color('#808080'),
		rgb: color('rgb(255, 102, 0)'),
		rgba: color('rgba(255, 102, 0, 0.5)'),
		alias: color('{base.blue}'),
	},
	amounts: {
		percent: num('8%'),
		decimal: num(0.08),
		scoped: num(8, COLOR_OPACITY),
		scopedPercent: num('8%', COLOR_OPACITY),
		degrees: num('30deg'),
		negativeDegrees: num('-30deg'),
		negativeDegreesString: str('-30deg'),
		plainDegrees: num(30),
		negativePlain: num(-30),
		aliasPercent: num('{amounts.percent}'),
		modes: num({ light: '10%', dark: '20%' }),
	},
	alpha: {
		literal: color('alpha({base.blue}, 50%)'),
		fraction: color('alpha({base.blue}, 12.5%)'),
		percentRef: color('alpha({base.blue}, {amounts.percent})'),
		decimalRef: color('alpha({base.blue}, {amounts.decimal})'),
		scopedRef: color('alpha({base.blue}, {amounts.scoped})'),
		scopedPercentRef: color('alpha({base.blue}, {amounts.scopedPercent})'),
		aliasAmountRef: color('alpha({base.blue}, {amounts.aliasPercent})'),
		overAlpha: color('alpha({alpha.literal}, 50%)'),
		threeLevels: color('alpha({alpha.overAlpha}, 50%)'),
		overAlias: color('alpha({base.alias}, 40%)'),
		overTranslucent: color('alpha({base.translucent}, 50%)'),
		overOklch: color('alpha({base.oklch}, 30%)'),
		overRgba: color('alpha({base.rgba}, 50%)'),
		overRange: color('alpha({base.blue}, 150%)'),
		overRangeMidChain: color('alpha({alpha.overRange}, 50%)'),
		zero: color('alpha({base.blue}, 0%)'),
		perMode: color({ light: 'alpha({base.modes}, {amounts.modes})', dark: 'alpha({base.modes}, 30%)' }),
	},
	modify: {
		darken: color('darken({base.blue}, 20%)'),
		darkenRef: color('darken({base.blue}, {amounts.percent})'),
		darkenDecimalRef: color('darken({base.blue}, {amounts.decimal})'),
		lighten: color('lighten({base.blue}, 20%)'),
		lightenScopedRef: color('lighten({base.blue}, {amounts.scoped})'),
		saturate: color('saturate({base.oklch}, 20%)'),
		saturateRef: color('saturate({base.oklch}, {amounts.percent})'),
		desaturate: color('desaturate({base.oklch}, 35%)'),
		desaturateFull: color('desaturate({base.oklch}, 100%)'),
		darkenOverRange: color('darken({base.blue}, 150%)'),
		darkenOklch: color('darken({base.oklch}, 20%)'),
		lightenRgb: color('lighten({base.rgb}, 10%)'),
		overAlpha: color('darken({alpha.literal}, 20%)'),
		overAlias: color('lighten({base.alias}, 20%)'),
		hueShift: color('hueShift({base.blue}, 30deg)'),
		hueShiftNegative: color('hueShift({base.blue}, -25deg)'),
		hueShiftOverRange: color('hueShift({base.blue}, 400deg)'),
		hueShiftDegreesRef: color('hueShift({base.blue}, {amounts.degrees})'),
		hueShiftNegativeRef: color('hueShift({base.blue}, {amounts.negativeDegrees})'),
		hueShiftNegativeStringRef: color('hueShift({base.blue}, {amounts.negativeDegreesString})'),
		hueShiftPlainRef: color('hueShift({base.blue}, {amounts.plainDegrees})'),
		hueShiftNegativePlainRef: color('hueShift({base.blue}, {amounts.negativePlain})'),
		hueShiftGray: color('hueShift({base.gray}, 90deg)'),
		perMode: color({ light: 'darken({base.modes}, 10%)', dark: 'lighten({base.modes}, {amounts.modes})' }),
	},
};

/** String literals and concatenation. */
export const STRING_CASES: TokenJSON = {
	text: {
		family: str('Inter'),
		plain: str('hello world'),
		stack: str('{text.family}, sans-serif'),
		withNumber: str('Size: {sizes.base}px'),
		twoRefs: str('{text.family} / {text.plain}'),
		modes: str({ light: 'Light {text.family}', dark: 'Dark' }),
	},
	sizes: {
		base: num(16),
	},
};

/** Inputs that fail today: validation errors and resolve errors must stay the same until a task changes them on purpose. */
export const ERROR_CASES: TokenJSON = {
	base: {
		blue: color('#0066FF'),
		word: str('abc'),
		percentNumber: num('50%'),
		amount: num('8%'),
		eight: num(8),
		cycleA: num('{base.cycleB} * 2'),
		cycleB: num('{base.cycleA} + 1'),
	},
	errors: {
		alphaNoUnit: color('alpha({base.blue}, 50)'),
		alphaDegrees: color('alpha({base.blue}, 50deg)'),
		darkenDegrees: color('darken({base.blue}, 20deg)'),
		hueShiftPercent: color('hueShift({base.blue}, 30%)'),
		alphaWordRef: color('alpha({base.blue}, {base.word})'),
		alphaMissingBase: color('alpha({base.missing}, 50%)'),
		alphaMissingAmount: color('alpha({base.blue}, {base.missing})'),
		alphaExpression: color('alpha({base.blue}, {base.amount} * 2)'),
		darkenExpression: color('darken({base.blue}, 10% + 5%)'),
		unknownFunction: color('mix({base.blue}, 50%)'),
		mathOnString: num('{base.word} * 2'),
		mathOnPercent: num('{base.percentNumber} * 2'),
		missingRef: num('{base.missing} * 2'),
		divisionByZero: num('8 / 0'),
		tightDoubleMinus: num('8--4'),
		danglingOperator: num('{base.eight} *'),
		unknownIdentifier: num('foo * 2'),
	},
};
