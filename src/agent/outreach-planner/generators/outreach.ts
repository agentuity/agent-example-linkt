/** Generate personalized outreach content using GPT-5-mini. */

import OpenAI from 'openai';
import type { LinktEntity, Outreach, Signal } from '../types';

const openai = new OpenAI();

export async function generateOutreach(
	signal: Signal,
	entities: LinktEntity[] = []
): Promise<Outreach> {
	const entityContext = buildEntityContext(entities);
	const ctaGuidance = buildCtaGuidance(entities);
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
- Be relevant and timely, not overly salesy
- Email should have a clear call-to-action tailored to the entity context
- LinkedIn should be thought-leadership style
- Twitter should be concise and engaging
- Call points should be conversation starters for sales calls

CTA guidance:
${ctaGuidance}`;

	const userPrompt = `Generate outreach content for this signal:

Company: ${signal.company}
Signal Type: ${signal.type}
Strength: ${signal.strength}
Date: ${signal.date}
 Summary: ${signal.summary}
 ${signal.source ? `Source: ${signal.source}` : ''}
 ${signal.details ? `Additional Details: ${JSON.stringify(signal.details)}` : ''}

 ${entityContext}`;

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

function buildEntityContext(entities: LinktEntity[]): string {
	if (!entities.length) {
		return 'Entity Context: None provided.';
	}

	const company = findCompanyEntity(entities);
	const contact = findPersonEntity(entities);

	const companyName = toText(company?.data?.name) ?? toText(company?.data?.company_name);
	const companyIndustry = toText(company?.data?.industry);
	const companyLocation = toText(company?.data?.location) ?? toText(company?.data?.headquarters);
	const companySize = toText(company?.data?.size) ?? toText(company?.data?.employees);
	const companyWebsite = toText(company?.data?.website) ?? toText(company?.data?.company_domain);
	const companyDescription = toText(company?.data?.description);

	const contactName = toText(contact?.data?.name);
	const contactTitle = toText(contact?.data?.title);
	const contactEmail = toText(contact?.data?.email);
	const contactLinkedIn = toText(contact?.data?.linkedin_url);
	const contactCompany = toText(contact?.data?.company_name);

	return `Entity Context:
- Company Name: ${companyName ?? contactCompany ?? 'Unknown'}
- Company Industry: ${companyIndustry ?? 'Unknown'}
- Company Size: ${companySize ?? 'Unknown'}
- Company Location: ${companyLocation ?? 'Unknown'}
- Company Website: ${companyWebsite ?? 'Unknown'}
- Company Description: ${companyDescription ?? 'Unknown'}
- Primary Contact: ${contactName ?? 'Unknown'}
- Contact Title: ${contactTitle ?? 'Unknown'}
- Contact Email: ${contactEmail ?? 'Unknown'}
- Contact LinkedIn: ${contactLinkedIn ?? 'Unknown'}`;
}

function buildCtaGuidance(entities: LinktEntity[]): string {
	const contact = findPersonEntity(entities);
	const company = findCompanyEntity(entities);
	const contactName = toText(contact?.data?.name);
	const companyName =
		toText(company?.data?.name) ?? toText(company?.data?.company_name) ?? toText(contact?.data?.company_name);

	if (contact) {
		return `Target a direct conversation with ${contactName ?? 'the contact'} about ${companyName ?? 'their team'}'s current priorities. Offer a short intro call and a tailored insight.`;
	}

	if (company) {
		return `Target a company-level CTA for ${companyName ?? 'the team'} such as requesting a tailored assessment, benchmark, or strategy session.`;
	}

	return 'Use a general CTA asking if they want to learn more or see a tailored plan.';
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
