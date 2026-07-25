/**
 * Generated from creative-int/webs manifests/mcp-client-connect.json.
 * Source SHA-256: 452fe978ad99c476d32983a9cf947d266ffd6ff8234d88f022a25992ff9e9e80
 * Run `pnpm sync:webs-connect -- --source <manifest>`; do not edit by hand.
 */
export const websConnect = {
  "sourceDigest": "452fe978ad99c476d32983a9cf947d266ffd6ff8234d88f022a25992ff9e9e80",
  "sourcePath": "creative-int/webs:manifests/mcp-client-connect.json",
  "generatedFrom": "apps/app/src/lib/mcp-client-config.ts",
  "server": {
    "name": "webs",
    "transport": "streamable-http",
    "url": "https://webs.creative-int.com/mcp"
  },
  "tools": [
    "readiness",
    "save",
    "recall",
    "context",
    "ask",
    "watch",
    "run"
  ],
  "clients": [
    {
      "detail": "~/.codex/config.toml",
      "docsUrl": "https://developers.openai.com/codex/mcp/",
      "id": "codex",
      "label": "Codex",
      "value": "[mcp_servers.webs]\nurl = \"https://webs.creative-int.com/mcp\"",
      "inlineValue": "[mcp_servers.webs]\nurl = \"https://webs.creative-int.com/mcp\"\nhttp_headers = { Authorization = \"Bearer __WEBS_API_TOKEN__\" }"
    },
    {
      "detail": "one terminal command",
      "docsUrl": "https://docs.anthropic.com/en/docs/claude-code/mcp",
      "id": "claude",
      "label": "Claude Code",
      "value": "claude mcp add --scope user --transport http webs 'https://webs.creative-int.com/mcp'",
      "inlineValue": "claude mcp add --scope user --transport http webs 'https://webs.creative-int.com/mcp' --header 'Authorization: Bearer __WEBS_API_TOKEN__'"
    },
    {
      "detail": ".cursor/mcp.json",
      "docsUrl": "https://docs.cursor.com/docs/mcp",
      "id": "cursor",
      "label": "Cursor",
      "value": "{\n  \"mcpServers\": {\n    \"webs\": {\n      \"type\": \"http\",\n      \"url\": \"https://webs.creative-int.com/mcp\"\n    }\n  }\n}",
      "inlineValue": "{\n  \"mcpServers\": {\n    \"webs\": {\n      \"headers\": {\n        \"Authorization\": \"Bearer __WEBS_API_TOKEN__\"\n      },\n      \"type\": \"http\",\n      \"url\": \"https://webs.creative-int.com/mcp\"\n    }\n  }\n}"
    },
    {
      "detail": "~/.codeium/mcp_config.json",
      "docsUrl": "https://docs.devin.ai/windsurf/plugins/cascade/mcp",
      "id": "windsurf",
      "label": "Windsurf",
      "value": "{\n  \"mcpServers\": {\n    \"webs\": {\n      \"serverUrl\": \"https://webs.creative-int.com/mcp\"\n    }\n  }\n}",
      "inlineValue": "{\n  \"mcpServers\": {\n    \"webs\": {\n      \"headers\": {\n        \"Authorization\": \"Bearer __WEBS_API_TOKEN__\"\n      },\n      \"serverUrl\": \"https://webs.creative-int.com/mcp\"\n    }\n  }\n}"
    },
    {
      "detail": ".vscode/mcp.json",
      "docsUrl": "https://code.visualstudio.com/docs/agents/reference/mcp-configuration",
      "id": "vscode",
      "label": "VS Code",
      "value": "{\n  \"servers\": {\n    \"webs\": {\n      \"type\": \"http\",\n      \"url\": \"https://webs.creative-int.com/mcp\"\n    }\n  }\n}",
      "inlineValue": "{\n  \"servers\": {\n    \"webs\": {\n      \"headers\": {\n        \"Authorization\": \"Bearer __WEBS_API_TOKEN__\"\n      },\n      \"type\": \"http\",\n      \"url\": \"https://webs.creative-int.com/mcp\"\n    }\n  }\n}"
    },
    {
      "detail": "Streamable HTTP initialize",
      "docsUrl": "https://modelcontextprotocol.io/specification/2025-06-18/basic/transports",
      "id": "generic",
      "label": "Any MCP client",
      "value": "curl --fail-with-body --silent --show-error 'https://webs.creative-int.com/mcp' \\\n  --request POST \\\n  --header 'Accept: application/json, text/event-stream' \\\n  --header 'Content-Type: application/json' \\\n  --header \"Authorization: Bearer $WEBS_API_TOKEN\" \\\n  --data '{\"id\":1,\"jsonrpc\":\"2.0\",\"method\":\"initialize\",\"params\":{\"capabilities\":{},\"clientInfo\":{\"name\":\"webs-generic-client\",\"version\":\"1.0.0\"},\"protocolVersion\":\"2025-06-18\"}}'",
      "inlineValue": "curl --fail-with-body --silent --show-error 'https://webs.creative-int.com/mcp' \\\n  --request POST \\\n  --header 'Accept: application/json, text/event-stream' \\\n  --header 'Content-Type: application/json' \\\n  --header 'Authorization: Bearer __WEBS_API_TOKEN__' \\\n  --data '{\"id\":1,\"jsonrpc\":\"2.0\",\"method\":\"initialize\",\"params\":{\"capabilities\":{},\"clientInfo\":{\"name\":\"webs-generic-client\",\"version\":\"1.0.0\"},\"protocolVersion\":\"2025-06-18\"}}'"
    }
  ]
} as const;
