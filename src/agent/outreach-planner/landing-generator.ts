/**
 * Landing Page Generator
 *
 * Uses Agentuity sandbox with OpenCode to generate landing pages.
 *
 * APPROACH: Use sandbox.create() for interactive sandbox execution.
 * OpenCode writes the HTML to a file, we poll for it, then read it back.
 *
 * NOTE: sandbox.run() has a bug where stdout/stderr are not captured
 * (SDK #795 - still open as of 2026-01-31). We use sandbox.create()
 * with file-based output as a workaround.
 */

import type { AgentContext } from '@agentuity/runtime';
import type { Signal } from './types';

/** Configuration for the landing page generator */
const CONFIG = {
	/** Maximum time to wait for OpenCode to generate the file */
	MAX_WAIT_MS: 180_000, // 3 minutes
	/** How often to check for the output file */
	POLL_INTERVAL_MS: 3_000, // 3 seconds
	/** Minimum content length to consider valid HTML */
	MIN_HTML_LENGTH: 100,
	/** Path where OpenCode writes the output */
	OUTPUT_PATH: '/home/agentuity/output.html',
	/** Sandbox resource configuration */
	RESOURCES: {
		memory: '2Gi',
		cpu: '2000m',
	},
	/** Sandbox timeout configuration */
	TIMEOUT: {
		execution: '5m',
		idle: '5m',
	},
};

/**
 * Generate a landing page for a signal using OpenCode in a sandbox
 * Returns the HTML content, or null if generation fails
 */
export async function generateLandingPage(
	ctx: AgentContext<any, any, any>,
	signal: Signal
): Promise<string | null> {
	ctx.logger.info('Starting landing page generation', { signalId: signal.id });

	// Check if sandbox service is available
	if (!ctx.sandbox?.create) {
		ctx.logger.error('Sandbox service not available');
		return null;
	}

	const prompt = buildLandingPagePrompt(signal);
	let sandbox: Awaited<ReturnType<typeof ctx.sandbox.create>> | null = null;

	try {
		// Create an interactive sandbox with OpenCode runtime
		sandbox = await ctx.sandbox.create({
			runtime: 'opencode:latest',
			network: { enabled: true },
			resources: CONFIG.RESOURCES,
			timeout: CONFIG.TIMEOUT,
		});

		ctx.logger.info('Sandbox created', { sandboxId: sandbox.id });

		// Execute OpenCode to generate the landing page
		// Note: execute() queues the command and returns immediately
		const execution = await sandbox.execute({
			command: ['opencode', 'run', prompt],
			timeout: CONFIG.TIMEOUT.execution,
		});

		ctx.logger.info('OpenCode execution started', {
			executionId: execution.executionId,
			status: execution.status,
		});

		// Poll for the output file
		const html = await pollForOutputFile(ctx, sandbox);

		if (html) {
			ctx.logger.info('Landing page generated successfully', {
				htmlLength: html.length,
			});
			return html;
		}

		ctx.logger.error('Failed to generate landing page - no valid HTML produced');
		return null;
	} catch (error) {
		ctx.logger.error('Landing page generation failed', {
			signalId: signal.id,
			error: String(error),
		});
		return null;
	} finally {
		// Always clean up the sandbox
		if (sandbox) {
			try {
				await sandbox.destroy();
				ctx.logger.debug('Sandbox destroyed', { sandboxId: sandbox.id });
			} catch (destroyError) {
				ctx.logger.warn('Failed to destroy sandbox', {
					sandboxId: sandbox.id,
					error: String(destroyError),
				});
			}
		}
	}
}

/**
 * Poll for the output file and return the HTML content when ready
 */
