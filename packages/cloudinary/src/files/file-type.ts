import { startsWith } from '../shared/byte-utils'
import type { FileMimeType } from './types'

/** Detects the real file type from the first bytes. ZIP also covers docx/xlsx/pptx. */
export function detectFileType(bytes: Uint8Array): FileMimeType | null {
	if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]))
		return 'application/pdf'
	if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return 'application/zip'
	return null
}
