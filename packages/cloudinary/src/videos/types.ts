export type VideoMimeType = 'video/mp4' | 'video/webm' | 'video/quicktime'

export interface UploadedVideo {
	url: string
	publicId: string
	width: number
	height: number
	format: string
	bytes: number
	/** Duration in seconds. */
	duration: number
}

export interface UploadVideoOptions {
	publicId?: string
	tags?: string[]
	maxFileSize?: number
	allowedTypes?: readonly VideoMimeType[]
}

export interface UploadVideosManyOptions extends Omit<
	UploadVideoOptions,
	'publicId'
> {
	concurrency?: number
}
