export type FileMimeType = 'application/pdf' | 'application/zip'

export interface UploadedFile {
	url: string
	publicId: string
	bytes: number
	mimeType: FileMimeType
}

export interface UploadFileOptions {
	publicId?: string
	tags?: string[]
	maxFileSize?: number
	allowedTypes?: readonly FileMimeType[]
}

export interface UploadFilesManyOptions extends Omit<
	UploadFileOptions,
	'publicId'
> {
	concurrency?: number
}

export const FILE_EXTENSIONS: Record<FileMimeType, string> = {
	'application/pdf': 'pdf',
	'application/zip': 'zip'
}
