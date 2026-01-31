# Agent Guidelines: Linkt Outreach Planner

## Project Overview

This is an **Agentuity agent** that integrates with [Linkt](https://linkt.ai) to generate AI-powered sales/marketing outreach content and landing pages from business signals.

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
│       ├── generator.ts              # LLM outreach content generation
│       ├── landing-generator.ts      # OpenCode sandbox landing page generation
│       ├── types.ts                  # TypeScript interfaces
│       └── index.ts                  # Re-exports
├── api/
│   └── index.ts                      # REST API routes
└── web/
    ├── App.tsx                       # React frontend
    ├── App.css                       # Tailwind styles
    └── frontend.tsx                  # React entry point
```

## Key Features

### 1. Outreach Content Generation

Uses OpenAI's `gpt-5-mini` model to generate:
- Email subject/body
- LinkedIn post
- Twitter post
- Sales call talking points
- Signal summary

### 2. Landing Page Generation

Uses **Agentuity Sandbox** with **OpenCode** to generate custom HTML landing pages for each signal.

**How it works:**
1. Creates an interactive sandbox with `opencode:latest` runtime
2. Executes OpenCode with a prompt to generate an HTML landing page
3. Polls for the output file to be created
4. Reads the HTML content and stores it with the signal

**Endpoint**: `GET /api/landing/:id` serves the generated HTML

## Key Patterns

### Webhook Processing

The webhook endpoint processes signals synchronously:

```typescript
api.post('/webhook/linkt', async (c) => {
  const data = await c.req.json();
  const result = await outreachPlanner.run(data);
  return c.json({ received: true, result });
});
```

### KV Storage

Signals are stored in the `outreach-planner` KV namespace:
- `signal:index` - Array of signal IDs
- `signal:{id}` - Individual signal with outreach content and landing page HTML

Access in agents:
```typescript
await ctx.kv.set(namespace, key, value);
const result = await ctx.kv.get<Type>(namespace, key);
```

### Sandbox Usage (Landing Page Generation)

Uses `ctx.sandbox.create()` for interactive sandbox execution:

```typescript
const sandbox = await ctx.sandbox.create({
  runtime: 'opencode:latest',
  network: { enabled: true },
  resources: { memory: '2Gi', cpu: '2000m' },
  timeout: { execution: '5m', idle: '5m' },
});

// Execute command (queues and returns immediately)
await sandbox.execute({
  command: ['opencode', 'run', prompt],
  timeout: '5m',
});

// Poll for output file
const fileStream = await sandbox.readFile('/home/agentuity/output.html');

// Cleanup
await sandbox.destroy();
```

**Note**: `sandbox.run()` has a bug where stdout/stderr are not captured (SDK #795). Use `sandbox.create()` with file-based output as a workaround.

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

## Known Issues & Workarounds

### SDK #795: sandbox.run() stdout bug

`sandbox.run()` returns empty stdout/stderr even on successful execution. **Workaround**: Use `sandbox.create()` + `sandbox.execute()` + polling + `sandbox.readFile()`.

### Route Generator Bug

The route generator imports `../agent/outreach-planner.js` but the agent is in a subfolder. **Workaround**: `src/agent/outreach-planner.ts` is a barrel file that re-exports from `./outreach-planner/agent`.

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

View landing page:
```bash
curl http://localhost:3500/api/landing/sig_test
```

## Environment

- **Runtime**: Bun
- **LLM**: OpenAI (requires `OPENAI_API_KEY`)
- **Storage**: Agentuity KV
- **Sandbox**: Agentuity Sandbox with `opencode:latest` runtime

## Dependencies

- `@agentuity/runtime` - Agentuity agent runtime
- `@opencode-ai/sdk` - OpenCode SDK (installed but not directly used yet)
- `openai` - OpenAI API client

## References

- [Agentuity CLI AGENTS.md](./node_modules/@agentuity/cli/AGENTS.md)
- [Agentuity Docs](https://agentuity.dev)
- [OpenCode SDK Docs](https://opencode.ai/docs/sdk/)
