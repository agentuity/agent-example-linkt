/** Orchestrate signal enrichment and content generation. */

import { createAgent } from '@agentuity/runtime';
import type { AgentContext } from '@agentuity/runtime';
import { s } from '@agentuity/schema';
import { generateLandingPage } from './generators/landing-page';
import { generateOutreach } from './generators/outreach';
import { processSignalWebhook } from './services/linkt';
import type { EnrichedSignal, LinktWebhookPayload, Signal, StoredSignal } from './types';

// Schema definitions
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

// Agent definition
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
		let enrichedSignals: EnrichedSignal[] = [];

		if (input.signal) {
			enrichedSignals = [
				{
					signal: input.signal as Signal,
					entities: [],
					linktSignal: undefined,
				},
			];
		} else if (input.webhook) {
			const payload = input.webhook as LinktWebhookPayload;
			ctx.logger.info('Processing Linkt webhook', {
				event_type: payload.event_type,
				run_id: payload.data?.run_id,
			});

			enrichedSignals = await processSignalWebhook(payload, ctx.logger);
		}

		if (!enrichedSignals.length) {
			return {
				success: false,
				message: 'No signal data provided or retrieved',
			};
		}

		const results = await Promise.all(
			enrichedSignals.map((enrichedSignal) => processEnrichedSignal(ctx, enrichedSignal))
		);

		const successful = results.filter((result) => result.success);
		const failed = results.filter((result) => !result.success);
		const firstSignalId = successful[0]?.signalId ?? results[0]?.signalId;
		const message = successful.length
			? `Generated outreach for ${successful.length} signal(s)`
			: `Failed to generate outreach for ${failed.length} signal(s)`;

		return {
			success: successful.length > 0,
			signalId: firstSignalId,
			message,
		};
	},
});

async function processEnrichedSignal(
	ctx: AgentContext<any, any, any>,
	enrichedSignal: EnrichedSignal
): Promise<{ success: boolean; signalId: string; message: string }> {
	const { signal, entities, linktSignal } = enrichedSignal;

	ctx.logger.info('Processing signal', {
		id: signal.id,
		type: signal.type,
		company: signal.company,
		entities: entities.length,
	});

	try {
		const [outreach, landingPageResult] = await Promise.all([
			generateOutreach(signal, entities),
			generateLandingPage(ctx, signal, entities).catch((err) => {
				ctx.logger.warn('Landing page generation failed, continuing without it', {
					error: String(err),
				});
				return null;
			}),
		]);

		const storedSignal: StoredSignal = {
			signal,
			entities,
			linktSignal,
			outreach,
			landingPageHtml: landingPageResult ?? undefined,
			generatedAt: new Date().toISOString(),
			status: 'generated',
		};

		await ctx.kv.set(KV_NAMESPACE, `signal:${signal.id}`, storedSignal);
		await updateSignalIndex(ctx, signal.id);

		ctx.logger.info('Signal processed', { signalId: signal.id });

		return {
			success: true,
			signalId: signal.id,
			message: `Outreach generated for ${signal.company} (${signal.type})`,
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		ctx.logger.error('Failed to process signal', { error: errorMessage });

		const storedSignal: StoredSignal = {
			signal,
			entities,
			linktSignal,
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
		await updateSignalIndex(ctx, signal.id);

		return {
			success: false,
			signalId: signal.id,
			message: `Failed to generate outreach: ${errorMessage}`,
		};
	}
}

async function updateSignalIndex(
	ctx: AgentContext<any, any, any>,
	signalId: string
): Promise<void> {
	const indexResult = await ctx.kv.get<string[]>(KV_NAMESPACE, 'signal:index');
	const signalIds: string[] = indexResult.exists ? indexResult.data : [];

	if (!signalIds.includes(signalId)) {
		signalIds.unshift(signalId);
		await ctx.kv.set(KV_NAMESPACE, 'signal:index', signalIds);
	}
}

export default outreachPlanner;
