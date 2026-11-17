export type ValidationIssue =
  | {
      readonly kind: 'config'
      /** Where the problem is, e.g. `routes.getUsers.path`. */
      readonly location: string
      readonly message: string
    }
  | {
      readonly kind: 'missing-route'
      readonly key: string
      readonly method: string
      readonly path: string
      readonly hints: readonly string[]
    }
  | {
      readonly kind: 'docs-conflict'
      readonly target: string
      readonly path: string
      readonly message: string
    }

const PREFIX = '[RiserBob OpenAPI]'

function formatIssue(issue: ValidationIssue): string {
  switch (issue.kind) {
    case 'config':
      return `- ${issue.location}: ${issue.message}`
    case 'docs-conflict':
      return `- ${issue.target} (${issue.path}): ${issue.message}`
    case 'missing-route':
      return [
        `Documentation Key: ${issue.key}`,
        `Method: ${issue.method}`,
        `Path: ${issue.path}`,
        ...issue.hints.map((hint) => `Hint: ${hint}`),
      ].join('\n')
  }
}

export function formatIssues(issues: readonly ValidationIssue[]): string {
  const missing = issues.filter((issue) => issue.kind === 'missing-route')
  const config = issues.filter((issue) => issue.kind === 'config')
  const conflicts = issues.filter((issue) => issue.kind === 'docs-conflict')
  const sections: string[] = []

  if (config.length > 0) {
    sections.push(
      `${PREFIX} Invalid Configuration\n\n${config.map(formatIssue).join('\n')}`,
    )
  }

  if (missing.length > 0) {
    const title =
      missing.length === 1 ? 'Missing registered route:' : `Missing registered routes (${missing.length}):`
    sections.push(
      `${PREFIX} Strict Validation Failed\n\n${title}\n\n${missing
        .map(formatIssue)
        .join('\n\n')}\n\n${
        missing.length === 1 ? 'The documented endpoint was' : 'The documented endpoints were'
      } not registered in RiserBob.`,
    )
  }

  if (conflicts.length > 0) {
    sections.push(
      `${PREFIX} Documentation Path Conflict\n\n${conflicts.map(formatIssue).join('\n')}`,
    )
  }

  return sections.join('\n\n')
}

/**
 * Thrown by `new OpenAPI()` (invalid configuration) and `OpenAPI.setup()`
 * (strict validation, documentation path conflicts, incompatible RiserBob).
 * All problems found are reported together in `issues`.
 */
export class OpenAPIValidationError extends Error {
  readonly issues: readonly ValidationIssue[]

  constructor(issues: readonly ValidationIssue[], message?: string) {
    super(message ?? formatIssues(issues))
    this.name = 'OpenAPIValidationError'
    this.issues = Object.freeze([...issues])
  }
}
