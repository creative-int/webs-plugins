curl --fail-with-body --silent --show-error 'https://webs.creative-int.com/mcp' \
  --request POST \
  --header 'Accept: application/json, text/event-stream' \
  --header 'Content-Type: application/json' \
  --header "Authorization: Bearer $WEBS_API_TOKEN" \
  --data '{"id":1,"jsonrpc":"2.0","method":"initialize","params":{"capabilities":{},"clientInfo":{"name":"webs-generic-client","version":"1.0.0"},"protocolVersion":"2025-06-18"}}'
