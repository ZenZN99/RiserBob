import { v2 as cloudinary } from 'cloudinary'
import type { UploadApiOptions, UploadApiResponse } from 'cloudinary'
import { Readable } from 'node:stream'
import type { ReadableStream as NodeReadableStream } from 'node:stream/web'
import { HttpError } from 'riser-bob'

interface CloudinaryCredentials {
	cloud_name: string
	api_key: string
	api_secret: string
}

/**
 * Uploads a Blob to Cloudinary through a stream.
 *
 * This avoids loading the entire file into a Buffer.
 */
export function uploadBlobStream(
	file: Blob,
	credentials: CloudinaryCredentials,
	options: UploadApiOptions
): Promise<UploadApiResponse> {
	return new Promise((resolve, reject) => {
		const uploadStream = cloudinary.uploader.upload_stream(
			{
				...credentials,
				...options
			},
			(error, result) => {
				if (error) {
					reject(
						new HttpError(
							502,
							error.message || 'Cloudinary upload failed'
						)
					)
					return
				}

				if (!result) {
					reject(
						new HttpError(
							502,
							'Cloudinary returned an empty upload response'
						)
					)
					return
				}

				resolve(result)
			}
		)

		const source = Readable.fromWeb(
			file.stream() as unknown as NodeReadableStream
		)

		source.on('error', (error) => {
			uploadStream.destroy(error)
		})

		uploadStream.on('error', (error) => {
			source.destroy()
			reject(
				new HttpError(
					502,
					error.message || 'Cloudinary upload stream failed'
				)
			)
		})

		source.pipe(uploadStream)
	})
}
