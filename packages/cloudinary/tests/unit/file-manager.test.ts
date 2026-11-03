import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import type { UploadApiOptions, UploadApiResponse } from 'cloudinary'
import type { CloudinaryCredentials } from '../../src/types/config'
import type { FileMimeType } from '../../src/files/types'

const uploadBlobStreamMock = mock(
	async (
		_file: Blob,
		_credentials: CloudinaryCredentials,
		_options: UploadApiOptions
	) =>
		({
			secure_url: 'https://res.cloudinary.com/test/raw/upload/file.pdf',
			public_id: 'documents/file.pdf',
			bytes: 1024
		}) as UploadApiResponse
)

const validateBlobMock = mock(
	async (
		_file: Blob,
		_options: {
			maxFileSize: number
			allowedTypes: readonly FileMimeType[]
			detect: (bytes: Uint8Array) => FileMimeType | null
			label: string
		}
	): Promise<FileMimeType> => 'application/pdf' as FileMimeType
)

const destroyMock = mock(async () => ({
	result: 'ok'
}))

const realValidateBlob = (await import('../../src/shared/validate-blob'))
	.validateBlob

mock.module('../../src/shared/upload-stream', () => ({
	uploadBlobStream: uploadBlobStreamMock
}))

mock.module('../../src/shared/validate-blob', () => ({
	validateBlob: validateBlobMock
}))

mock.module('cloudinary', () => ({
	v2: {
		uploader: {
			destroy: destroyMock
		}
	}
}))

// Import after registering mocks.
const { FileManager } = await import('../../src/files/file-manager')

// Fixtures

const credentials: CloudinaryCredentials = {
	cloud_name: 'test-cloud',
	api_key: 'test-api-key',
	api_secret: 'test-api-secret'
}

const createFile = (name = 'document.pdf', type = 'application/pdf'): File => {
	return new File(['test file content'], name, { type })
}

const createManager = () => new FileManager(credentials)

// Tests

