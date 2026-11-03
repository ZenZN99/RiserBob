export type ImageMimeType =
	| 'image/jpeg'
	| 'image/png'
	| 'image/gif'
	| 'image/webp'
	| 'image/avif'
	| 'image/svg+xml'

export type ImageFormat =
	| 'jpg'
	| 'jpeg'
	| 'png'
	| 'webp'
	| 'avif'
	| 'gif'
	| 'auto'

export type CropMode = 'fill' | 'fit' | 'scale' | 'limit' | 'thumb'

export interface CloudinaryManagerConfig {
	cloudName: string
	apiKey: string
	apiSecret: string
	/** Maximum accepted file size in bytes. Defaults to 5 MB. */
	maxFileSize?: number
	/** Accepted image types, detected from file content. Defaults to all supported types. */
	allowedTypes?: readonly ImageMimeType[]
}

export interface UploadedImage {
	/** HTTPS delivery URL. */
	url: string
	/** Cloudinary public ID. Store it, you need it to delete the image. */
	publicId: string
	width: number
	height: number
	format: string
	/** Stored size in bytes. */
	bytes: number
}

export interface UploadOptions {
	/** Use a fixed public ID instead of a generated one. */
	publicId?: string
	tags?: string[]
	/** Overrides the manager's maxFileSize for this upload. */
	maxFileSize?: number
	/** Overrides the manager's allowedTypes for this upload. */
	allowedTypes?: readonly ImageMimeType[]
}

export interface UrlOptions {
	width?: number
	height?: number
	/** Defaults to 'limit' when width or height is set. */
	crop?: CropMode
	quality?: number | 'auto'
	format?: ImageFormat | 'auto'
}

export type UploadManyOptions = Omit<UploadOptions, 'publicId'> & {
	concurrency?: number
}
