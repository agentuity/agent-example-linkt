/**
 * API Routes for Outreach Planner
 *
 * - POST /webhook/linkt - Receive Linkt webhooks
 * - GET /api/signals - List all signals with outreach
 * - GET /api/signals/:id - Get specific signal
 * - POST /api/signals/:id/regenerate - Regenerate outreach for a signal
 */

import { createRouter } from '@agentuity/runtime';
import outreachPlanner from '../agent/outreach-planner';
import type { StoredSignal, SignalListResponse } from '../agent/outreach-planner/types';

const api = createRouter();

const KV_NAMESPACE = 'outreach-planner';

// ============================================
// Webhook Endpoint
// ============================================

/**
 * POST /webhook/linkt
 * Receive signal webhooks from Linkt
 * Returns 200 immediately and processes in background
 */
api.post('/webhook/linkt', async (c) => {
	const data = await c.req.json();

	c.var.logger.info('Received Linkt webhook', { hasSignal: !!data?.signal });

	// Process in background, respond immediately
	c.waitUntil(async () => {
		try {
			await outreachPlanner.run(data);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			c.var.logger.error('Webhook processing failed', { error: errorMessage });
		}
	});

	return c.json({ received: true });
});

// ============================================
// Signal CRUD Endpoints
// ============================================

/**
 * GET /api/signals
 * List all stored signals with their outreach content
 */
api.get('/signals', async (c) => {
	// Get the index of signal IDs
	const indexResult = await c.var.kv.get<string[]>(KV_NAMESPACE, 'signal:index');
	if (!indexResult.exists) {
		return c.json({ signals: [], total: 0 } satisfies SignalListResponse);
	}

	const signalIds = indexResult.data;

	// Fetch all signals
	const signals: StoredSignal[] = [];
	for (const id of signalIds) {
		const signalResult = await c.var.kv.get<StoredSignal>(KV_NAMESPACE, `signal:${id}`);
		if (signalResult.exists) {
			signals.push(signalResult.data);
		}
	}

	return c.json({ signals, total: signals.length } satisfies SignalListResponse);
});

/**
 * GET /api/signals/:id
 * Get a specific signal by ID
 */
api.get('/signals/:id', async (c) => {
	const id = c.req.param('id');

	const result = await c.var.kv.get<StoredSignal>(KV_NAMESPACE, `signal:${id}`);
	if (!result.exists) {
		return c.json({ error: 'Signal not found' }, 404);
	}

	return c.json(result.data);
});

/**
 * POST /api/signals/:id/regenerate
 * Regenerate outreach for a specific signal
 */
api.post('/signals/:id/regenerate', async (c) => {
	const id = c.req.param('id');

	const result = await c.var.kv.get<StoredSignal>(KV_NAMESPACE, `signal:${id}`);
	if (!result.exists) {
		return c.json({ error: 'Signal not found' }, 404);
	}

	// Re-run the agent with the existing signal
	const agentResult = await outreachPlanner.run({ signal: result.data.signal });

	return c.json(agentResult);
});

/**
 * DELETE /api/signals/:id
 * Delete a signal
 */
api.delete('/signals/:id', async (c) => {
	const id = c.req.param('id');

	// Remove from index
	const indexResult = await c.var.kv.get<string[]>(KV_NAMESPACE, 'signal:index');
	if (indexResult.exists) {
		const newIds = indexResult.data.filter((sid) => sid !== id);
		await c.var.kv.set(KV_NAMESPACE, 'signal:index', newIds);
	}

	// Delete the signal
	await c.var.kv.delete(KV_NAMESPACE, `signal:${id}`);

	return c.json({ success: true, message: 'Signal deleted' });
});

// ============================================
// Health Check
// ============================================

api.get('/health', (c) => {
	return c.json({
		status: 'ok',
		timestamp: new Date().toISOString(),
		agent: 'outreach-planner',
	});
});

export default api;
