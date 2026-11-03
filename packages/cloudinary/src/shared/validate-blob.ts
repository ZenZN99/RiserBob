import { HttpError } from 'riser-bob'

export interface ValidateBlobOptions<TType extends string> {
	maxFileSize: number
	allowedTypes: readonly TType[]
	detect: (bytes: Uint8Array) => TType | null
	label: string
}

/**
 * Validates a Blob's size and detects its actual content type.
 *
 * Reads only the first 32 bytes instead of loading the entire file.
 */
export async function validateBlob<TType extends string>(
	file: Blob,
	rules: ValidateBlobOptions<TType>
): Promise<TType> {
	if (file.size === 0) {
		throw new HttpError(400, 'File is empty')
	}

	if (file.size > rules.maxFileSize) {
		throw new HttpError(
			413,
			`File is too large (max ${rules.maxFileSize} bytes)`
		)
	}

	const header = new Uint8Array(await file.slice(0, 32).arrayBuffer())

	const type = rules.detect(header)

	if (!type || !rules.allowedTypes.includes(type)) {
		throw new HttpError(415, `Unsupported ${rules.label} type`)
	}

	return type
}
