import { startsWith } from '../shared/byte-utils'
import type { ImageMimeType } from './types'

/**
 * Detects the real image type from the file's first bytes.
 * The browser-provided `file.type` is user-controlled and can be spoofed.
 */
export function detectImageType(bytes: Uint8Array): ImageMimeType | null {
	if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg'

	if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
		return 'image/png'

	if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return 'image/gif'

	// WEBP: "RIFF" .... "WEBP"
	if (
		startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
		startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
	) {
		return 'image/webp'
	}

	// AVIF: .... "ftypavif"
	if (startsWith(bytes, [0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66], 4))
		return 'image/avif'

	// SVG: XML-based image format
	const text = new TextDecoder()
		.decode(bytes)
		.replace(/^\uFEFF/, '')
		.trimStart()

	if (
		/^<svg(?:\s|>)/i.test(text) ||
		/^<\?xml[\s\S]*?<svg(?:\s|>)/i.test(text)
	) {
		return 'image/svg+xml'
	}

	return null
}
