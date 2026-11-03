/**
 * Extracts the public ID from a Cloudinary delivery URL, so an image can be
 * deleted when only its URL was stored. Returns null for non-Cloudinary URLs.
 *
 * Works with and without a version segment (`v123`). If the URL contains
 * transformations but no version segment, the transformations cannot be told
 * apart from folders, so prefer storing the public ID itself.
 */
export function extractPublicId(url: string): string | null {
	let pathname: string
	try {
		pathname = new URL(url).pathname
	} catch {
		return null
	}

	const segments = pathname.split('/').filter(Boolean)
	const uploadIndex = segments.indexOf('upload')
	if (uploadIndex === -1) return null

	let rest = segments.slice(uploadIndex + 1)
	const versionIndex = rest.findIndex((segment) => /^v\d+$/.test(segment))
	if (versionIndex !== -1) rest = rest.slice(versionIndex + 1)
	if (rest.length === 0) return null

	const decoded = rest.map((segment) => {
		try {
			return decodeURIComponent(segment)
		} catch {
			return segment
		}
	})

	const last = decoded[decoded.length - 1] ?? ''
	decoded[decoded.length - 1] = last.replace(/\.[a-z0-9]+$/i, '')

	const publicId = decoded.join('/')
	return publicId || null
}

export function isValidPublicId(publicId: string): boolean {
	if (!publicId) return false
	if (publicId.length > 255) return false
	if (publicId.split('/').some((part) => part === '..' || part === '.'))
		return false
	return true
}
