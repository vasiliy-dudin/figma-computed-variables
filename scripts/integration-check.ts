import { createTokenMap } from '../src/core/tokenUtils';
import { resolveToken } from '../src/core/resolver';
import { validate } from '../src/core/validator';
import type { TokenJSON } from '../src/core/types';

interface SampleDefinition {
	name: string;
	json: TokenJSON;
	modes: string[];
	tokensToResolve: string[];
}

const singleModeSample: TokenJSON = {
	foundation: {
		colors: {
			primary: { $type: 'color', $value: '#3478F6' },
			accent: { $type: 'color', $value: 'oklch(0.73 0.12 240)' },
			overlay: { $type: 'color', $value: 'alpha({foundation.colors.primary}, 30%)' },
		},
		numbers: {
			unit: { $type: 'number', $value: 4 },
			padding: { $type: 'number', $value: '{foundation.numbers.unit} * 2' },
		},
	},
	semantic: {
		badge: {
			background: { $type: 'color', $value: 'lighten({foundation.colors.primary}, 15%)' },
			foreground: { $type: 'color', $value: 'hueShift({foundation.colors.accent}, 45deg)' },
		},
	},
};

const overlappingSample: TokenJSON = {
	components: {
		button: {
			$self: { $type: 'string', $value: 'base-button' },
			fontSize: { $type: 'number', $value: 16 },
			fontWeight: { $type: 'number', $value: 600 },
		},
	},
};

const multiModeSample: TokenJSON = {
	foundation: {
		color: {
			primary: { $type: 'color', $value: { light: '#0055CC', dark: '#80AFFF' } },
			accent: { $type: 'color', $value: { light: 'oklch(0.7 0.18 230)', dark: 'oklch(0.58 0.14 230)' } },
			neutral: { $type: 'color', $value: { light: 'oklch(0.85 0.02 220)', dark: 'oklch(0.35 0.02 220)' } },
		},
	},
	semantic: {
		button: {
			background: {
				$type: 'color',
				$value: {
					light: '{foundation.color.primary}',
					dark: '{foundation.color.primary}',
				},
			},
			backgroundHover: {
				$type: 'color',
				$value: {
					light: 'lighten({foundation.color.primary}, 10%)',
					dark: 'lighten({foundation.color.primary}, 6%)',
				},
			},
			backgroundActive: {
				$type: 'color',
				$value: {
					light: 'darken({foundation.color.primary}, 14%)',
					dark: 'darken({foundation.color.primary}, 12%)',
				},
			},
		},
		status: {
			successBase: {
				$type: 'color',
				$value: { light: 'oklch(0.78 0.14 140)', dark: 'oklch(0.6 0.12 140)' },
			},
			successOverlay: {
				$type: 'color',
				$value: {
					light: 'alpha({semantic.status.successBase}, 45%)',
					dark: 'alpha({semantic.status.successBase}, 35%)',
				},
			},
			accentShift: {
				$type: 'color',
				$value: {
					light: 'hueShift({foundation.color.accent}, -30deg)',
					dark: 'hueShift({foundation.color.accent}, 20deg)',
				},
			},
			muted: {
				$type: 'color',
				$value: {
					light: 'desaturate({foundation.color.accent}, 25%)',
					dark: 'desaturate({foundation.color.accent}, 25%)',
				},
			},
		},
	},
};

const invalidSample: TokenJSON = {
	foundation: {
		color: {
			primary: { $type: 'color', $value: '#FFAA00' },
		},
	},
	semantic: {
		badge: {
			alphaBad: { $type: 'color', $value: 'alpha({foundation.color.primary}, 0.5)' },
		},
	},
};

const validSamples: SampleDefinition[] = [
	{
		name: 'single-mode-scalar',
		json: singleModeSample,
		modes: ['light'],
		tokensToResolve: [
			'foundation.colors.overlay',
			'foundation.numbers.padding',
			'semantic.badge.background',
			'semantic.badge.foreground',
		],
	},
	{
		name: 'multi-mode',
		json: multiModeSample,
		modes: ['light', 'dark'],
		tokensToResolve: [
			'semantic.button.background',
			'semantic.button.backgroundHover',
			'semantic.button.backgroundActive',
			'semantic.status.successOverlay',
			'semantic.status.accentShift',
			'semantic.status.muted',
		],
	},
	{
		name: 'overlapping-components',
		json: overlappingSample,
		modes: ['light'],
		tokensToResolve: [
			'components.button',
			'components.button.fontSize',
			'components.button.fontWeight',
		],
	},
];

function runValidSamples(): void {
	for (const sample of validSamples) {
		const validation = validate(sample.json);
		if (!validation.valid) {
			console.error(`❌ Validation failed for ${sample.name}`);
			console.error(JSON.stringify(validation.errors, null, 2));
			process.exitCode = 1;
			continue;
		}

		const map = createTokenMap(validation.data);
		console.log(`\n✅ ${sample.name}: validation passed`);

		for (const mode of sample.modes) {
			for (const tokenPath of sample.tokensToResolve) {
				const result = resolveToken(tokenPath, mode, map);
				const display = result.isAlias
					? `alias → ${result.targetPath}`
					: typeof result.value === 'object'
						? JSON.stringify(result.value)
						: String(result.value);
				console.log(`  • ${mode} :: ${tokenPath} = ${display}`);
			}
		}
	}
}

function runInvalidSample(): void {
	const validation = validate(invalidSample);
	if (validation.valid) {
		console.error('❌ Invalid sample unexpectedly passed validation.');
		process.exitCode = 1;
		return;
	}

	console.log('\n✅ Invalid sample produced errors as expected:');
	for (const error of validation.errors) {
		console.log(`  • (${error.collection}.${error.token}) [${error.errorType}] ${error.message}`);
	}
}

runValidSamples();
runInvalidSample();
