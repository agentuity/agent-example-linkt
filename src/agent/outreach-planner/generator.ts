/**
 * Outreach Generator - LLM-powered content generation
 */

import OpenAI from 'openai';
import type { Signal, Outreach } from './types';

const openai = new OpenAI();

/**
 * Generate all outreach content for a signal
 */
export async function generateOutreach(signal: Signal): Promise<Outreach> {
	const systemPrompt = `You are an expert B2B sales and marketing professional. Generate outreach content based on a business signal (news about a company).

Your output must be JSON with this exact structure:
{
  "email": {
    "subject": "compelling email subject line",
    "body": "personalized email body (2-3 paragraphs, professional tone)"
  },
  "linkedin": "LinkedIn post (2-3 sentences, professional but engaging)",
  "twitter": "Tweet (under 280 chars, punchy and relevant)",
  "callPoints": ["talking point 1", "talking point 2", "talking point 3"],
  "summary": "2-3 sentence summary of the signal and why it matters"
}

Guidelines:
- Reference the specific signal/news naturally
- Be relevant and timely, not salesy
- Email should have a clear call-to-action
- LinkedIn should be thought-leadership style
- Twitter should be concise and engaging
- Call points should be conversation starters for sales calls`;

	const userPrompt = `Generate outreach content for this signal:

Company: ${signal.company}
Signal Type: ${signal.type}
Strength: ${signal.strength}
Date: ${signal.date}
Summary: ${signal.summary}
${signal.source ? `Source: ${signal.source}` : ''}
${signal.details ? `Additional Details: ${JSON.stringify(signal.details)}` : ''}`;

	const response = await openai.chat.completions.create({
		model: 'gpt-5-mini',
		messages: [
			{ role: 'system', content: systemPrompt },
			{ role: 'user', content: userPrompt },
		],
		response_format: { type: 'json_object' },
	});

	const content = response.choices[0]?.message?.content;
	if (!content) {
		throw new Error('No response from LLM');
	}

	const outreach = JSON.parse(content) as Outreach;

	return {
		email: outreach.email ?? { subject: '', body: '' },
		linkedin: outreach.linkedin ?? '',
		twitter: outreach.twitter ?? '',
		callPoints: outreach.callPoints ?? [],
		summary: outreach.summary ?? '',
	};
}
