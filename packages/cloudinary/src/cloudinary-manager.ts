import { HttpError } from 'riser-bob'
import type { CloudinaryManagerConfig } from './types/config'
import type { CloudinaryCredentials } from './types/config'
import type { CloudinaryManagerOptions } from './types/config'
import { ImageManager } from './images/image-manager'
import { FileManager } from './files/file-manager'
import { VideoManager } from './videos/video-manager'

export class CloudinaryManager {
	private readonly credentials: CloudinaryCredentials

	public readonly images: ImageManager
	public readonly files: FileManager
	public readonly videos: VideoManager

	constructor(
		config: CloudinaryManagerConfig,
		options: CloudinaryManagerOptions = {}
	) {
		if (!config.cloudName)
			throw new HttpError(500, 'Cloudinary cloud name is required')

		if (!config.apiKey)
			throw new HttpError(500, 'Cloudinary API key is required')

		if (!config.apiSecret)
			throw new HttpError(500, 'Cloudinary API secret is required')

		this.credentials = {
			cloud_name: config.cloudName,
			api_key: config.apiKey,
			api_secret: config.apiSecret
		}

		this.images = new ImageManager(this.credentials, options.images)

		this.files = new FileManager(this.credentials, options.files)

		this.videos = new VideoManager(this.credentials, options.videos)
	}

	/**
	 * Creates a manager from CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and
	 * CLOUDINARY_API_SECRET.
	 */
	static fromEnv(
		env: Record<string, string | undefined> = process.env,
		options: Pick<
			CloudinaryManagerConfig,
			'maxFileSize' | 'allowedTypes'
		> = {}
	): CloudinaryManager {
		const cloudName = env.CLOUDINARY_CLOUD_NAME
		const apiKey = env.CLOUDINARY_API_KEY
		const apiSecret = env.CLOUDINARY_API_SECRET

		if (!cloudName) {
			throw new HttpError(
				500,
				'CLOUDINARY_CLOUD_NAME environment variable is required'
			)
		}

		if (!apiKey) {
			throw new HttpError(
				500,
				'CLOUDINARY_API_KEY environment variable is required'
			)
		}

		if (!apiSecret) {
			throw new HttpError(
				500,
				'CLOUDINARY_API_SECRET environment variable is required'
			)
		}

		return new CloudinaryManager({
			cloudName,
			apiKey,
			apiSecret,
			...options
		})
	}
}
