import { useAPI } from '@agentuity/react';
import { useCallback, useState, useEffect } from 'react';
import './App.css';

// Types
interface Signal {
	id: string;
	type: string;
	summary: string;
	company: string;
	strength: 'HIGH' | 'MEDIUM' | 'LOW';
	date: string;
}

interface Outreach {
	email: { subject: string; body: string };
	linkedin: string;
	twitter: string;
	callPoints: string[];
	summary: string;
}

interface StoredSignal {
	signal: Signal;
	outreach: Outreach;
	generatedAt: string;
	status: 'pending' | 'generated' | 'error';
	error?: string;
	landingPageHtml?: string;
}

interface SignalListResponse {
	signals: StoredSignal[];
	total: number;
}

interface UseAPIResponse {
	data: SignalListResponse | undefined;
	isLoading: boolean;
	error: Error | null;
	refetch: () => Promise<void>;
}

// Signal type colors
const SIGNAL_COLORS: Record<string, string> = {
	funding: 'bg-green-900 border-green-500 text-green-400',
	leadership_change: 'bg-purple-900 border-purple-500 text-purple-400',
	product_launch: 'bg-blue-900 border-blue-500 text-blue-400',
	partnership: 'bg-cyan-900 border-cyan-500 text-cyan-400',
	acquisition: 'bg-orange-900 border-orange-500 text-orange-400',
	expansion: 'bg-teal-900 border-teal-500 text-teal-400',
	hiring_surge: 'bg-lime-900 border-lime-500 text-lime-400',
	layoff: 'bg-red-900 border-red-500 text-red-400',
	award: 'bg-yellow-900 border-yellow-500 text-yellow-400',
};

const STRENGTH_COLORS: Record<string, string> = {
	HIGH: 'text-red-400',
	MEDIUM: 'text-yellow-400',
	LOW: 'text-gray-400',
};

function CopyButton({ text, label }: { text: string; label: string }) {
	const [copied, setCopied] = useState(false);

	const handleCopy = useCallback(async () => {
		await navigator.clipboard.writeText(text);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}, [text]);

	return (
		<button
			onClick={handleCopy}
			className="text-xs px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-gray-400 hover:text-white transition-colors"
			type="button"
		>
			{copied ? 'Copied!' : label}
		</button>
	);
}

function SignalCard({ stored, isExpanded, onToggle }: {
	stored: StoredSignal;
	isExpanded: boolean;
	onToggle: () => void;
}) {
	const { signal, outreach, generatedAt, status } = stored;
	const colorClass = SIGNAL_COLORS[signal.type] || 'bg-gray-900 border-gray-500 text-gray-400';

	return (
		<div className="bg-black border border-gray-800 rounded-lg overflow-hidden">
			{/* Header - Always visible */}
			<button
				onClick={onToggle}
				className="w-full p-4 flex items-center justify-between hover:bg-gray-900/50 transition-colors text-left"
				type="button"
			>
				<div className="flex items-center gap-4">
					<span className={`text-xs px-2 py-1 rounded border ${colorClass}`}>
						{signal.type.replace(/_/g, ' ')}
					</span>
					<div>
						<h3 className="text-white font-medium">{signal.company}</h3>
						<p className="text-gray-400 text-sm line-clamp-1">{signal.summary}</p>
					</div>
				</div>
				<div className="flex items-center gap-4">
					<span className={`text-xs font-medium ${STRENGTH_COLORS[signal.strength]}`}>
						{signal.strength}
					</span>
					<span className="text-gray-500 text-xs">
						{new Date(signal.date).toLocaleDateString()}
					</span>
					<svg
						className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
					</svg>
				</div>
			</button>

			{/* Expanded Content */}
			{isExpanded && (
				<div className="border-t border-gray-800 p-4 space-y-6">
					{status === 'error' ? (
						<div className="bg-red-900/30 border border-red-800 rounded p-4 text-red-400">
							Failed to generate outreach: {stored.error}
						</div>
					) : (
						<>
							{/* Summary */}
							<div>
								<h4 className="text-sm text-gray-400 mb-2 flex items-center justify-between">
									Signal Summary
									<CopyButton text={outreach.summary} label="Copy" />
								</h4>
								<p className="text-white text-sm bg-gray-900 rounded p-3 border border-gray-800">
									{outreach.summary}
								</p>
							</div>

							{/* Email Draft */}
							<div>
								<h4 className="text-sm text-gray-400 mb-2 flex items-center justify-between">
									Email Draft
									<CopyButton text={`Subject: ${outreach.email.subject}\n\n${outreach.email.body}`} label="Copy Email" />
								</h4>
								<div className="bg-gray-900 rounded p-3 border border-gray-800 space-y-2">
									<p className="text-cyan-400 text-sm">
										<span className="text-gray-500">Subject:</span> {outreach.email.subject}
									</p>
									<p className="text-white text-sm whitespace-pre-wrap">{outreach.email.body}</p>
								</div>
							</div>

							{/* Social Posts */}
							<div className="grid grid-cols-2 gap-4">
								<div>
									<h4 className="text-sm text-gray-400 mb-2 flex items-center justify-between">
										LinkedIn
										<CopyButton text={outreach.linkedin} label="Copy" />
									</h4>
									<p className="text-white text-sm bg-gray-900 rounded p-3 border border-gray-800">
										{outreach.linkedin}
									</p>
								</div>
								<div>
									<h4 className="text-sm text-gray-400 mb-2 flex items-center justify-between">
										Twitter/X
										<CopyButton text={outreach.twitter} label="Copy" />
									</h4>
									<p className="text-white text-sm bg-gray-900 rounded p-3 border border-gray-800">
										{outreach.twitter}
									</p>
								</div>
							</div>

							{/* Call Talking Points */}
							<div>
								<h4 className="text-sm text-gray-400 mb-2 flex items-center justify-between">
									Call Talking Points
									<CopyButton text={outreach.callPoints.join('\n')} label="Copy All" />
								</h4>
								<ul className="bg-gray-900 rounded p-3 border border-gray-800 space-y-1">
									{outreach.callPoints.map((point, i) => (
										<li key={`point-${i}`} className="text-white text-sm flex items-start gap-2">
											<span className="text-cyan-400">-</span>
											{point}
										</li>
									))}
								</ul>
							</div>

							{/* Landing Page */}
							{stored.landingPageHtml && (
								<div>
									<h4 className="text-sm text-gray-400 mb-2 flex items-center justify-between">
										Landing Page
										<CopyButton text={`${window.location.origin}/api/landing/${signal.id}`} label="Copy URL" />
									</h4>
									<div className="bg-gradient-to-r from-cyan-900/30 to-purple-900/30 rounded p-4 border border-cyan-800/50">
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-3">
												<div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
													<svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<title>Globe icon</title>
														<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
													</svg>
												</div>
												<div>
													<p className="text-white text-sm font-medium">AI-Generated Landing Page</p>
													<p className="text-gray-400 text-xs">Powered by Agentuity Sandbox + GPT</p>
												</div>
											</div>
											<a
												href={`/api/landing/${signal.id}`}
												target="_blank"
												rel="noopener noreferrer"
												className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
											>
												View Page
												<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<title>External link icon</title>
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
												</svg>
											</a>
										</div>
									</div>
								</div>
							)}

							{/* Metadata */}
							<div className="text-xs text-gray-500 pt-2 border-t border-gray-800 flex items-center justify-between">
								<span>Generated: {new Date(generatedAt).toLocaleString()}</span>
								{stored.landingPageHtml && (
									<span className="text-cyan-400/60">Landing page available</span>
								)}
							</div>
						</>
					)}
				</div>
			)}
		</div>
	);
}

