#!/usr/bin/env bun

import { generateModule } from './generators/module.generator'

const args = process.argv.slice(2)

const [command, type, name] = args

function showHelp(): void {
	console.log(`
🧽 RiserBob CLI

Usage:
  riserbob g module <name>
  riserbob generate module <name>
  riserbob --help

Commands:
  g, generate    Generate a component
  --help         Show this help message
`)
}

async function main(): Promise<void> {
	if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
		showHelp()
		return
	}

	if (args.includes('--version') || args.includes('-v')) {
		console.log('RiserBob CLI')
		console.log('Version is provided by the installed package.')
		return
	}

	if (
		(command === 'g' || command === 'generate') &&
		type === 'module' &&
		name
	) {
		await generateModule(name)
		return
	}

	console.error('🧽 Oh, barnacles! Unknown command.')
	showHelp()
	process.exitCode = 1
}

main().catch((error: unknown) => {
	const message =
		error instanceof Error ? error.message : 'Something went wrong.'

	console.error(`🍍 RiserBob CLI: ${message}`)
	process.exitCode = 1
})
