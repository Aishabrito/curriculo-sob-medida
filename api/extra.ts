import type { VercelRequest, VercelResponse } from "@vercel/node";
import { HttpError } from "../server/ai.js";
import { runExtra } from "../server/extras.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Use POST." });
  }
  const forwarded = req.headers["x-forwarded-for"];
  const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim() || "anon";
  try {
    return res.status(200).json({ result: await runExtra(req.body, process.env, ip) });
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    console.error(err);
    return res.status(500).json({ error: "Algo deu errado do nosso lado. Tente de novo." });
  }
}
