import { createInterface, emitKeypressEvents } from 'node:readline'

export async function selectService(): Promise<boolean> {
	const input = process.stdin

	if (!input.isTTY || !process.stdout.isTTY) {
		const rl = createInterface({
			input,
			output: process.stdout
		})

		try {
			const answer = await new Promise<string>((resolve) => {
				rl.question(
					'\nDo you want to generate a Service? 🍍 Yes / 🫧 No [y/N]: ',
					resolve
				)
			})

			return answer.trim().toLowerCase() === 'y'
		} finally {
			rl.close()
		}
	}

	emitKeypressEvents(input)
	input.setRawMode(true)
	input.resume()

	let selectedIndex = 0

	const options = [
		{ label: '🍍 Yes', value: true },
		{ label: '🫧 No', value: false }
	]

	const render = () => {
		const lines = [
			'',
			'Do you want to generate a Service?',
			...options.map(
				(option, index) =>
					`${selectedIndex === index ? '❯' : ' '} ${option.label}`
			),
			'',
			'Use ↑ ↓ to navigate and Enter to select.'
		]

		process.stdout.write('\x1b[5A')

		for (const line of lines) {
			process.stdout.write(`\x1b[2K${line}\n`)
		}
	}

	process.stdout.write('\nDo you want to generate a Service?\n')
	render()

	return new Promise<boolean>((resolve, reject) => {
		const cleanup = () => {
			input.removeListener('keypress', onKeypress)
			input.setRawMode(false)
			input.pause()
		}

		const onKeypress = (
			_: string,
			key: { name?: string; ctrl?: boolean }
		) => {
			if (key.ctrl && key.name === 'c') {
				cleanup()
				process.stdout.write('\n')
				reject(new Error('Operation cancelled.'))
				return
			}

			if (key.name === 'up' || key.name === 'down') {
				selectedIndex = selectedIndex === 0 ? 1 : 0
				render()
				return
			}

			if (key.name === 'return') {
				const result = options[selectedIndex]!.value

				cleanup()
				process.stdout.write('\n')
				resolve(result)
			}
		}

		input.on('keypress', onKeypress)
	})
}