export function App() {
	const [expandedId, setExpandedId] = useState<string | null>(null);

	// Fetch signals
	const { data, isLoading, error, refetch } = useAPI({
		method: 'GET',
		path: '/api/signals',
	}) as unknown as UseAPIResponse;

	// Auto-refresh every 10 seconds
	useEffect(() => {
		const interval = setInterval(() => {
			refetch();
		}, 10000);
		return () => clearInterval(interval);
	}, [refetch]);

	const handleRefresh = useCallback(() => {
		refetch();
	}, [refetch]);

	return (
		<div className="text-white flex font-sans justify-center min-h-screen">
			<div className="flex flex-col gap-4 max-w-4xl p-8 w-full">
				{/* Header */}
				<div className="flex items-center justify-between mb-4">
					<div>
						<h1 className="text-3xl font-light text-white">Outreach Planner</h1>
						<p className="text-gray-400">
							Real-time signal intelligence from{' '}
							<span className="italic font-serif text-cyan-400">Linkt</span>
						</p>
					</div>
					<button
						onClick={handleRefresh}
						className="text-sm px-4 py-2 bg-gray-900 hover:bg-gray-800 rounded border border-gray-700 text-gray-400 hover:text-white transition-colors flex items-center gap-2"
						type="button"
					>
						<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
						</svg>
						Refresh
					</button>
				</div>

				{/* Loading State */}
				{isLoading && (
					<div className="bg-black border border-gray-800 rounded-lg p-8">
						<div className="flex items-center gap-3 text-gray-400">
							<div className="animate-spin h-5 w-5 border-2 border-cyan-500 border-t-transparent rounded-full" />
							<span>Loading signals...</span>
						</div>
					</div>
				)}

				{/* Error State */}
				{error && (
					<div className="bg-red-900/30 border border-red-800 rounded-lg p-4 text-red-400">
						Failed to load signals: {error.message}
					</div>
				)}

				{/* Empty State */}
				{!isLoading && !error && data?.signals.length === 0 && (
					<div className="bg-black border border-gray-800 rounded-lg p-12 text-center">
						<div className="text-gray-500 mb-4">
							<svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 10V3L4 14h7v7l9-11h-7z" />
							</svg>
							<p className="text-lg">No signals yet</p>
							<p className="text-sm mt-2">Waiting for signals from Linkt webhooks...</p>
						</div>
					</div>
				)}

				{/* Signal List */}
				{data?.signals && data.signals.length > 0 && (
					<div className="space-y-3">
						<div className="flex items-center justify-between text-sm text-gray-500">
							<span>{data.total} signal{data.total !== 1 ? 's' : ''}</span>
							<span>Click to expand</span>
						</div>
						{data.signals.map((stored) => (
							<SignalCard
								key={stored.signal.id}
								stored={stored}
								isExpanded={expandedId === stored.signal.id}
								onToggle={() => setExpandedId(expandedId === stored.signal.id ? null : stored.signal.id)}
							/>
						))}
					</div>
				)}

				{/* Info Footer */}
				<div className="mt-8 bg-black border border-gray-800 rounded-lg p-6">
					<h3 className="text-white text-sm font-medium mb-3">How it works</h3>
					<div className="grid grid-cols-3 gap-4 text-xs text-gray-400">
						<div className="flex items-start gap-2">
							<span className="text-cyan-400">1.</span>
							<span>Linkt detects business signals (funding, launches, etc.)</span>
						</div>
						<div className="flex items-start gap-2">
							<span className="text-cyan-400">2.</span>
							<span>Webhook sends signals to Agentuity agent</span>
						</div>
						<div className="flex items-start gap-2">
							<span className="text-cyan-400">3.</span>
							<span>AI generates personalized outreach content</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
