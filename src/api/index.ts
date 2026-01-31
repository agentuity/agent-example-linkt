/** REST API routes for the outreach planner demo. */

import { createRouter } from '@agentuity/runtime';
import outreachPlanner from '../agent/outreach-planner';
import type { StoredSignal, SignalListResponse } from '../agent/outreach-planner/types';

const api = createRouter();

const KV_NAMESPACE = 'outreach-planner';

// Webhook endpoints
api.post('/webhook/linkt', async (c) => {
	const data = await c.req.json();
	const signalIds = data?.data?.resources?.signals_created ?? [];

	c.var.logger.info('Received Linkt webhook', {
		hasSignal: !!data?.signal,
		signalCount: signalIds.length,
	});

	c.waitUntil(async () => {
		try {
			await outreachPlanner.run({ webhook: data });
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			c.var.logger.error('Webhook processing failed', { error: errorMessage });
		}
	});

	return c.json({ received: true, processing: true, signalIds });
});

api.post('/webhook/linkt-sync', async (c) => {
	const data = await c.req.json();
	const payload = data?.event_type ? { webhook: data } : data;

	c.var.logger.info('Received Linkt sync webhook', { hasSignal: !!data?.signal });

	try {
		const result = await outreachPlanner.run(payload);
		return c.json({ received: true, result });
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		c.var.logger.error('Webhook sync processing failed', { error: errorMessage });
		return c.json({ received: false, error: errorMessage }, 500);
	}
});

// Signal endpoints
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

api.get('/signals/:id', async (c) => {
	const id = c.req.param('id');

	const result = await c.var.kv.get<StoredSignal>(KV_NAMESPACE, `signal:${id}`);
	if (!result.exists) {
		return c.json({ error: 'Signal not found' }, 404);
	}

	return c.json(result.data);
});

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

// Landing page endpoint
api.get('/landing/:id', async (c) => {
	const id = c.req.param('id');

	const result = await c.var.kv.get<StoredSignal>(KV_NAMESPACE, `signal:${id}`);
	if (!result.exists) {
		return c.json({ error: 'Signal not found' }, 404);
	}

	if (!result.data.landingPageHtml) {
		return c.json({ error: 'Landing page not available for this signal' }, 404);
	}

	// Return the HTML with proper content type
	return c.html(result.data.landingPageHtml);
});

// Health check
api.get('/health', (c) => {
	return c.json({
		status: 'ok',
		timestamp: new Date().toISOString(),
		agent: 'outreach-planner',
	});
});

export default api;