async function pollForOutputFile(
	ctx: AgentContext<any, any, any>,
	sandbox: Awaited<ReturnType<typeof ctx.sandbox.create>>
): Promise<string | null> {
	const startTime = Date.now();

	ctx.logger.info('Polling for output file...', {
		maxWaitMs: CONFIG.MAX_WAIT_MS,
		pollIntervalMs: CONFIG.POLL_INTERVAL_MS,
	});

	while (Date.now() - startTime < CONFIG.MAX_WAIT_MS) {
		try {
			// Try to read the output file
			const fileStream = await sandbox.readFile(CONFIG.OUTPUT_PATH);
			const content = await readStreamToString(fileStream);

			// Check if we have valid HTML content
			if (content.length >= CONFIG.MIN_HTML_LENGTH && content.includes('<html')) {
				ctx.logger.info('Output file found', {
					elapsedMs: Date.now() - startTime,
					contentLength: content.length,
				});

				// Extract clean HTML from the content
				return extractHtmlFromOutput(content);
			}
		} catch {
			// File doesn't exist yet or other error - continue polling
		}

		// Wait before next poll
		await sleep(CONFIG.POLL_INTERVAL_MS);
	}

	ctx.logger.error('Timeout waiting for output file', {
		elapsedMs: Date.now() - startTime,
		maxWaitMs: CONFIG.MAX_WAIT_MS,
	});

	return null;
}

/**
 * Build the prompt for landing page generation
 */
function buildLandingPagePrompt(signal: Signal): string {
	const signalTypeDescriptions: Record<string, string> = {
		funding: 'funding rounds, investment news, and capital raises',
		leadership_change: 'executive moves, leadership transitions, and C-suite changes',
		product_launch: 'new product announcements, feature releases, and launches',
		partnership: 'strategic partnerships, alliances, and collaborations',
		acquisition: 'mergers, acquisitions, and company purchases',
		expansion: 'market expansion, new offices, and geographic growth',
		hiring_surge: 'rapid hiring, team growth, and talent acquisition',
		layoff: 'workforce changes, restructuring, and organizational shifts',
		award: 'industry recognition, awards, and achievements',
	};

	const signalCategory = signalTypeDescriptions[signal.type] || signal.type.replace(/_/g, ' ');

	return `Write a complete HTML landing page to ${CONFIG.OUTPUT_PATH} for this business signal.

IMPORTANT: Use the Write tool to create the file at ${CONFIG.OUTPUT_PATH}

## Signal Information
- Company: ${signal.company}
- Signal Type: ${signal.type.replace(/_/g, ' ')}
- Strength: ${signal.strength}
- Date: ${signal.date}
- Summary: ${signal.summary}
${signal.source ? `- Source: ${signal.source}` : ''}

## Requirements

Create a single-file HTML landing page that:

1. Appeals broadly to anyone interested in ${signalCategory}
2. Has professional, modern design with:
   - Clean typography using system fonts
   - Professional color scheme (blues/grays)
   - Responsive layout
   - All CSS in a <style> tag
3. Structure:
   - Hero section with compelling headline about ${signal.company}
   - Key highlights section summarizing the signal
   - Context section (why this matters)
   - Call-to-action
   - Footer with timestamp
4. Technical:
   - Single HTML file, all CSS inline in a <style> tag
   - No external dependencies or CDN links
   - Semantic HTML5
   - Mobile-responsive

Write the complete HTML file now to ${CONFIG.OUTPUT_PATH}`;
}

/**
 * Extract clean HTML from OpenCode's output
 * The output may include commentary or other text around the HTML
 */
function extractHtmlFromOutput(output: string): string | null {
	// Look for complete HTML document with DOCTYPE
	const doctypeMatch = output.match(/<!DOCTYPE html>[\s\S]*<\/html>/i);
	if (doctypeMatch) {
		return doctypeMatch[0];
	}

	// Try to find just <html>...</html> and add DOCTYPE
	const htmlMatch = output.match(/<html[\s\S]*<\/html>/i);
	if (htmlMatch) {
		return `<!DOCTYPE html>\n${htmlMatch[0]}`;
	}

	return null;
}

/**
 * Read a stream to a string
 */
async function readStreamToString(stream: ReadableStream<Uint8Array>): Promise<string> {
	const reader = stream.getReader();
	const chunks: Uint8Array[] = [];

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			if (value) chunks.push(value);
		}
	} finally {
		reader.releaseLock();
	}

	if (chunks.length === 0) {
		return '';
	}

	const buffer = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
	return new TextDecoder().decode(buffer);
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
