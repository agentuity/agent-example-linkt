# Agent Guidelines: Linkt Outreach Planner

## Project Overview

This is an **Agentuity agent** that integrates with [Linkt](https://linkt.ai) to generate AI-powered sales/marketing outreach content from business signals.

**Architecture**: Webhook-driven (Linkt pushes signals to us)

## Commands

| Command | Description |
|---------|-------------|
| `bun run dev` | Start development server (http://localhost:3500) |
| `bun run build` | Build for production |
| `bun run typecheck` | Run TypeScript type checking |
| `bun run deploy` | Deploy to Agentuity cloud |

## Project Structure

```
src/
├── agent/
│   ├── outreach-planner.ts           # Barrel export (SDK workaround)
│   └── outreach-planner/
│       ├── agent.ts                  # Main agent handler
│       ├── generator.ts              # LLM content generation
│       ├── types.ts                  # TypeScript interfaces
│       └── index.ts                  # Re-exports
├── api/
│   └── index.ts                      # REST API routes
└── web/
    ├── App.tsx                       # React frontend
    ├── App.css                       # Tailwind styles
    └── frontend.tsx                  # React entry point
```

## Key Patterns

### Webhook Processing

The webhook endpoint uses `waitUntil` for background processing:

```typescript
api.post('/webhook/linkt', async (c) => {
  const data = await c.req.json();
  
  // Process in background, respond immediately
  c.waitUntil(async () => {
    await outreachPlanner.run(data);
  });
  
  return c.json({ received: true });
});
```

### KV Storage

Signals are stored in the `outreach-planner` KV namespace:
- `signal:index` - Array of signal IDs
- `signal:{id}` - Individual signal with outreach content

Access in agents:
```typescript
await ctx.kv.set(namespace, key, value);
const result = await ctx.kv.get<Type>(namespace, key);
```

Access in routes:
```typescript
await c.var.kv.set(namespace, key, value);
const result = await c.var.kv.get<Type>(namespace, key);
```

### LLM Generation

Uses OpenAI's `gpt-5-mini` model with JSON output format:

```typescript
const response = await openai.chat.completions.create({
  model: 'gpt-5-mini',
  messages: [...],
  response_format: { type: 'json_object' },
});
```

**Note**: `gpt-5-mini` does not support the `temperature` parameter.

## Known Workarounds

### Route Generator Bug

The route generator imports `../agent/outreach-planner.js` but the agent is in a subfolder. Workaround: `src/agent/outreach-planner.ts` is a barrel file that re-exports from `./outreach-planner/agent`.

### Output Schema Bug

Cannot define output schema as a const before passing to `createAgent`. Must inline it:

```typescript
// This works
createAgent('name', {
  schema: {
    output: s.object({ ... })  // Inline
  }
});

// This breaks
const OutputSchema = s.object({ ... });
createAgent('name', {
  schema: { output: OutputSchema }  // Doesn't work
});
```

## Testing

Send a test webhook:

```bash
curl -X POST http://localhost:3500/api/webhook/linkt \
  -H "Content-Type: application/json" \
  -d '{
    "signal": {
      "id": "sig_test",
      "type": "funding",
      "summary": "Test company raised $5M",
      "company": "Test Corp",
      "strength": "HIGH",
      "date": "2026-01-28"
    }
  }'
```

Check signals:
```bash
curl http://localhost:3500/api/signals
```

## Environment

- **Runtime**: Bun
- **LLM**: OpenAI (requires `OPENAI_API_KEY`)
- **Storage**: Agentuity KV

## References

- [Agentuity CLI AGENTS.md](./node_modules/@agentuity/cli/AGENTS.md)
- [Agentuity Docs](https://agentuity.dev)
