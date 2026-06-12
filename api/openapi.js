export default function handler(req, res) {
  const host = req.headers.host;
  const baseUrl = `https://${host}`;

  const schema = {
    openapi: "3.1.0",
    info: {
      title: "Token Insight API",
      version: "1.0.0",
      description: "Token insight API for GPTs Actions. Supports health check, token summary, and monitored wallet balances."
    },
    servers: [
      {
        url: baseUrl
      }
    ],
    paths: {
      "/api": {
        get: {
          operationId: "tokenInsight",
          summary: "Query token insight data",
          description: "Use action=health for health check, action=summary for token summary, or action=balances for monitored wallet balances.",
          parameters: [
            {
              name: "action",
              in: "query",
              required: true,
              schema: {
                type: "string",
                enum: ["health", "summary", "balances"]
              },
              description: "Action to perform."
            },
            {
              name: "symbol",
              in: "query",
              required: false,
              schema: {
                type: "string",
                default: "ALLO"
              },
              description: "Token symbol. Currently supports ALLO."
            }
          ],
          responses: {
            "200": {
              description: "Successful response",
              content: {
                "application/json": {
                  schema: {
                    type: "object"
                  }
                }
              }
            },
            "404": {
              description: "Unknown action or token"
            },
            "500": {
              description: "Server error"
            }
          }
        }
      }
    }
  };

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");
  res.status(200).json(schema);
}
