/**
 * Types for the Outreach Planner Agent
 */

import type { Linkt } from '@linkt/sdk';

// ============================================
// Linkt Webhook Types (from their docs)
// ============================================

export interface LinktWebhookPayload {
	event_type: string;
	timestamp: string;
	data: LinktWebhookData;
}

export interface LinktWebhookData {
	run_id: string;
	run_name: string;
	icp_name: string;
	icp_id: string;
	user_email: string;
	user_first_name: string;
	started_at: string;
	ended_at: string;
	duration_seconds: number;
	duration_formatted: string;
	credits_used: number;
	error_message: string | null;
	resources: {
		entities_created: string[];
		entities_updated: string[];
		signals_created: string[];
	};
	// Signal-specific fields
	total_signals?: number;
	signal_breakdown?: Record<string, number>;
}

// ============================================
// Signal Types (mocked full data for demo)
// ============================================

export interface Signal {
	id: string;
	type: SignalType;
	summary: string;
	company: string;
	strength: 'HIGH' | 'MEDIUM' | 'LOW';
	date: string;
	source?: string;
	details?: Record<string, unknown>;
}

export type SignalType =
	| 'funding'
	| 'leadership_change'
	| 'product_launch'
	| 'partnership'
	| 'acquisition'
	| 'expansion'
	| 'hiring_surge'
	| 'layoff'
	| 'award'
	| 'other'
	| (string & {});

// ============================================
// Linkt SDK Types
// ============================================

export type LinktSignalResponse = Linkt.SignalResponse;
export type LinktEntityResponse = Linkt.EntityResponse;

export interface LinktEntityData {
	name?: string;
	email?: string;
	title?: string;
	linkedin_url?: string;
	company_name?: string;
	company_domain?: string;
	industry?: string;
	location?: string;
	headquarters?: string;
	size?: string;
	employees?: string | number;
	revenue?: string;
	website?: string;
	description?: string;
}

export type LinktEntity = LinktEntityResponse & {
	data: LinktEntityData & Record<string, unknown>;
};

export interface EnrichedSignal {
	signal: Signal;
	entities: LinktEntity[];
	linktSignal?: LinktSignalResponse;
}

// ============================================
// Generated Outreach Types
// ============================================

export interface Outreach {
	email: {
		subject: string;
		body: string;
	};
	linkedin: string;
	twitter: string;
	callPoints: string[];
	summary: string;
}

// ============================================
// Stored Signal with Outreach
// ============================================

export interface StoredSignal {
	signal: Signal;
	entities?: LinktEntity[];
	linktSignal?: LinktSignalResponse;
	outreach: Outreach;
	generatedAt: string;
	status: 'pending' | 'generated' | 'error';
	error?: string;
	landingPageHtml?: string;
}

// ============================================
// API Response Types
// ============================================

export interface SignalListResponse {
	signals: StoredSignal[];
	total: number;
}

export interface WebhookResponse {
	success: boolean;
	signalId?: string;
	message: string;
}