describe('FileManager', () => {
	beforeEach(() => {
		uploadBlobStreamMock.mockClear()
		validateBlobMock.mockClear()
		destroyMock.mockClear()

		destroyMock.mockImplementation(async () => ({
			result: 'ok'
		}))

		uploadBlobStreamMock.mockImplementation(
			async () =>
				({
					secure_url:
						'https://res.cloudinary.com/test/raw/upload/file.pdf',
					public_id: 'documents/file.pdf',
					bytes: 1024
				}) as UploadApiResponse
		)

		validateBlobMock.mockImplementation(async () => {
			return 'application/pdf' as FileMimeType
		})
	})

	// Constructor

	describe('constructor', () => {
		test('should create a FileManager instance', () => {
			const manager = createManager()

			expect(manager).toBeInstanceOf(FileManager)
		})

		test('should accept custom file options', () => {
			const manager = new FileManager(credentials, {
				maxFileSize: 5 * 1024 * 1024,
				allowedTypes: ['application/pdf']
			})

			expect(manager).toBeInstanceOf(FileManager)
		})
	})

	// uploadFile

	describe('uploadFile', () => {
		test('should upload a file successfully', async () => {
			const manager = createManager()
			const file = createFile()

			const result = await manager.uploadFile(file, 'documents')

			expect(validateBlobMock).toHaveBeenCalledTimes(1)

			expect(uploadBlobStreamMock).toHaveBeenCalledTimes(1)

			expect(result).toEqual({
				url: 'https://res.cloudinary.com/test/raw/upload/file.pdf',
				publicId: 'documents/file.pdf',
				bytes: 1024,
				mimeType: 'application/pdf'
			})
		})

		test('should normalize the target folder', async () => {
			const manager = createManager()

			await manager.uploadFile(createFile(), '/documents/')

			const options = uploadBlobStreamMock.mock.calls[0]?.[2]

			expect(options?.folder).toBe('documents')
		})

		test('should use the provided public ID', async () => {
			const manager = createManager()

			await manager.uploadFile(createFile(), 'documents', {
				publicId: 'documents/my-file'
			})

			const options = uploadBlobStreamMock.mock.calls[0]?.[2]

			expect(options?.public_id).toBe('documents/my-file')
		})

		test('should generate a public ID when one is not provided', async () => {
			const manager = createManager()

			await manager.uploadFile(createFile(), 'documents')

			const options = uploadBlobStreamMock.mock.calls[0]?.[2]

			expect(options?.public_id).toMatch(/^[0-9a-f-]{36}\.pdf$/i)
		})

		test('should use raw resource type', async () => {
			const manager = createManager()

			await manager.uploadFile(createFile(), 'documents')

			const options = uploadBlobStreamMock.mock.calls[0]?.[2]

			expect(options?.resource_type).toBe('raw')
		})

		test('should include tags when provided', async () => {
			const manager = createManager()

			await manager.uploadFile(createFile(), 'documents', {
				tags: ['invoice', 'important']
			})

			const options = uploadBlobStreamMock.mock.calls[0]?.[2]

			expect(options?.tags).toEqual(['invoice', 'important'])
		})

		test('should omit tags when an empty array is provided', async () => {
			const manager = createManager()

			await manager.uploadFile(createFile(), 'documents', {
				tags: []
			})

			const options = uploadBlobStreamMock.mock.calls[0]?.[2]

			expect(options?.tags).toBeUndefined()
		})

		test('should pass credentials to the upload helper', async () => {
			const manager = createManager()

			await manager.uploadFile(createFile(), 'documents')

			expect(uploadBlobStreamMock.mock.calls[0]?.[1]).toEqual(credentials)
		})

		test('should reject an invalid public ID', async () => {
			const manager = createManager()

			expect(
				manager.uploadFile(createFile(), 'documents', {
					publicId: 'documents/../file.pdf'
				})
			).rejects.toThrow()

			expect(uploadBlobStreamMock).not.toHaveBeenCalled()
		})

		test('should propagate file validation errors', async () => {
			const manager = createManager()

			validateBlobMock.mockRejectedValueOnce(
				new Error('Invalid file type')
			)

			expect(
				manager.uploadFile(createFile(), 'documents')
			).rejects.toThrow('Invalid file type')

			expect(uploadBlobStreamMock).not.toHaveBeenCalled()
		})

		test('should use per-upload validation options', async () => {
			const manager = createManager()

			await manager.uploadFile(createFile(), 'documents', {
				maxFileSize: 2048,
				allowedTypes: ['application/pdf'] as FileMimeType[]
			})

			const validationOptions = validateBlobMock.mock.calls[0]?.[1]

			expect(validationOptions?.maxFileSize).toBe(2048)

			expect(validationOptions?.allowedTypes).toEqual(['application/pdf'])
		})
	})

	// uploadFilesMany

	describe('uploadFilesMany', () => {
		test('should upload multiple files successfully', async () => {
			const manager = createManager()

			const files = [
				createFile('first.pdf'),
				createFile('second.pdf'),
				createFile('third.pdf')
			]

			const results = await manager.uploadFilesMany(files, 'documents')

			expect(results).toHaveLength(3)

			expect(uploadBlobStreamMock).toHaveBeenCalledTimes(3)
		})

		test('should reject empty input', async () => {
			const manager = createManager()

			await expect(
				manager.uploadFilesMany([], 'documents')
			).rejects.toThrow('At least one file is required')

			expect(uploadBlobStreamMock).not.toHaveBeenCalled()
		})

		test('should use the provided concurrency', async () => {
			const manager = createManager()

			await manager.uploadFilesMany(
				[createFile('first.pdf'), createFile('second.pdf')],
				'documents',
				{
					concurrency: 2
				}
			)

			expect(uploadBlobStreamMock).toHaveBeenCalledTimes(2)
		})

		test('should reject invalid concurrency', async () => {
			const manager = createManager()

			expect(
				manager.uploadFilesMany([createFile()], 'documents', {
					concurrency: 0
				})
			).rejects.toThrow()

			expect(uploadBlobStreamMock).not.toHaveBeenCalled()
		})

		test('should validate each file before uploading', async () => {
			const manager = createManager()

			await manager.uploadFilesMany(
				[createFile('first.pdf'), createFile('second.pdf')],
				'documents'
			)

			expect(validateBlobMock).toHaveBeenCalledTimes(4)
		})
	})

	// destroyFile

	describe('destroyFile', () => {
		test('should destroy a file successfully', async () => {
			const manager = createManager()

			await expect(
				manager.destroyFile('documents/file.pdf')
			).resolves.toBeUndefined()

			expect(destroyMock).toHaveBeenCalledTimes(1)

			expect(destroyMock).toHaveBeenCalledWith('documents/file.pdf', {
				...credentials,
				resource_type: 'raw',
				invalidate: true
			})
		})

		test('should reject an empty public ID', async () => {
			const manager = createManager()

			expect(manager.destroyFile('')).rejects.toThrow(
				'Public ID is required'
			)

			expect(destroyMock).not.toHaveBeenCalled()
		})

		test('should reject a whitespace public ID', async () => {
			const manager = createManager()

			expect(manager.destroyFile('   ')).rejects.toThrow(
				'Public ID is required'
			)

			expect(destroyMock).not.toHaveBeenCalled()
		})

		test('should reject a non-string public ID', async () => {
			const manager = createManager()

			expect(
				manager.destroyFile(null as unknown as string)
			).rejects.toThrow('Public ID is required')

			expect(destroyMock).not.toHaveBeenCalled()
		})

		test('should throw 404 when the file does not exist', async () => {
			const manager = createManager()

			destroyMock.mockImplementationOnce(async () => ({
				result: 'not found'
			}))

			await expect(
				manager.destroyFile('documents/missing.pdf')
			).rejects.toThrow('File not found')
		})

		test('should throw 502 when Cloudinary returns an unexpected result', async () => {
			const manager = createManager()

			destroyMock.mockImplementationOnce(async () => ({
				result: 'error'
			}))

			await expect(
				manager.destroyFile('documents/file.pdf')
			).rejects.toThrow('Failed to destroy file')
		})

		test('should propagate Cloudinary errors', async () => {
			const manager = createManager()

			destroyMock.mockRejectedValueOnce(
				new Error('Cloudinary connection failed')
			)

			await expect(
				manager.destroyFile('documents/file.pdf')
			).rejects.toThrow('Cloudinary connection failed')
		})
	})

	// destroyFilesMany

	describe('destroyFilesMany', () => {
		test('should destroy multiple files successfully', async () => {
			const manager = createManager()

			await manager.destroyFilesMany([
				'documents/first.pdf',
				'documents/second.pdf',
				'documents/third.pdf'
			])

			expect(destroyMock).toHaveBeenCalledTimes(3)
		})

		test('should resolve for an empty public IDs array', async () => {
			const manager = createManager()

			await expect(manager.destroyFilesMany([])).resolves.toBeUndefined()

			expect(destroyMock).not.toHaveBeenCalled()
		})

		test('should use the provided concurrency', async () => {
			const manager = createManager()

			await manager.destroyFilesMany(
				['documents/first.pdf', 'documents/second.pdf'],
				{
					concurrency: 2
				}
			)

			expect(destroyMock).toHaveBeenCalledTimes(2)
		})

		test('should propagate destroy errors', async () => {
			const manager = createManager()

			destroyMock.mockRejectedValueOnce(new Error('Destroy failed'))

			await expect(
				manager.destroyFilesMany(['documents/first.pdf'])
			).rejects.toThrow()
		})
	})
})

// Keep the module mocked, but make the mock delegate to the real validator
// so other test files in the same `bun test` process are not affected.
afterAll(() => {
	validateBlobMock.mockImplementation((file, rules) =>
		realValidateBlob(file, rules)
	)
})
