import { startsWith } from '../shared/byte-utils'
import { VideoMimeType } from './types'

/** Detects the real video type from the first bytes. */
export function detectVideoType(bytes: Uint8Array): VideoMimeType | null {
	// WebM / Matroska (EBML header)
	if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return 'video/webm'

	// MP4 / MOV: "ftyp" at offset 4, brand at offset 8
	if (startsWith(bytes, [0x66, 0x74, 0x79, 0x70], 4) && bytes.length >= 12) {
		const brand = String.fromCharCode(...bytes.slice(8, 12))
		if (IMAGE_BRANDS.has(brand)) return null
		return brand === 'qt  ' ? 'video/quicktime' : 'video/mp4'
	}

	return null
}

// ISO base media brands that belong to images, not video.
const IMAGE_BRANDS = new Set([
	'avif',
	'avis',
	'heic',
	'heix',
	'heim',
	'heis',
	'mif1',
	'msf1'
])
