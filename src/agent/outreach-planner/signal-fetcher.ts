import linkt from './linkt-client';
import type {
	EnrichedSignal,
	LinktEntity,
	LinktSignalResponse,
	LinktWebhookPayload,
	Signal,
} from './types';

type LoggerLike = {
	info?: (message: string, meta?: Record<string, unknown>) => void;
	warn?: (message: string, meta?: Record<string, unknown>) => void;
	error?: (message: string, meta?: Record<string, unknown>) => void;
};

const DEFAULT_COMPANY_NAME = 'Target Account';

export async function fetchSignal(
	signalId: string,
	logger?: LoggerLike
): Promise<EnrichedSignal | null> {
	try {
		const linktSignal = await linkt.signal.retrieve(signalId);
		const entities = await fetchEntities(linktSignal.entity_ids, logger);
		const signal = mapLinktSignalToSignal(linktSignal, entities);

		return {
			signal,
			entities,
			linktSignal,
		};
	} catch (error) {
		logger?.error?.('Failed to fetch signal from Linkt', {
			signalId,
			error: error instanceof Error ? error.message : String(error),
		});
		return null;
	}
}

export async function fetchEntities(
	entityIds: string[],
	logger?: LoggerLike
): Promise<LinktEntity[]> {
	if (!entityIds?.length) {
		return [];
	}

	const results = await Promise.allSettled(
		entityIds.map(async (entityId) => ({
			entityId,
			entity: await linkt.entity.retrieve(entityId),
		}))
	);

	const entities: LinktEntity[] = [];

	for (const result of results) {
		if (result.status === 'fulfilled') {
			entities.push(result.value.entity as LinktEntity);
			continue;
		}

		logger?.warn?.('Failed to fetch entity from Linkt', {
			error: result.reason instanceof Error ? result.reason.message : String(result.reason),
		});
	}

	return entities;
}

export async function processSignalWebhook(
	webhookData: LinktWebhookPayload,
	logger?: LoggerLike
): Promise<EnrichedSignal[]> {
	const signalIds = webhookData?.data?.resources?.signals_created ?? [];

	if (!signalIds.length) {
		logger?.warn?.('Webhook contained no signal IDs', {
			eventType: webhookData?.event_type,
			runId: webhookData?.data?.run_id,
		});
		return [];
	}

	const results = await Promise.allSettled(signalIds.map((id) => fetchSignal(id, logger)));
	const enrichedSignals: EnrichedSignal[] = [];

	for (const result of results) {
		if (result.status === 'fulfilled' && result.value) {
			enrichedSignals.push(result.value);
			continue;
		}

		if (result.status === 'rejected') {
			logger?.warn?.('Failed to process signal ID from webhook', {
				error: result.reason instanceof Error ? result.reason.message : String(result.reason),
			});
		}
	}

	return enrichedSignals;
}

function mapLinktSignalToSignal(linktSignal: LinktSignalResponse, entities: LinktEntity[]): Signal {
	const companyName = resolveCompanyName(entities) ?? DEFAULT_COMPANY_NAME;
	const strength = normalizeStrength(linktSignal.strength);
	const signalType = linktSignal.signal_type ?? 'other';

	return {
		id: linktSignal.id,
		type: signalType,
		summary: linktSignal.summary || `Signal detected for ${companyName}.`,
		company: companyName,
		strength,
		date: linktSignal.created_at,
		source: linktSignal.references?.[0],
		details: {
			icpId: linktSignal.icp_id,
			entityIds: linktSignal.entity_ids,
			references: linktSignal.references,
		},
	};
}

function resolveCompanyName(entities: LinktEntity[]): string | null {
	const companyEntity = entities.find(
		(entity) =>
			entity.entity_type === 'company' ||
			(typeof entity.data?.company_name === 'string' && entity.data.company_name.length > 0)
	);

	const personEntity = entities.find((entity) => entity.entity_type === 'person');

	return (
		toText(companyEntity?.data?.name) ||
		toText(companyEntity?.data?.company_name) ||
		toText(personEntity?.data?.company_name) ||
		null
	);
}

function normalizeStrength(strength: string | null): Signal['strength'] {
	if (!strength) {
		return 'MEDIUM';
	}

	const normalized = strength.toUpperCase();
	if (normalized === 'HIGH' || normalized === 'MEDIUM' || normalized === 'LOW') {
		return normalized;
	}

	return 'MEDIUM';
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
