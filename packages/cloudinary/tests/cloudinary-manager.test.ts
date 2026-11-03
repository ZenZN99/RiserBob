import { afterEach, describe, expect, test } from 'bun:test'
import { HttpError } from 'riser-bob'

import { CloudinaryManager } from '../src/cloudinary-manager'
import { FileManager } from '../src/files/file-manager'
import { ImageManager } from '../src/images/image-manager'
import { VideoManager } from '../src/videos/video-manager'

type ManagerConfig = ConstructorParameters<typeof CloudinaryManager>[0]

const validConfig: ManagerConfig = {
	cloudName: 'test-cloud',
	apiKey: 'test-api-key',
	apiSecret: 'test-api-secret'
}

const validEnv: Record<string, string | undefined> = {
	CLOUDINARY_CLOUD_NAME: 'env-cloud',
	CLOUDINARY_API_KEY: 'env-api-key',
	CLOUDINARY_API_SECRET: 'env-api-secret'
}

function captureError(action: () => unknown): unknown {
	try {
		action()
	} catch (error) {
		return error
	}

	return undefined
}

function expectHttpError(
	action: () => unknown,
	status: number,
	message: string
): void {
	const error = captureError(action)

	expect(error).toBeInstanceOf(HttpError)
	expect((error as HttpError).status).toBe(status)
	expect((error as HttpError).message).toBe(message)
}

// constructor

