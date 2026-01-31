/**
 * Outreach Planner Agent
 *
 * Receives signals from Linkt webhooks and generates outreach content.
 */

import { createAgent } from '@agentuity/runtime';
import { s } from '@agentuity/schema';
import { generateOutreach } from './generator';
import { generateLandingPage } from './landing-generator';
import type { Signal, StoredSignal, LinktWebhookPayload } from './types';

// ============================================
// Schema Definitions
// ============================================

const SignalSchema = s.object({
	id: s.string(),
	type: s.string(),
	summary: s.string(),
	company: s.string(),
	strength: s.enum(['HIGH', 'MEDIUM', 'LOW']),
	date: s.string(),
	source: s.optional(s.string()),
	details: s.optional(s.record(s.string(), s.any())),
});

const InputSchema = s.object({
	signal: s.optional(SignalSchema),
	webhook: s.optional(s.any()),
});

// ============================================
// Agent Definition
// ============================================

const KV_NAMESPACE = 'outreach-planner';

const outreachPlanner = createAgent('outreach-planner', {
	description: 'Processes signals from Linkt and generates outreach content',
	schema: {
		input: InputSchema,
		output: s.object({
			success: s.boolean(),
			signalId: s.optional(s.string()),
			message: s.string(),
		}),
	},

	handler: async (ctx, input) => {
		// Extract signal from input
		let signal: Signal | null = null;

		if (input.signal) {
			signal = input.signal as Signal;
		} else if (input.webhook) {
			const payload = input.webhook as LinktWebhookPayload;
			ctx.logger.info('Processing Linkt webhook', {
				event_type: payload.event_type,
				run_id: payload.data?.run_id,
			});

			// For demo: webhook should include full signal data
			if (payload.data?.resources?.signals_created?.length) {
				return {
					success: false,
					message: 'Webhook contains signal IDs only. For demo, send full signal data.',
				};
			}
		}

		if (!signal) {
			return {
				success: false,
				message: 'No signal data provided',
			};
		}

		ctx.logger.info('Processing signal', {
			id: signal.id,
			type: signal.type,
			company: signal.company,
		});

		try {
			// Generate outreach AND landing page in parallel
			const [outreach, landingPageResult] = await Promise.all([
				generateOutreach(signal),
				generateLandingPage(ctx, signal).catch((err) => {
					ctx.logger.warn('Landing page generation failed, continuing without it', {
						error: String(err),
					});
					return null;
				}),
			]);

			// Store signal with outreach (and landing page HTML if available)
			const storedSignal: StoredSignal = {
				signal,
				outreach,
				landingPageHtml: landingPageResult ?? undefined,
				generatedAt: new Date().toISOString(),
				status: 'generated',
			};

			await ctx.kv.set(KV_NAMESPACE, `signal:${signal.id}`, storedSignal);

			// Maintain index of signal IDs
			const indexResult = await ctx.kv.get<string[]>(KV_NAMESPACE, 'signal:index');
			const signalIds: string[] = indexResult.exists ? indexResult.data : [];

			if (!signalIds.includes(signal.id)) {
				signalIds.unshift(signal.id);
				await ctx.kv.set(KV_NAMESPACE, 'signal:index', signalIds);
			}

			ctx.logger.info('Signal processed', { signalId: signal.id });

			return {
				success: true,
				signalId: signal.id,
				message: `Outreach generated for ${signal.company} (${signal.type})`,
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			ctx.logger.error('Failed to process signal', { error: errorMessage });

			// Store error state
			const storedSignal: StoredSignal = {
				signal,
				outreach: {
					email: { subject: '', body: '' },
					linkedin: '',
					twitter: '',
					callPoints: [],
					summary: '',
				},
				generatedAt: new Date().toISOString(),
				status: 'error',
				error: errorMessage,
			};

			await ctx.kv.set(KV_NAMESPACE, `signal:${signal.id}`, storedSignal);

			return {
				success: false,
				signalId: signal.id,
				message: `Failed to generate outreach: ${errorMessage}`,
			};
		}
	},
});

export default outreachPlanner;
