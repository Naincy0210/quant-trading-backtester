import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Lazy initialization of GoogleGenAI Client
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required by the server. Please add it to Secrets setting in AI Studio.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  // API - Server health verification
  app.get("/api/health", (req, res) => {
    res.json({ status: "online", timestamp: new Date().toISOString() });
  });

  // API - Strategy advisor powered by Gemini API
  app.post("/api/gemini/advisor", async (req, res) => {
    try {
      const { prompt, context } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "Missing prompt parameter." });
      }

      // Initialize client lazily and safely
      const ai = getGeminiClient();

      // Build context information to feed the LLM
      const strategyDesc = context 
        ? `
Active trading environment parameters:
- Stock Ticker: ${context.symbol}
- Strategy Model: ${context.strategyType}
- Configuration: ${JSON.stringify(context.params)}
- Backtest Return on Capital: ${context.metrics?.percentageReturn}%
- Maximum Drawdown: ${context.metrics?.maxDrawdown}%
- Win Rate: ${context.metrics?.winRate}%
- Total Trades: ${context.metrics?.totalTrades}
- Robustness Score achieved: ${context.metrics?.robustnessScore} / 100
`
        : "No active trading model configured yet.";

      const systemInstruction = `
You are an expert Quantitative Developer and Trading Strategy Advisor helping candidates prepare for a rigorous quantitative dev recruitment process.
Your job is to provide honest, highly professional, and mathematically sound coaching inspired by the Take-Home Assignment.

Keep your tone professional, authoritative yet encouraging, clear, and focused on visual styling design ideas. Keep descriptions human and literal.
Always structure your answers with elegant formatting (using bolding, scannable structural headers, and clear lists, but WITHOUT redundant markdown symbols outside headings).
Help the candidate understand concepts like Walk-Forward Analysis (WFA), Parameter Overfitting, Curve-fitting, and local robust risk bracket bounds (Stop Loss and Take Profit).
Never refer to internal paths or code files unless requested. Be deeply helpful and provide complete explanations.
`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `${systemInstruction}\n\nContext:\n${strategyDesc}\n\nCandidate Question/Action:\n${prompt}`,
      });

      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Gemini Advisor API Error:", error);
      res.status(500).json({ 
        error: error.message || "An error occurred while calling the Gemini API.",
        details: "Ensure you have entered a valid GEMINI_API_KEY in Settings > Secrets."
      });
    }
  });

  // Vite development middleware versus production assets
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // SPA routing fallback (using * for Express v4)
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server standing by on port ${PORT}`);
  });
}

startServer();
