/** Generate landing pages with OpenCode in an Agentuity sandbox. */

import type { AgentContext } from '@agentuity/runtime';
import type { LinktEntity, Signal } from '../types';

const CONFIG = {
	MAX_WAIT_MS: 180_000,
	POLL_INTERVAL_MS: 3_000,
	MIN_HTML_LENGTH: 100,
	OUTPUT_PATH: '/home/agentuity/output.html',
	RESOURCES: {
		memory: '2Gi',
		cpu: '2000m',
	},
	TIMEOUT: {
		execution: '5m',
		idle: '5m',
	},
};

export async function generateLandingPage(
	ctx: AgentContext<any, any, any>,
	signal: Signal,
	entities: LinktEntity[] = []
): Promise<string | null> {
	ctx.logger.info('Starting landing page generation', { signalId: signal.id });

	if (!ctx.sandbox?.create) {
		ctx.logger.error('Sandbox service not available');
		return null;
	}

	const prompt = buildLandingPagePrompt(signal, entities);
	let sandbox: Awaited<ReturnType<typeof ctx.sandbox.create>> | null = null;

	try {
		sandbox = await ctx.sandbox.create({
			runtime: 'opencode:latest',
			network: { enabled: true },
			resources: CONFIG.RESOURCES,
			timeout: CONFIG.TIMEOUT,
		});

		ctx.logger.info('Sandbox created', { sandboxId: sandbox.id });

		const execution = await sandbox.execute({
			command: ['opencode', 'run', prompt],
			timeout: CONFIG.TIMEOUT.execution,
		});

		ctx.logger.info('OpenCode execution started', {
			executionId: execution.executionId,
			status: execution.status,
		});

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
			const fileStream = await sandbox.readFile(CONFIG.OUTPUT_PATH);
			const content = await readStreamToString(fileStream);

			if (content.length >= CONFIG.MIN_HTML_LENGTH && content.includes('<html')) {
				ctx.logger.info('Output file found', {
					elapsedMs: Date.now() - startTime,
					contentLength: content.length,
				});

				return extractHtmlFromOutput(content);
			}
		} catch {
			// Output not ready yet.
		}

		await sleep(CONFIG.POLL_INTERVAL_MS);
	}

	ctx.logger.error('Timeout waiting for output file', {
		elapsedMs: Date.now() - startTime,
		maxWaitMs: CONFIG.MAX_WAIT_MS,
	});

	return null;
}

function buildLandingPagePrompt(signal: Signal, entities: LinktEntity[]): string {
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
	const entityContext = buildEntityContext(entities);
	const ctaGuidance = buildCtaGuidance(entities);

	return `Write a complete HTML landing page to ${CONFIG.OUTPUT_PATH} for this business signal.

IMPORTANT: Use the Write tool to create the file at ${CONFIG.OUTPUT_PATH}

## Signal Information
- Company: ${signal.company}
- Signal Type: ${signal.type.replace(/_/g, ' ')}
- Strength: ${signal.strength}
- Date: ${signal.date}
- Summary: ${signal.summary}
${signal.source ? `- Source: ${signal.source}` : ''}

${entityContext}

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
	- Call-to-action with targeted messaging
	- Footer with timestamp
4. Technical:
   - Single HTML file, all CSS inline in a <style> tag
   - No external dependencies or CDN links
   - Semantic HTML5
   - Mobile-responsive

 CTA Guidance:
 ${ctaGuidance}

 Write the complete HTML file now to ${CONFIG.OUTPUT_PATH}`;
}

function buildEntityContext(entities: LinktEntity[]): string {
	if (!entities.length) {
		return '## Entity Context\nNo entity data available.';
	}

	const company = findCompanyEntity(entities);
	const contact = findPersonEntity(entities);

	const companyName = toText(company?.data?.name) ?? toText(company?.data?.company_name);
	const companyIndustry = toText(company?.data?.industry);
	const companyLocation = toText(company?.data?.location) ?? toText(company?.data?.headquarters);
	const companySize = toText(company?.data?.size) ?? toText(company?.data?.employees);
	const companyWebsite = toText(company?.data?.website) ?? toText(company?.data?.company_domain);

	const contactName = toText(contact?.data?.name);
	const contactTitle = toText(contact?.data?.title);
	const contactLinkedIn = toText(contact?.data?.linkedin_url);

	return `## Entity Context
- Company Name: ${companyName ?? 'Unknown'}
- Company Industry: ${companyIndustry ?? 'Unknown'}
- Company Size: ${companySize ?? 'Unknown'}
- Company Location: ${companyLocation ?? 'Unknown'}
- Company Website: ${companyWebsite ?? 'Unknown'}
- Primary Contact: ${contactName ?? 'Unknown'}
- Contact Title: ${contactTitle ?? 'Unknown'}
- Contact LinkedIn: ${contactLinkedIn ?? 'Unknown'}`;
}

function buildCtaGuidance(entities: LinktEntity[]): string {
	const contact = findPersonEntity(entities);
	const company = findCompanyEntity(entities);
	const contactName = toText(contact?.data?.name);
	const companyName =
		toText(company?.data?.name) ?? toText(company?.data?.company_name) ?? toText(contact?.data?.company_name);

	if (contact) {
		return `Focus the CTA on a direct outreach to ${contactName ?? 'the contact'} at ${companyName ?? 'their company'}, such as booking a 15-minute strategy call or requesting a tailored plan.`;
	}

	if (company) {
		return `Focus the CTA on ${companyName ?? 'the company'} with a clear next step (request a tailored assessment, benchmark report, or strategy session).`;
	}

	return 'Use a general B2B CTA to request a tailored plan or short consultation.';
}

function findCompanyEntity(entities: LinktEntity[]): LinktEntity | undefined {
	return entities.find(
		(entity) =>
			entity.entity_type === 'company' || typeof entity.data?.company_name === 'string'
	);
}

function findPersonEntity(entities: LinktEntity[]): LinktEntity | undefined {
	return entities.find((entity) => entity.entity_type === 'person' || typeof entity.data?.email === 'string');
}

function toText(value: unknown): string | undefined {
	if (typeof value === 'string') {
		return value.trim();
	}

	if (typeof value === 'number') {
		return String(value);
	}

	return undefined;
}

function extractHtmlFromOutput(output: string): string | null {
	const doctypeMatch = output.match(/<!DOCTYPE html>[\s\S]*<\/html>/i);
	if (doctypeMatch) {
		return doctypeMatch[0];
	}

	const htmlMatch = output.match(/<html[\s\S]*<\/html>/i);
	if (htmlMatch) {
		return `<!DOCTYPE html>\n${htmlMatch[0]}`;
	}

	return null;
}

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

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