describe('CloudinaryManager', () => {
	describe('constructor', () => {
		test('should create a CloudinaryManager instance', () => {
			const manager = new CloudinaryManager(validConfig)

			expect(manager).toBeInstanceOf(CloudinaryManager)
		})

		test('should expose an image manager', () => {
			const manager = new CloudinaryManager(validConfig)

			expect(manager.images).toBeInstanceOf(ImageManager)
		})

		test('should expose a file manager', () => {
			const manager = new CloudinaryManager(validConfig)

			expect(manager.files).toBeInstanceOf(FileManager)
		})

		test('should expose a video manager', () => {
			const manager = new CloudinaryManager(validConfig)

			expect(manager.videos).toBeInstanceOf(VideoManager)
		})

		test('should convert the config to Cloudinary credentials', () => {
			const manager = new CloudinaryManager(validConfig)

			expect(Reflect.get(manager, 'credentials')).toEqual({
				cloud_name: 'test-cloud',
				api_key: 'test-api-key',
				api_secret: 'test-api-secret'
			})
		})

		test('should create separate manager instances for each instance', () => {
			const first = new CloudinaryManager(validConfig)
			const second = new CloudinaryManager(validConfig)

			expect(first.images).not.toBe(second.images)
			expect(first.files).not.toBe(second.files)
			expect(first.videos).not.toBe(second.videos)
		})

		test('should accept options for every manager', () => {
			const manager = new CloudinaryManager(validConfig, {
				images: { maxFileSize: 1024 * 1024 },
				files: { maxFileSize: 5 * 1024 * 1024 },
				videos: { maxFileSize: 20 * 1024 * 1024 }
			})

			expect(manager.images).toBeInstanceOf(ImageManager)
			expect(manager.files).toBeInstanceOf(FileManager)
			expect(manager.videos).toBeInstanceOf(VideoManager)
		})

		test('should accept an empty options object', () => {
			expect(() => new CloudinaryManager(validConfig, {})).not.toThrow()
		})
	})

	// constructor validation

	describe('constructor validation', () => {
		test('should throw 500 when the cloud name is missing', () => {
			expectHttpError(
				() => new CloudinaryManager({ ...validConfig, cloudName: '' }),
				500,
				'Cloudinary cloud name is required'
			)
		})

		test('should throw 500 when the API key is missing', () => {
			expectHttpError(
				() => new CloudinaryManager({ ...validConfig, apiKey: '' }),
				500,
				'Cloudinary API key is required'
			)
		})

		test('should throw 500 when the API secret is missing', () => {
			expectHttpError(
				() => new CloudinaryManager({ ...validConfig, apiSecret: '' }),
				500,
				'Cloudinary API secret is required'
			)
		})

		test('should report the cloud name first when everything is missing', () => {
			expectHttpError(
				() =>
					new CloudinaryManager({
						...validConfig,
						cloudName: '',
						apiKey: '',
						apiSecret: ''
					}),
				500,
				'Cloudinary cloud name is required'
			)
		})

		test('should report the API key before the API secret', () => {
			expectHttpError(
				() =>
					new CloudinaryManager({
						...validConfig,
						apiKey: '',
						apiSecret: ''
					}),
				500,
				'Cloudinary API key is required'
			)
		})
	})

	// fromEnv

	describe('fromEnv', () => {
		const originalEnv = {
			cloudName: process.env.CLOUDINARY_CLOUD_NAME,
			apiKey: process.env.CLOUDINARY_API_KEY,
			apiSecret: process.env.CLOUDINARY_API_SECRET
		}

		function restoreVariable(
			name: string,
			value: string | undefined
		): void {
			if (value === undefined) {
				delete process.env[name]
				return
			}

			process.env[name] = value
		}

		afterEach(() => {
			restoreVariable('CLOUDINARY_CLOUD_NAME', originalEnv.cloudName)
			restoreVariable('CLOUDINARY_API_KEY', originalEnv.apiKey)
			restoreVariable('CLOUDINARY_API_SECRET', originalEnv.apiSecret)
		})

		test('should create a manager from the provided environment', () => {
			const manager = CloudinaryManager.fromEnv(validEnv)

			expect(manager).toBeInstanceOf(CloudinaryManager)
			expect(manager.images).toBeInstanceOf(ImageManager)
			expect(manager.files).toBeInstanceOf(FileManager)
			expect(manager.videos).toBeInstanceOf(VideoManager)
		})

		test('should read the credentials from the provided environment', () => {
			const manager = CloudinaryManager.fromEnv(validEnv)

			expect(Reflect.get(manager, 'credentials')).toEqual({
				cloud_name: 'env-cloud',
				api_key: 'env-api-key',
				api_secret: 'env-api-secret'
			})
		})

		test('should use process.env by default', () => {
			process.env.CLOUDINARY_CLOUD_NAME = 'process-cloud'
			process.env.CLOUDINARY_API_KEY = 'process-api-key'
			process.env.CLOUDINARY_API_SECRET = 'process-api-secret'

			const manager = CloudinaryManager.fromEnv()

			expect(Reflect.get(manager, 'credentials')).toEqual({
				cloud_name: 'process-cloud',
				api_key: 'process-api-key',
				api_secret: 'process-api-secret'
			})
		})

		test('should accept shared options', () => {
			expect(() =>
				CloudinaryManager.fromEnv(validEnv, { maxFileSize: 1024 })
			).not.toThrow()
		})

		test('should throw 500 when CLOUDINARY_CLOUD_NAME is missing', () => {
			expectHttpError(
				() =>
					CloudinaryManager.fromEnv({
						...validEnv,
						CLOUDINARY_CLOUD_NAME: undefined
					}),
				500,
				'CLOUDINARY_CLOUD_NAME environment variable is required'
			)
		})

		test('should throw 500 when CLOUDINARY_API_KEY is missing', () => {
			expectHttpError(
				() =>
					CloudinaryManager.fromEnv({
						...validEnv,
						CLOUDINARY_API_KEY: undefined
					}),
				500,
				'CLOUDINARY_API_KEY environment variable is required'
			)
		})

		test('should throw 500 when CLOUDINARY_API_SECRET is missing', () => {
			expectHttpError(
				() =>
					CloudinaryManager.fromEnv({
						...validEnv,
						CLOUDINARY_API_SECRET: undefined
					}),
				500,
				'CLOUDINARY_API_SECRET environment variable is required'
			)
		})

		test('should treat empty environment values as missing', () => {
			expectHttpError(
				() =>
					CloudinaryManager.fromEnv({
						...validEnv,
						CLOUDINARY_CLOUD_NAME: ''
					}),
				500,
				'CLOUDINARY_CLOUD_NAME environment variable is required'
			)
		})

		test('should throw when the environment is empty', () => {
			expectHttpError(
				() => CloudinaryManager.fromEnv({}),
				500,
				'CLOUDINARY_CLOUD_NAME environment variable is required'
			)
		})
	})
})
