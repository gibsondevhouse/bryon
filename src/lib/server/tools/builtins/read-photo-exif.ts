import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { z } from 'zod';
import { toolRegistry } from '../registry';

const COMMON_EXIF_FIELDS = [
	'Make',
	'Model',
	'LensModel',
	'LensMake',
	'ISO',
	'ExposureTime',
	'FNumber',
	'FocalLength',
	'FocalLengthIn35mmFormat',
	'DateTimeOriginal',
	'CreateDate',
	'GPSLatitude',
	'GPSLongitude',
	'GPSAltitude',
	'Flash',
	'WhiteBalance',
	'ExposureMode',
	'MeteringMode',
	'ExposureCompensation',
	'Software',
	'Orientation',
	'ImageWidth',
	'ImageHeight',
	'ColorSpace',
	'ExposureProgram',
	'SceneCaptureType',
];

const readPhotoExifArgsSchema = z.object({
	path: z.string().min(1).describe('Absolute path to the image file'),
	fields: z
		.array(z.string())
		.optional()
		.describe('Specific EXIF field names to extract (default: all common camera fields)'),
});

const readPhotoExifResultSchema = z.object({
	exif: z.record(z.string(), z.unknown()),
	path: z.string(),
	fieldCount: z.number().int(),
});

toolRegistry.register({
	name: 'read_photo_exif',
	description:
		'Read EXIF metadata from a photo file. Returns camera make/model, lens, ISO, shutter speed, aperture, focal length, GPS coordinates, and capture date. Restricted to files under the home directory.',
	parameters: readPhotoExifArgsSchema,
	returns: readPhotoExifResultSchema,
	async execute(args) {
		const home = homedir();
		const requested = resolve(args.path);

		if (!requested.startsWith(`${home}/`) && requested !== home) {
			throw new Error('Path is outside the home directory.');
		}
		if (!existsSync(requested)) {
			throw new Error(`File not found: ${requested}`);
		}

		const { parse } = await import('exifr');

		const fieldsToRead = args.fields?.length ? args.fields : COMMON_EXIF_FIELDS;
		const raw = await parse(requested, { pick: fieldsToRead });

		if (!raw) {
			return { exif: {}, path: requested, fieldCount: 0 };
		}

		const exif: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(raw)) {
			if (value instanceof Uint8Array || value instanceof ArrayBuffer) continue;
			if (value instanceof Date) {
				exif[key] = value.toISOString();
			} else {
				exif[key] = value;
			}
		}

		return { exif, path: requested, fieldCount: Object.keys(exif).length };
	},
});
