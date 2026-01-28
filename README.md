# Linkt Outreach Planner

An AI-powered outreach content generator that receives business signals from [Linkt](https://linkt.ai) and automatically creates personalized sales and marketing content.

## How It Works

```
Linkt Webhook  -->  POST /api/webhook/linkt  -->  AI Agent (GPT-5-mini)
                                                       |
                                                       v
                                             Generate Outreach:
                                             - Email draft
                                             - LinkedIn post
                                             - Twitter/X post
                                             - Call talking points
                                                       |
                                                       v
                                                Store in KV  -->  React Frontend
```

1. **Linkt** detects business signals (funding rounds, leadership changes, product launches, etc.)
2. **Webhook** sends signal data to this Agentuity agent
3. **AI Agent** generates personalized outreach content for each signal
4. **Frontend** displays signals with expandable cards showing all generated content

## Project Structure

```
src/
├── agent/
│   └── outreach-planner/
│       ├── agent.ts        # Main agent - receives signals, stores to KV
│       ├── generator.ts    # LLM outreach generation (GPT-5-mini)
│       ├── types.ts        # TypeScript types
│       └── index.ts        # Re-exports
├── api/
│   └── index.ts            # REST API routes
└── web/
    ├── App.tsx             # React frontend
    ├── App.css             # Tailwind styles
    └── frontend.tsx        # React entry point
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/webhook/linkt` | Receive signals from Linkt (returns immediately, processes in background) |
| GET | `/api/signals` | List all stored signals with outreach content |
| GET | `/api/signals/:id` | Get a specific signal |
| POST | `/api/signals/:id/regenerate` | Regenerate outreach for a signal |
| DELETE | `/api/signals/:id` | Delete a signal |
| GET | `/api/health` | Health check |

## Development

```bash
# Install dependencies
bun install

# Start development server
bun run dev

# Open the frontend
open http://localhost:3500
```

## Testing the Webhook

Send a test signal:

```bash
curl -X POST http://localhost:3500/api/webhook/linkt \
  -H "Content-Type: application/json" \
  -d '{
    "signal": {
      "id": "sig_001",
      "type": "funding",
      "summary": "Acme Corp raised $10M Series A from Sequoia",
      "company": "Acme Corp",
      "strength": "HIGH",
      "date": "2026-01-28"
    }
  }'
```

View stored signals:

```bash
curl http://localhost:3500/api/signals
```

## Signal Types

The agent handles these signal types from Linkt:

- `funding` - Funding rounds, investments
- `leadership_change` - New executives, departures
- `product_launch` - New products, features
- `partnership` - Strategic partnerships
- `acquisition` - M&A activity
- `expansion` - Geographic or market expansion
- `hiring_surge` - Significant hiring activity
- `layoff` - Workforce reductions
- `award` - Industry awards, recognition

## Generated Outreach

For each signal, the AI generates:

- **Email Draft** - Subject line + personalized body (2-3 paragraphs)
- **LinkedIn Post** - Thought-leadership style (2-3 sentences)
- **Twitter/X Post** - Punchy, under 280 chars
- **Call Talking Points** - 3 conversation starters for sales calls
- **Summary** - Quick signal overview

## Deployment

```bash
# Build the project
bun run build

# Deploy to Agentuity cloud
bun run deploy
```

After deploying, configure Linkt to send webhooks to:
```
https://your-project.agentuity.cloud/api/webhook/linkt
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key for GPT-5-mini |

## Tech Stack

- **Runtime**: [Bun](https://bun.sh)
- **Framework**: [Agentuity](https://agentuity.dev)
- **AI**: OpenAI GPT-5-mini
- **Frontend**: React 19 + Tailwind CSS
- **Storage**: Agentuity KV
