import type { ImageMimeType } from '../images/types'
import type { FileMimeType } from '../files/types'
import type { VideoMimeType } from '../videos/types'

/**
 * Cloudinary account credentials and image upload configuration.
 */
export interface CloudinaryManagerConfig {
	cloudName: string
	apiKey: string
	apiSecret: string

	/**
	 * Maximum allowed image size in bytes.
	 * Defaults to 5 MB.
	 */
	maxFileSize?: number

	/**
	 * MIME types accepted for image uploads.
	 */
	allowedTypes?: readonly ImageMimeType[]
}

export interface CloudinaryCredentials {
	cloud_name: string
	api_key: string
	api_secret: string
}

/**
 * Default maximum image upload size: 5 MB.
 */
export const DEFAULT_MAX_FILE_SIZE = 5 * 1024 * 1024

/**
 * Default image MIME types.
 */
export const DEFAULT_ALLOWED_TYPES: readonly ImageMimeType[] = [
	'image/jpeg',
	'image/png',
	'image/gif',
	'image/webp',
	'image/avif'
]

/**
 * Default maximum raw file upload size: 10 MB.
 */
export const DEFAULT_MAX_FILE_BYTES = 10 * 1024 * 1024

/**
 * Default raw file MIME types.
 */
export const DEFAULT_ALLOWED_FILE_TYPES: readonly FileMimeType[] = [
	'application/pdf',
	'application/zip'
]

/**
 * Default maximum video upload size: 100 MB.
 */
export const DEFAULT_MAX_VIDEO_BYTES = 100 * 1024 * 1024

/**
 * Default video MIME types.
 */
export const DEFAULT_ALLOWED_VIDEO_TYPES: readonly VideoMimeType[] = [
	'video/mp4',
	'video/webm',
	'video/quicktime'
]

/**
 * Default concurrency for image and raw file batch uploads.
 */
export const DEFAULT_UPLOAD_CONCURRENCY = 3

/**
 * Default concurrency for video batch uploads.
 */
export const DEFAULT_VIDEO_CONCURRENCY = 2

/**
 * Default concurrency for batch deletions.
 */
export const DEFAULT_DESTROY_CONCURRENCY = 5

/**
 * Maximum allowed concurrency for batch operations.
 */
export const MAX_CONCURRENCY = 10

export interface CloudinaryCredentials {
	cloud_name: string
	api_key: string
	api_secret: string
}

export interface CloudinaryManagerConfig {
	cloudName: string
	apiKey: string
	apiSecret: string
}

export interface CloudinaryManagerOptions {
	images?: {
		maxFileSize?: number
		allowedTypes?: readonly ImageMimeType[]
	}

	files?: {
		maxFileSize?: number
		allowedTypes?: readonly FileMimeType[]
	}

	videos?: {
		maxFileSize?: number
		allowedTypes?: readonly VideoMimeType[]
	}
}

export interface DestroyManyOptions {
	concurrency?: number
}
