# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2025-02-17

### Added
- **Security**: Added `.gitignore` to prevent sensitive files from being committed
- **Security**: Added `helmet` middleware for security headers
- **Security**: Added `express-rate-limit` for API rate limiting
- **Security**: Added request timeouts to prevent hanging requests
- **Security**: Added input size limits for scraping (10MB max)
- **Security**: Added XSS protection in link extraction

### Changed
- **Performance**: Added `compression` middleware for gzip compression
- **Performance**: Added cache headers for static files in production
- **Reliability**: Implemented graceful shutdown handling (SIGTERM/SIGINT)
- **Reliability**: Added structured JSON logging throughout the application
- **Reliability**: Added job timeouts (5 minute default)
- **Reliability**: Added scrape timeouts (30 second default)
- **Reliability**: Added OpenAI timeout with fallback to heuristic analysis
- **Reliability**: Enhanced error handling with graceful fallbacks

### Infrastructure
- Added Dockerfile for containerized deployment
- Added GitHub Actions CI/CD pipeline
- Added health check endpoint with detailed status
- Added environment variable documentation

## [1.0.0] - 2025-02-16

### Added
- Initial release of Website Optimizer
- Website scraping functionality
- AI-powered analysis (OpenAI integration)
- Heuristic fallback analysis
- Automatic site optimization and generation
- Netlify deployment integration
- SQLite job queue
- Server-Sent Events for real-time progress
- Simple web UI

### Features
- URL validation with Zod
- Job status tracking
- Error handling and reporting
- Responsive frontend
