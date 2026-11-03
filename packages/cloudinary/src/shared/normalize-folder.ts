import { HttpError } from 'riser-bob'

export function normalizeFolder(folder: string): string {
	if (typeof folder !== 'string') {
		throw new HttpError(400, 'Upload folder must be a string')
	}

	const clean = folder.trim().replace(/^\/+|\/+$/g, '')

	if (!clean) {
		throw new HttpError(400, 'Upload folder is required')
	}

	if (clean.length > 255) {
		throw new HttpError(400, 'Upload folder is too long')
	}

	if (/[\u0000-\u001F\u007F]/.test(clean)) {
		throw new HttpError(400, 'Upload folder contains invalid characters')
	}

	const segments = clean.split('/')

	if (
		segments.some(
			(segment) => !segment || segment === '.' || segment === '..'
		)
	) {
		throw new HttpError(400, 'Invalid upload folder')
	}

	return clean
}
