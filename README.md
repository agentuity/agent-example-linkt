# Linkt Outreach Planner

An AI-powered outreach content generator that receives business signals from [Linkt](https://linkt.ai) and automatically creates personalized sales and marketing content.

## How It Works

```
Linkt Webhook
  -> POST /api/webhook/linkt
    -> Fetch Signals (Linkt API)
      -> Fetch Entities (Linkt API)
        -> Generate Outreach (GPT-5-mini)
          -> Generate Landing Page (OpenCode Sandbox)
            -> Store in KV
              -> React Frontend + GET /api/landing/:id
```

1. **Linkt** detects business signals (funding rounds, leadership changes, product launches, etc.)
2. **Webhook** sends a run completion payload with signal IDs
3. **Agent** fetches full signal + entity data from the Linkt API
4. **AI** generates outreach content and a landing page per signal
5. **Frontend** lists signals, and the landing page is served via `/api/landing/:id`

## Project Structure

```
src/
├── agent/
│   └── outreach-planner/
│       ├── agent.ts              # Main agent - orchestration
│       ├── generators/           # AI content generation
│       │   ├── outreach.ts       # LLM outreach content
│       │   └── landing-page.ts   # OpenCode sandbox landing pages
│       ├── services/             # External integrations
│       │   ├── linkt.ts          # Linkt client + signal/entity fetching
│       │   └── index.ts
│       ├── types.ts              # TypeScript types
│       └── index.ts              # Re-exports
├── api/
│   └── index.ts                  # REST API routes
└── web/
    ├── App.tsx                   # React frontend
    ├── App.css                   # Tailwind styles
    └── frontend.tsx              # React entry point
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/webhook/linkt` | Receive signals from Linkt (returns immediately, processes in background) |
| GET | `/api/landing/:id` | Serve the generated landing page HTML for a signal |
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

Real Linkt webhook payload example:

```json
{
  "event_type": "run.signal.completed",
  "timestamp": "2026-01-29T19:49:43.203388+00:00",
  "data": {
    "run_id": "697bb7aee364055d5a96e7e9",
    "run_name": "signal Run",
    "icp_name": "Example: B2B SaaS Companies + Sales Leaders",
    "icp_id": "697adf6304e972a60551bcd4",
    "user_email": "jack+staging-1@linkt.ai",
    "user_first_name": "Jack",
    "started_at": "2026-01-29T19:41:08.830555+00:00",
    "ended_at": "2026-01-29T19:49:43.200506+00:00",
    "duration_seconds": 514.369951,
    "duration_formatted": "8 minutes",
    "credits_used": 12.3,
    "error_message": null,
    "resources": {
      "entities_created": [],
      "entities_updated": [],
      "signals_created": [
        "697bb9bb5082609bb18d609a",
        "697bb9bb5082609bb18d6099",
        "697bb9bb5082609bb18d6098"
      ]
    },
    "total_signals": 3,
    "signal_breakdown": {
      "other": 3
    }
  }
}
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
| `LINKT_API_KEY` | Linkt API key for fetching signals |
| `LINKT_ENVIRONMENT` | Optional: `staging` or `production` (default: `staging`) |

## Tech Stack

- **Runtime**: [Bun](https://bun.sh)
- **Framework**: [Agentuity](https://agentuity.dev)
- **AI**: OpenAI GPT-5-mini
- **Frontend**: React 19 + Tailwind CSS
- **Storage**: Agentuity KV
