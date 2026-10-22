# Security Policy

## Supported Versions

Security updates are provided for versions that are actively maintained.

| Version        | Supported |
| -------------- | --------- |
| Latest release | Yes       |
| Older releases | No        |

Support status may change as the project evolves.

## Reporting a Vulnerability

If you discover a potential security vulnerability in RiserBob, please report it privately.

**Do not disclose security vulnerabilities publicly through GitHub Issues or Pull Requests before they have been reviewed.**

You can report a vulnerability through GitHub's private vulnerability reporting feature, if enabled for this repository.

Please include the following information when possible:

- A description of the vulnerability.
- Steps to reproduce the issue.
- The potential security impact.
- A minimal proof of concept.
- Any suggested mitigation or fix.

Please avoid including real credentials, personal data, or sensitive production information.

## Response Process

The project maintainer will review the report, assess its severity, and determine the appropriate remediation.

We will aim to acknowledge reports within 7 days and provide updates as the investigation progresses.

These response times are goals, not guaranteed deadlines.

Once a fix is available, the maintainer will coordinate an appropriate disclosure and release process.

## Security Best Practices

When using RiserBob:

- Keep dependencies updated.
- Validate untrusted input.
- Avoid exposing internal error details to clients.
- Never commit secrets, API keys, or credentials.
- Apply authentication and authorization where required.
- Review middleware and route configurations carefully.

## Scope

This policy applies to security vulnerabilities in RiserBob itself, including its request handling, routing, middleware, and other maintained components.

Vulnerabilities in third-party dependencies may need to be reported to their respective maintainers.

Thank you for helping keep RiserBob and its users secure.
