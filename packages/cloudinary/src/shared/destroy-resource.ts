import { v2 as cloudinary } from 'cloudinary'
import { HttpError } from 'riser-bob'

import type { CloudinaryCredentials } from '../types/config'

type ResourceType = 'image' | 'raw' | 'video'
type ResourceLabel = 'image' | 'file' | 'video'

export async function destroyResource(
	publicId: string,
	resourceType: ResourceType,
	label: ResourceLabel,
	credentials: CloudinaryCredentials
): Promise<void> {
	if (!publicId) {
		throw new HttpError(400, 'Public ID is required')
	}

	let result: { result?: string }

	try {
		result = await cloudinary.uploader.destroy(publicId, {
			...credentials,
			resource_type: resourceType,
			invalidate: true
		})
	} catch (error) {
		const message =
			error instanceof Error
				? error.message
				: `Cloudinary ${label} deletion failed`

		throw new HttpError(
			502,
			message || `Cloudinary ${label} deletion failed`
		)
	}

	if (result.result !== 'ok' && result.result !== 'not found') {
		throw new HttpError(502, `Cloudinary ${label} deletion failed`)
	}
}
