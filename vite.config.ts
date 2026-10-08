/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { analyze, HttpError } from "./server/analyze.js";
import { runExtra } from "./server/extras.js";

// Em desenvolvimento, `npm run dev` responde /api/analyze com a mesma lógica
// da função da Vercel, lendo as chaves do arquivo .env.local.
function devApi(env: Record<string, string>): Plugin {
  const routes: Record<string, (body: unknown) => Promise<unknown>> = {
    "/api/analyze": (body) => analyze(body, env, "dev"),
    "/api/extra": async (body) => ({ result: await runExtra(body, env, "dev") }),
  };
  return {
    name: "dev-api",
    configureServer(server) {
      for (const [path, run] of Object.entries(routes)) {
        server.middlewares.use(path, (req, res) => {
          let raw = "";
          req.on("data", (chunk) => (raw += chunk));
          req.on("end", async () => {
            res.setHeader("Content-Type", "application/json");
            try {
              res.end(JSON.stringify(await run(JSON.parse(raw || "{}"))));
            } catch (err) {
              res.statusCode = err instanceof HttpError ? err.status : 500;
              res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Erro" }));
            }
          });
        });
      }
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), devApi(loadEnv(mode, process.cwd(), ""))],
  test: { environment: "node" },
}));
