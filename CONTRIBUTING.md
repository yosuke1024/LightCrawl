# Contributing to LightCrawl

Thank you for your interest in contributing to LightCrawl! We welcome all contributions, including bug reports, feature requests, documentation improvements, and code changes.

Please take a moment to review this document before submitting your contribution.

## How Can I Contribute?

### Reporting Bugs
If you find a bug, please create a new issue using our [Bug Report Template](.github/ISSUE_TEMPLATE/bug_report.md). Be sure to include clear steps to reproduce the issue.

### Suggesting Features
If you have an idea for a new feature or improvement, please submit a [Feature Request](.github/ISSUE_TEMPLATE/feature_request.md).

### Submitting Pull Requests
1. Fork the repository and create your branch from `main`.
2. Install dependencies:
   ```bash
   npm install
   npx playwright install chromium
   ```
3. **Follow Test-Driven Development (TDD)**:
   - When writing code (features or bug fixes), please write/update your tests first and ensure they fail (Red).
   - Implement the change and ensure all tests pass (Green).
   - Refactor as needed.
4. Ensure the codebase passes linting and builds correctly:
   ```bash
   npm run lint
   npm run build
   ```
5. Commit your changes. Use descriptive commit messages.
6. Push to your fork and submit a pull request.

## Development Guidelines

- **TypeScript**: We use TypeScript. Ensure your code has proper typings. Avoid using `any`.
- **Security**: Never commit sensitive information (e.g., API keys, `.env` files).
- **Tests**: All new features and bug fixes must have test coverage. We use Jest for unit testing.
