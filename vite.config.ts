/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { analyze, HttpError } from "./server/analyze.js";

// Em desenvolvimento, `npm run dev` responde /api/analyze com a mesma lógica
// da função da Vercel, lendo as chaves do arquivo .env.local.
function devApi(env: Record<string, string>): Plugin {
  return {
    name: "dev-api",
    configureServer(server) {
      server.middlewares.use("/api/analyze", (req, res) => {
        let raw = "";
        req.on("data", (chunk) => (raw += chunk));
        req.on("end", async () => {
          res.setHeader("Content-Type", "application/json");
          try {
            const body = JSON.parse(raw || "{}");
            res.end(JSON.stringify(await analyze(body, env, "dev")));
          } catch (err) {
            res.statusCode = err instanceof HttpError ? err.status : 500;
            res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Erro" }));
          }
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), devApi(loadEnv(mode, process.cwd(), ""))],
  test: { environment: "node" },
}));
