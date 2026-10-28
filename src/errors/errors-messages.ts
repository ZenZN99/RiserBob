export class ErrorMessages {
	constructor(private readonly funnyMode = true) {}

	invalidPath(path: string): string {
		if (this.funnyMode) {
			return `🧽 Oh, barnacles! "${path}" must start with "/"! 🍍`
		}

		return `Invalid path "${path}". The path must start with "/".`
	}

	handlerDidNotReturnResponse(): string {
		return this.funnyMode
			? '[RiserBob] 🧽 Oh, barnacles! Handler did not return a Response! 🍍'
			: '[RiserBob] Handler did not return a Response.'
	}

	requestFailed(): string {
		return this.funnyMode
			? '[RiserBob] 💀🧽 Barnacles! Request failed!'
			: '[RiserBob] Request failed.'
	}

	nextCalledMultipleTimes(): string {
		return this.funnyMode
			? '[RiserBob] 🧽 Oh, barnacles! next() called multiple times!'
			: '[RiserBob] next() called multiple times.'
	}

	duplicateRoute(key: string): string {
		return this.funnyMode
			? `🍍 Oh, barnacles! Route "${key}" already lives in Bikini Bottom! 🧽`
			: `Route "${key}" is already registered.`
	}

	methodNotAllowed(method: string, path: string, allowed: string[]): string {
		if (!this.funnyMode) {
			return (
				`Method Not Allowed\n` +
				`Requested Method: ${method}\n` +
				`Path: ${path}\n` +
				`Allowed Methods: ${allowed.join(', ')}`
			)
		}

		return (
			`[RiserBob] 😭🧽 Method Not Allowed!\n` +
			`Requested Method: ${method}\n` +
			`Path: ${path}\n` +
			`Allowed Methods: ${allowed.join(', ')}`
		)
	}

	routeNotFound(method: string, path: string): string {
		if (!this.funnyMode) {
			return (
				`Route Not Found\n` +
				`Requested Method: ${method}\n` +
				`Requested Path: ${path}\n` +
				`The requested route does not exist.`
			)
		}

		return (
			`[RiserBob] 🧽😂 Welcome to Bikini Bottom!\n` +
			`🔎 Requested Method: ${method}\n` +
			`🛣️ Requested Path: ${path}\n` +
			`🤷 Route not found! Did Patrick register it?\n` +
			`🍍 SpongeBob: "I checked my pineapple, but the endpoint isn't there!"\n` +
			`🦀 Mr. Krabs: "NO ROUTE, NO MONEY!"`
		)
	}

	handlerResponseMissing(
		method: string,
		path: string,
		received: string
	): string {
		if (!this.funnyMode) {
			return (
				`Handler did not return a valid Response\n` +
				`Method: ${method}\n` +
				`Path: ${path}\n` +
				`Expected: Response\n` +
				`Received: ${received}`
			)
		}

		return (
			`[RiserBob] 😭🧽 Oh no! RiserBob is sad! ` +
			`The Handler forgot to return a valid Response! 💔\n` +
			`Method: ${method}\n` +
			`Path: ${path}\n` +
			`Expected: Response\n` +
			`Received: ${received}\n` +
			`😢 SpongeBob is crying in Bikini Bottom... 🍍`
		)
	}

	requestHandlingFailed(): string {
		if (!this.funnyMode) {
			return 'An error occurred while handling the request.'
		}

		return (
			`[RiserBob] 😭🧽 Oh no! RiserBob is freaking out!\n` +
			`Something went wrong while handling this request! 💥\n` +
			`SpongeBob: "Who lives in a pineapple under a bug?! 😱🍍"\n` +
			`Error:`
		)
	}

	invalidValidationSchema(field: string): string {
		if (!this.funnyMode) {
			return (
				`Invalid Validation Schema\n` +
				`Field: ${field}\n` +
				`"required" and "nullable" cannot be combined.`
			)
		}

		return (
			`[RiserBob] 🧽🍍 Oh, barnacles! Invalid Validation Schema!\n` +
			`Field: ${field}\n` +
			`💥 "required" and "nullable" cannot be combined!\n` +
			`🦑 Squidward says: "Fix your Schema already!"`
		)
	}
}
