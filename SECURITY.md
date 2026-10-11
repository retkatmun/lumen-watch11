# Security Policy

## Scope

lumen-watch is a **read-only** tool. It never handles private keys or signs Stellar transactions. It only reads public account addresses via the Horizon API.

The main security concerns are:

- Webhook/Discord tokens stored in config files (never commit your config to version control)
- Dependency vulnerabilities

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | ✅        |

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Instead, report them privately:

1. Go to the repository on GitHub
2. Click **Security** → **Advisories** → **Report a vulnerability**
3. Describe the issue, steps to reproduce, and potential impact

We aim to acknowledge reports within 48 hours and publish a fix within 14 days.

## Best Practices for Users

- Store `lumen-watch.config.json` outside your repository or add it to `.gitignore`
- Use environment-specific webhook tokens with minimal permissions
- Run lumen-watch with the least-privileged OS user possible
- Keep Node.js and dependencies up to date
