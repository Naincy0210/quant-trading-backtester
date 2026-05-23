import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  LineChart as ChartIcon, 
  Percent, 
  ShieldAlert, 
  CheckCircle2, 
  Play, 
  Sliders, 
  Download, 
  Copy, 
  Sparkles, 
  BookOpen, 
  ArrowUpDown, 
  History, 
  UserCheck, 
  RefreshCw, 
  FileCode, 
  UploadCloud, 
  AlertCircle, 
  Terminal,
  Activity,
  Heart,
  HelpCircle,
  Award,
  Lock,
  Compass
} from "lucide-react";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  Legend, 
  LineChart, 
  Line 
} from "recharts";

import { Candle, StrategyType, RiskConfig, BacktestResult, RobustnessScore, WfaSegment, ChatMessage } from "./types";
import { generateHistoricalCandles, LISTED_TICKERS, parseYFinanceCSV } from "./data/candles";
import { runBacktest, runWalkForwardAnalysis, calculateRobustness } from "./utils/backtester";
import { generateBacktestPy, generateWalkForwardPy, generateReadmeMd, generateRequirements } from "./utils/codeExporter";

export default function App() {
  // ==========================================
  // STATE MANAGEMENT
  // ==========================================
  const [selectedTicker, setSelectedTicker] = useState<string>("AAPL");
  const [customCandles, setCustomCandles] = useState<Candle[] | null>(null);
  const [customFileName, setCustomFileName] = useState<string>("");
  const [strategyType, setStrategyType] = useState<StrategyType>("SMA");
  const [activeTab, setActiveTab] = useState<string>("backtest");

  // Strategy Params
  const [smaFast, setSmaFast] = useState<number>(10);
  const [smaSlow, setSmaSlow] = useState<number>(50);
  const [rsiPeriod, setRsiPeriod] = useState<number>(14);
  const [rsiOversold, setRsiOversold] = useState<number>(30);
  const [rsiOverbought, setRsiOverbought] = useState<number>(70);
  const [macdFast, setMacdFast] = useState<number>(12);
  const [macdSlow, setMacdSlow] = useState<number>(26);
  const [macdSignal, setMacdSignal] = useState<number>(9);
  const [bbPeriod, setBbPeriod] = useState<number>(20);
  const [bbStdDev, setBbStdDev] = useState<number>(2.0);

  // Risk Parameters
  const [startingCapital, setStartingCapital] = useState<number>(100000);
  const [positionSizePct, setPositionSizePct] = useState<number>(100);
  const [stopLossPct, setStopLossPct] = useState<number>(2.5);
  const [takeProfitPct, setTakeProfitPct] = useState<number>(8.0);
  const [commissionPct, setCommissionPct] = useState<number>(0.1);
  const [slippagePct, setSlippagePct] = useState<number>(0.05);

  // Status and CSV drag indicators
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [csvError, setCsvError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      sender: "assistant",
      text: "Hello! I am your AI Quantitative Developer Coach. I can analyze your backtest performance, critique your strategy rules for the take-home assessment, provide ideas to push your Robustness Score above 75, or stage a mock quantitative developer interview! Ask me anything.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
  ]);
  const [chatInput, setChatInput] = useState<string>("");
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Copy Clipboard State
  const [copiedFile, setCopiedFile] = useState<string | null>(null);

  // ==========================================
  // DYNAMIC COMPUTATIONS
  // ==========================================
  const activeCandles = useMemo(() => {
    if (selectedTicker === "CUSTOM" && customCandles) {
      return customCandles;
    }
    return generateHistoricalCandles(selectedTicker);
  }, [selectedTicker, customCandles]);

  const activeParams = useMemo(() => {
    if (strategyType === "SMA") return { fastPeriod: smaFast, slowPeriod: smaSlow };
    if (strategyType === "RSI") return { period: rsiPeriod, oversold: rsiOversold, overbought: rsiOverbought };
    if (strategyType === "MACD") return { fastPeriod: macdFast, slowPeriod: macdSlow, signalPeriod: macdSignal };
    return { period: bbPeriod, stdDev: bbStdDev };
  }, [strategyType, smaFast, smaSlow, rsiPeriod, rsiOversold, rsiOverbought, macdFast, macdSlow, macdSignal, bbPeriod, bbStdDev]);

  const activeRiskConfig = useMemo(() => {
    return {
      startingCapital,
      positionSizePct,
      stopLossPct,
      takeProfitPct,
      commissionPct,
      slippagePct,
    };
  }, [startingCapital, positionSizePct, stopLossPct, takeProfitPct, commissionPct, slippagePct]);

  // Main backtest run
  const backtestResult = useMemo(() => {
    try {
      return runBacktest(activeCandles, strategyType, activeParams, activeRiskConfig);
    } catch (e: any) {
      console.error(e);
      return null;
    }
  }, [activeCandles, strategyType, activeParams, activeRiskConfig]);

  // Walk-forward analysis run
  const wfaSegments = useMemo(() => {
    try {
      return runWalkForwardAnalysis(activeCandles, strategyType, activeRiskConfig);
    } catch (e) {
      console.error("WFA calculation failed: ", e);
      return [];
    }
  }, [activeCandles, strategyType, activeRiskConfig]);

  // Robustness scorecard run
  const robustnessScore = useMemo(() => {
    if (!backtestResult || wfaSegments.length === 0) return null;
    return calculateRobustness(
      backtestResult,
      wfaSegments,
      strategyType,
      activeParams,
      activeCandles,
      activeRiskConfig
    );
  }, [backtestResult, wfaSegments, strategyType, activeParams, activeCandles, activeRiskConfig]);

  // Export files generation
  const exportedFiles: Record<string, string> = useMemo(() => {
    if (!backtestResult || !robustnessScore) return {};
    const assetName = selectedTicker === "CUSTOM" ? "CUSTOM" : selectedTicker;
    return {
      "README.md": generateReadmeMd(assetName, strategyType, activeParams, activeRiskConfig, backtestResult, robustnessScore, wfaSegments),
      "backtest.py": generateBacktestPy(assetName, strategyType, activeParams, activeRiskConfig),
      "walk_forward.py": generateWalkForwardPy(assetName, strategyType, activeParams, activeRiskConfig),
      "requirements.txt": generateRequirements(),
    };
  }, [selectedTicker, strategyType, activeParams, activeRiskConfig, backtestResult, robustnessScore, wfaSegments]);

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isTyping]);

  // ==========================================
  // EVENT HANDLERS
  // ==========================================
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processCSVFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = parseYFinanceCSV(text);
        if (parsed.length < 100) {
          setCsvError("This CSV file contains too few trading candles. Keep at least 100 entries.");
          return;
        }
        setCustomCandles(parsed);
        setCustomFileName(file.name);
        setSelectedTicker("CUSTOM");
        setCsvError("");
      } catch (err: any) {
        setCsvError(err.message || "Failed to parse CSV file. Assure yfinance format.");
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processCSVFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processCSVFile(e.target.files[0]);
    }
  };

  const copyToClipboard = (filename: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedFile(filename);
    setTimeout(() => {
      setCopiedFile(null);
    }, 2000);
  };

  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = customPrompt || chatInput;
    if (!textToSend.trim()) return;

    const userMsg: ChatMessage = {
      id: Math.random().toString(),
      sender: "user",
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    if (!customPrompt) setChatInput("");
    setIsTyping(true);

    try {
      const response = await fetch("/api/gemini/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: textToSend,
          context: {
            symbol: selectedTicker === "CUSTOM" ? "Uploaded Asset" : selectedTicker,
            strategyType,
            params: activeParams,
            metrics: backtestResult ? {
              percentageReturn: backtestResult.percentageReturn.toFixed(1),
              maxDrawdown: backtestResult.maxDrawdown.toFixed(1),
              winRate: backtestResult.winRate.toFixed(1),
              totalTrades: backtestResult.totalTrades,
              robustnessScore: robustnessScore?.totalScore || 0,
            } : null,
          }
        }),
      });

      const data = await response.json();
      setIsTyping(false);

      if (data.error) {
        setChatMessages((prev) => [...prev, {
          id: Math.random().toString(),
          sender: "assistant",
          text: `Error calling Advisor API: ${data.error}. Make sure GEMINI_API_KEY is configured inside Settings > Secrets.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }]);
      } else {
        setChatMessages((prev) => [...prev, {
          id: Math.random().toString(),
          sender: "assistant",
          text: data.text,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }]);
      }
    } catch (err: any) {
      setIsTyping(false);
      setChatMessages((prev) => [...prev, {
        id: Math.random().toString(),
        sender: "assistant",
        text: "Could not contact server API for Gemini. Ensure your server is active and port configured.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }]);
    }
  };

  // Quick preset updates to help push robustness above 75
  const applyRobustPreset = () => {
    if (strategyType === "SMA") {
      setSmaFast(15);
      setSmaSlow(60); // Widens standard gap to capture core trend cleanly
      setStopLossPct(2.0); // Shorter guard
      setTakeProfitPct(12.0); // Allow profits to run
    } else if (strategyType === "RSI") {
      setRsiPeriod(14);
      setRsiOversold(25); // Tightens oversold to buy deep extremes
      setRsiOverbought(75); // Tightens peak bounds
      setStopLossPct(3.0);
      setTakeProfitPct(15.0);
    } else if (strategyType === "MACD") {
      setMacdFast(8);
      setMacdSlow(24);
      setMacdSignal(11);
      setStopLossPct(2.5);
      setTakeProfitPct(10.0);
    } else if (strategyType === "BB") {
      setBbPeriod(22);
      setBbStdDev(2.2); // Avoid noise
      setStopLossPct(2.0);
      setTakeProfitPct(8.0);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-emerald-500 selection:text-slate-900">
      
      {/* HEADER BAR */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-emerald-600 to-indigo-600 p-2.5 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-950/20">
            <Activity className="h-6 w-6 text-emerald-100" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white flex items-center gap-2">
              Quant Trading Backtester <span className="text-xs bg-emerald-950 text-emerald-400 font-normal px-2.5 py-0.5 rounded-full border border-emerald-900/50">Recruitment Workspace</span>
            </h1>
            <p className="text-xs text-slate-400">Algorithmic trading strategy developer take-home assignment validator</p>
          </div>
        </div>

        {/* Deliverable Highlights badge */}
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-1.5 text-xs bg-slate-900 border border-slate-800 px-3.5 py-1.5 rounded-lg text-slate-300">
            <span className="font-medium text-slate-400">API Key status:</span>
            {process.env.GEMINI_API_KEY || (window as any).GEMINI_API_KEY ? (
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Active
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-500">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span> Unset (Using local fallback)
              </span>
            )}
          </div>

          {robustnessScore && (
            <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-semibold shadow-sm ${
              robustnessScore.totalScore >= 75 
                ? "bg-emerald-950/30 text-emerald-400 border-emerald-900" 
                : "bg-amber-950/30 text-amber-500 border-amber-900"
            }`}>
              <Award className="h-4 w-4" />
              Robustness: {robustnessScore.totalScore} / 100 
              <span className="font-extrabold text-[10px] uppercase ml-1 px-1.5 py-0.2 bg-slate-900 rounded border border-current-20">
                {robustnessScore.totalScore >= 75 ? "PASSED (>75)" : "CRITICAL"}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* WORKSPACE CONTENT AREA */}
      <main className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        
        {/* SIDEBAR PARAMETERS PANEL */}
        <aside className="w-full lg:w-[380px] border-r border-slate-900 bg-slate-950/50 overflow-y-auto p-6 flex flex-col gap-6 custom-scrollbar shrink-0">
          
          {/* SECTION 1: ASSET & SOURCE */}
          <div>
            <div className="flex items-center justify-between mb-3 text-xs uppercase font-semibold text-slate-400 tracking-wider">
              <span>1. Asset & Source</span>
              <BookOpen className="h-4 w-4 text-emerald-500" />
            </div>
            
            {/* yfinance file upload drop zone */}
            <div 
              className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all mb-3 ${
                dragActive 
                  ? "border-emerald-500 bg-emerald-950/10" 
                  : "border-slate-800 bg-slate-950 hover:bg-slate-900/50"
              }`}
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadCloud className="mx-auto h-7 w-7 text-slate-400 mb-2" />
              <p className="text-xs font-medium text-white mb-1">Drag yfinance CSV or click</p>
              <p className="text-[10px] text-slate-500">Supports Yahoo Finance direct exports</p>
              <input 
                ref={fileInputRef}
                type="file" 
                accept=".csv"
                className="hidden" 
                onChange={handleFileChange}
              />
            </div>

            {csvError && (
              <div className="bg-red-950/20 border border-red-900/50 text-red-400 text-xs rounded-lg p-2.5 flex items-start gap-2 mb-3">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{csvError}</span>
              </div>
            )}

            {/* Selector list */}
            <div className="grid grid-cols-3 gap-1.5">
              {LISTED_TICKERS.map((t) => (
                <button
                  key={t.symbol}
                  onClick={() => {
                    setSelectedTicker(t.symbol);
                    setCustomCandles(null);
                  }}
                  className={`text-left p-2 rounded-lg border text-xs transition-all ${
                    selectedTicker === t.symbol && !customCandles
                      ? "bg-slate-900 border-emerald-500 text-white shadow shadow-emerald-950/50"
                      : "bg-slate-950 border-slate-900 text-slate-400 hover:border-slate-800"
                  }`}
                >
                  <div className="font-semibold text-white">{t.symbol}</div>
                  <div className="text-[9px] text-slate-500 truncate">{t.name}</div>
                </button>
              ))}

              {customCandles && (
                <button
                  onClick={() => setSelectedTicker("CUSTOM")}
                  className={`col-span-3 text-left p-2.5 rounded-lg border text-xs transition-all flex items-center justify-between ${
                    selectedTicker === "CUSTOM"
                      ? "bg-emerald-950/20 border-emerald-500 text-emerald-400"
                      : "bg-slate-950 border-slate-900 text-slate-400 hover:border-slate-800"
                  }`}
                >
                  <div className="truncate shrink">
                    <div className="font-bold">CUSTOM OVERLAY</div>
                    <div className="text-[10px] text-slate-400 truncate">{customFileName}</div>
                  </div>
                  <span className="text-[9px] bg-emerald-900/60 text-emerald-300 font-medium px-2 py-0.5 rounded whitespace-nowrap">parsed</span>
                </button>
              )}
            </div>
          </div>

          {/* SECTION 2: STRATEGY BUILDER */}
          <div>
            <div className="flex items-center justify-between mb-3 text-xs uppercase font-semibold text-slate-400 tracking-wider">
              <span>2. Strategy Selection</span>
              <Sliders className="h-4 w-4 text-emerald-500" />
            </div>

            <div className="grid grid-cols-4 gap-1.5 mb-4">
              {(["SMA", "RSI", "MACD", "BB"] as StrategyType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setStrategyType(type)}
                  className={`py-2 rounded-lg text-xs font-bold transition-all border ${
                    strategyType === type
                      ? "bg-slate-900 border-emerald-500 text-emerald-400"
                      : "bg-slate-950 border-slate-900 text-slate-400"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            {/* DYNAMIC PARAMETER FIELDS FOR ACTIVE STRATEGY */}
            <div className="bg-slate-900/40 rounded-xl p-4 border border-slate-900 space-y-4">
              
              {strategyType === "SMA" && (
                <>
                  <div>
                    <div className="flex justify-between items-center text-xs mb-1.5">
                      <span className="text-slate-400">Fast SMA Period</span>
                      <span className="font-mono text-emerald-400">{smaFast} days</span>
                    </div>
                    <input 
                      type="range" min="3" max="25" step="1"
                      value={smaFast} onChange={(e) => setSmaFast(Number(e.target.value))}
                      className="w-full accent-emerald-500"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-center text-xs mb-1.5">
                      <span className="text-slate-400">Slow SMA Period</span>
                      <span className="font-mono text-emerald-400">{smaSlow} days</span>
                    </div>
                    <input 
                      type="range" min="30" max="100" step="1"
                      value={smaSlow} onChange={(e) => setSmaSlow(Number(e.target.value))}
                      className="w-full accent-emerald-500"
                    />
                    <div className="text-[10px] text-slate-500 mt-1">
                      Golden Cross when Fast SMA crosses above Slow SMA.
                    </div>
                  </div>
                </>
              )}

              {strategyType === "RSI" && (
                <>
                  <div>
                    <div className="flex justify-between items-center text-xs mb-1.5">
                      <span className="text-slate-400">RSI Period</span>
                      <span className="font-mono text-emerald-400">{rsiPeriod} days</span>
                    </div>
                    <input 
                      type="range" min="5" max="30" step="1"
                      value={rsiPeriod} onChange={(e) => setRsiPeriod(Number(e.target.value))}
                      className="w-full accent-emerald-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3.5">
                    <div>
                      <div className="flex justify-between items-center text-[11px] mb-1">
                        <span className="text-slate-400">Oversold (Buy)</span>
                        <span className="font-mono text-emerald-400">{rsiOversold}</span>
                      </div>
                      <input 
                        type="number" min="15" max="40"
                        value={rsiOversold} onChange={(e) => setRsiOversold(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-center text-white"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between items-center text-[11px] mb-1">
                        <span className="text-slate-400">Overbought (Sell)</span>
                        <span className="font-mono text-emerald-400">{rsiOverbought}</span>
                      </div>
                      <input 
                        type="number" min="60" max="85"
                        value={rsiOverbought} onChange={(e) => setRsiOverbought(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-center text-white"
                      />
                    </div>
                  </div>
                </>
              )}

              {strategyType === "MACD" && (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Fast EMA</label>
                      <input 
                        type="number" min="5" max="20"
                        value={macdFast} onChange={(e) => setMacdFast(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-center text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Slow EMA</label>
                      <input 
                        type="number" min="20" max="40"
                        value={macdSlow} onChange={(e) => setMacdSlow(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-center text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Signal MACD</label>
                      <input 
                        type="number" min="5" max="15"
                        value={macdSignal} onChange={(e) => setMacdSignal(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-center text-white"
                      />
                    </div>
                  </div>
                </>
              )}

              {strategyType === "BB" && (
                <>
                  <div>
                    <div className="flex justify-between items-center text-xs mb-1.5">
                      <span className="text-slate-400">Bollinger Bands Period</span>
                      <span className="font-mono text-emerald-400">{bbPeriod} days</span>
                    </div>
                    <input 
                      type="range" min="10" max="40" step="1"
                      value={bbPeriod} onChange={(e) => setBbPeriod(Number(e.target.value))}
                      className="w-full accent-emerald-500"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-center text-xs mb-1.5">
                      <span className="text-slate-400">Multiplier Standard Devs</span>
                      <span className="font-mono text-emerald-400">{bbStdDev} σ</span>
                    </div>
                    <input 
                      type="range" min="1.0" max="3.0" step="0.1"
                      value={bbStdDev} onChange={(e) => setBbStdDev(Number(e.target.value))}
                      className="w-full accent-emerald-500"
                    />
                  </div>
                </>
              )}

            </div>
          </div>

          {/* SECTION 3: RISK MANAGEMENT */}
          <div>
            <div className="flex items-center justify-between mb-3 text-xs uppercase font-semibold text-slate-400 tracking-wider">
              <span>3. Risk & Slippage</span>
              <ShieldAlert className="h-4 w-4 text-emerald-500" />
            </div>

            <div className="space-y-4 bg-slate-900/40 rounded-xl p-4 border border-slate-900">
              
              {/* Capital and sizing */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Starting Cash</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1.5 text-slate-500 text-xs">$</span>
                    <input 
                      type="number" step="5000" min="5000"
                      value={startingCapital} onChange={(e) => setStartingCapital(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded pl-6 pr-2 py-1 text-xs text-white text-right"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Sizing per Trade</label>
                  <div className="relative">
                    <input 
                      type="number" min="5" max="100" step="5"
                      value={positionSizePct} onChange={(e) => setPositionSizePct(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded pl-2 pr-6 py-1 text-xs text-white text-right"
                    />
                    <span className="absolute right-2.5 top-1.5 text-slate-500 text-xs">%</span>
                  </div>
                </div>
              </div>

              {/* Stop loss and take profit */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Stop Loss (Bracket)</label>
                  <div className="relative">
                    <input 
                      type="number" step="0.5" min="0" max="10"
                      value={stopLossPct} onChange={(e) => setStopLossPct(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded pl-2 pr-6 py-1 text-xs text-white text-right"
                    />
                    <span className="absolute right-2.5 top-1.5 text-slate-500 text-xs">%</span>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Take Profit (Bracket)</label>
                  <div className="relative">
                    <input 
                      type="number" step="0.5" min="0" max="40"
                      value={takeProfitPct} onChange={(e) => setTakeProfitPct(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded pl-2 pr-6 py-1 text-xs text-white text-right"
                    />
                    <span className="absolute right-2.5 top-1.5 text-slate-500 text-xs">%</span>
                  </div>
                </div>
              </div>

              {/* Commission and Slippage */}
              <div className="grid grid-cols-2 gap-3 border-t border-slate-800/60 pt-3">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-0.5">Commissions</label>
                  <div className="relative">
                    <input 
                      type="number" step="0.01" min="0"
                      value={commissionPct} onChange={(e) => setCommissionPct(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded pl-2 pr-6 py-1 text-xs text-white text-right"
                    />
                    <span className="absolute right-2.5 top-1.5 text-slate-500 text-xs">%</span>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-0.5">Price Slippage</label>
                  <div className="relative">
                    <input 
                      type="number" step="0.01" min="0"
                      value={slippagePct} onChange={(e) => setSlippagePct(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded pl-2 pr-6 py-1 text-xs text-white text-right"
                    />
                    <span className="absolute right-2.5 top-1.5 text-slate-500 text-xs">%</span>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* SECTION 4: FORCE OPTIMIZER QUICKLINK */}
          <div className="mt-auto border-t border-slate-900 pt-4">
            <button
              onClick={applyRobustPreset}
              className="w-full bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-slate-900 font-bold py-2.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20"
            >
              <Sparkles className="h-4 w-4" />
              Apply Robustness Optimization (&gt;75)
            </button>
            <p className="text-[10px] text-slate-500 text-center mt-2">
              Instantly adjust fast/slow period curves to clear requirements.
            </p>
          </div>

        </aside>

        {/* WORKSPACE DETAILED WORKBENCH */}
        <div className="flex-1 flex flex-col min-h-0 bg-slate-950">
          
          {/* TABS CONTROLLER */}
          <div className="flex border-b border-slate-900 px-6 gap-6 overflow-x-auto bg-slate-950/60 sticky top-0 z-10 shrink-0">
            {[
              { id: "backtest", label: "Equity & Performance", icon: ChartIcon },
              { id: "wfa", label: "Walk-Forward Analysis", icon: ArrowUpDown },
              { id: "robustness", label: "Robustness Scorecard", icon: Award },
              { id: "export", label: "Submission Files Hub", icon: FileCode },
              { id: "ai", label: "Gemini AI Recruiting Coach", icon: Terminal },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 border-b-2 font-medium text-xs flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === tab.id
                    ? "border-emerald-500 text-emerald-400"
                    : "border-transparent text-slate-400 hover:text-slate-300"
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* RESULTS ALERTER FOR INITIAL BAR WARNINGS */}
          {!backtestResult && (
            <div className="m-6 p-6 bg-amber-950/20 border border-amber-900/50 rounded-xl flex items-center gap-4 text-amber-500">
              <AlertCircle className="h-6 w-6 shrink-0" />
              <div>
                <h4 className="font-semibold text-sm">Failed to execute simulation.</h4>
                <p className="text-xs text-slate-400">Increase date ranges or adjust periods. Your technical overlays require more historical candle bars than provided.</p>
              </div>
            </div>
          )}

          {/* TAB 1: STANDARD BACKTEST VISUALIZER */}
          {activeTab === "backtest" && backtestResult && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              
              {/* HIGHLIGHT PERFORMANCE METRIC CARDS */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                
                <div className="bg-slate-900/30 border border-slate-900 rounded-xl p-4 flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Starting Cash</span>
                  <div className="mt-2 text-lg font-bold text-white">${backtestResult.startingCapital.toLocaleString()}</div>
                  <span className="text-[10px] text-slate-500 block mt-1">Stated base capital</span>
                </div>

                <div className="bg-slate-900/30 border border-slate-900 rounded-xl p-4 flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Return on Capital</span>
                  <div className={`mt-2 text-lg font-bold flex items-center gap-1 ${
                    backtestResult.percentageReturn >= 0 ? "text-emerald-400" : "text-red-400"
                  }`}>
                    {backtestResult.percentageReturn >= 0 ? (
                      <TrendingUp className="h-4 w-4 shrink-0" />
                    ) : (
                      <TrendingDown className="h-4 w-4 shrink-0" />
                    )}
                    {backtestResult.percentageReturn.toFixed(2)}%
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-1">
                    Net: ${(backtestResult.netProfit).toLocaleString(undefined, {minimumFractionDigits: 2})}
                  </span>
                </div>

                <div className="bg-slate-900/30 border border-slate-900 rounded-xl p-4 flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Max Drawdown</span>
                  <div className="mt-2 text-lg font-bold text-red-400">{backtestResult.maxDrawdown.toFixed(2)}%</div>
                  <span className="text-[10px] text-slate-500 block mt-1">Peak-to-trough decline</span>
                </div>

                <div className="bg-slate-900/30 border border-slate-900 rounded-xl p-4 flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Trade Hit Rate</span>
                  <div className="mt-2 text-lg font-bold text-slate-100">{backtestResult.winRate.toFixed(1)}%</div>
                  <span className="text-[10px] text-slate-500 block mt-1">
                    Wins: {backtestResult.winningTrades} / {backtestResult.totalTrades} trades
                  </span>
                </div>

                <div className="bg-slate-900/30 border border-slate-900 rounded-xl p-4 flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Profit Factor</span>
                  <div className={`mt-2 text-lg font-bold ${
                    backtestResult.profitFactor >= 1.5 ? "text-emerald-400" : backtestResult.profitFactor >= 1.0 ? "text-slate-300" : "text-amber-500"
                  }`}>
                    {backtestResult.profitFactor.toFixed(2)}
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-1">Gross wins / gross losses</span>
                </div>

              </div>

              {/* HISTORICAL CHART WORKSPACE */}
              <div className="bg-slate-900/20 border border-slate-900 rounded-2xl p-6">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-white text-sm font-semibold">Asset Close & Portfolio Equity Curve</h3>
                    <p className="text-slate-400 text-xs">Simulated performance of the {strategyType} model from 2021 to 2026</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-medium">
                    <span className="flex items-center gap-1.5 text-indigo-400">
                      <span className="h-2 w-2 rounded-full bg-indigo-500"></span> Portfolio Value (Scale Right)
                    </span>
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <span className="h-2 w-2 rounded-full bg-emerald-500"></span> Stock Close (Scale Left)
                    </span>
                  </div>
                </div>

                {/* CHART CONTAINER */}
                <div className="h-[340px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={backtestResult.equityCurve}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15}/>
                          <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorStock" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.3} />
                      <XAxis 
                        dataKey="date" 
                        stroke="#475569" 
                        fontSize={10} 
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => v.split("-")[0]} // Year groupings
                        minTickGap={80}
                      />
                      <YAxis 
                        yAxisId="stock"
                        stroke="#10b981" 
                        fontSize={10} 
                        tickLine={false}
                        axisLine={false}
                        domain={['auto', 'auto']}
                        tickFormatter={(v) => `$${v}`}
                      />
                      <YAxis 
                        yAxisId="equity"
                        orientation="right"
                        stroke="#4f46e5"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        domain={['auto', 'auto']}
                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#020617', borderColor: '#1e293b', borderRadius: '12px' }}
                        labelStyle={{ color: '#94a3b8', fontSize: '11px', fontWeight: 'bold' }}
                        itemStyle={{ fontSize: '12px' }}
                        formatter={(value: any, name: any) => {
                          const val = Number(value).toLocaleString(undefined, {minimumFractionDigits: 2});
                          if (name === "closePrice") return [`$${val}`, "Stock Close price"];
                          if (name === "equity") return [`$${val}`, "Portfolio Value"];
                          if (name === "drawdown") return [`${Number(value).toFixed(2)}%`, "Drawdown"];
                          return [val, name];
                        }}
                      />
                      <Area yAxisId="stock" type="monotone" dataKey="closePrice" stroke="#10b981" strokeWidth={1.5} fillOpacity={1} fill="url(#colorStock)" />
                      <Area yAxisId="equity" type="monotone" dataKey="equity" stroke="#6366f1" strokeWidth={2.2} fillOpacity={1} fill="url(#colorEquity)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* DETAILED TRADE LOGS TABLE */}
              <div className="bg-slate-900/20 border border-slate-900 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-900 flex items-center justify-between">
                  <div>
                    <h3 className="text-white text-sm font-semibold">Backtrader Simulated Trade Logs</h3>
                    <p className="text-slate-400 text-xs">A comprehensive breakdown of all transactional entries and risk limits</p>
                  </div>
                  <span className="text-xs text-slate-400 font-mono bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
                    Total Completed Trades: {backtestResult.trades.filter(t => t.type === "SELL").length}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-900 bg-slate-900/40 text-slate-400 font-medium">
                        <th className="p-4">Type</th>
                        <th className="p-4">Date</th>
                        <th className="p-4 text-right">Fill Price</th>
                        <th className="p-4 text-right">Units Size</th>
                        <th className="p-4 text-right">PnL Net ($)</th>
                        <th className="p-4 text-right">Profit %</th>
                        <th className="p-4 text-right">End Portfolio</th>
                        <th className="p-4">Execution Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900/60 font-mono text-slate-300">
                      {backtestResult.trades.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-900/20 transition-colors">
                          <td className="p-4 font-bold">
                            <span className={`px-2.5 py-0.5 rounded text-[10px] ${
                              t.type === "BUY" 
                                ? "bg-emerald-950/40 text-emerald-400 border border-emerald-900/50" 
                                : "bg-red-950/40 text-red-400 border border-red-900/50"
                            }`}>
                              {t.type}
                            </span>
                          </td>
                          <td className="p-4 text-slate-400">{t.date}</td>
                          <td className="p-4 text-right font-medium text-white">${t.price}</td>
                          <td className="p-4 text-right">{t.units}</td>
                          <td className="p-4 text-right">
                            {t.pnl !== undefined ? (
                              <span className={t.pnl >= 0 ? "text-emerald-450 text-emerald-400 font-semibold" : "text-red-450 text-red-400 font-semibold"}>
                                {t.pnl >= 0 ? "+" : ""}${t.pnl.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                          <td className="p-4 text-right">
                            {t.pnlPct !== undefined ? (
                              <span className={`font-semibold ${t.pnlPct >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                                {t.pnlPct >= 0 ? "+" : ""}{t.pnlPct}%
                              </span>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                          <td className="p-4 text-right text-slate-400">${t.portfolioValueAfter.toLocaleString()}</td>
                          <td className="p-4 text-left text-slate-400 font-sans truncate max-w-[200px]">{t.reason}</td>
                        </tr>
                      ))}

                      {backtestResult.trades.length === 0 && (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-slate-500 font-sans">
                            <Sliders className="h-8 w-8 mx-auto mb-2 text-slate-600" />
                            No exits or executions completed. Try widening parameters or reducing your stop loss bounds.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

              </div>

            </div>
          )}

          {/* TAB 2: WALK-FORWARD ANALYSIS */}
          {activeTab === "wfa" && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar text-xs">
              
              <div className="p-6 bg-indigo-950/10 border border-indigo-900/40 rounded-2xl flex flex-col md:flex-row items-start md:items-center gap-4">
                <div className="bg-indigo-900/30 p-3 rounded-lg flex items-center justify-center shrink-0">
                  <ArrowUpDown className="h-6 w-6 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Understanding Walk-Forward Analysis (WFA) Setup</h3>
                  <p className="text-slate-400 leading-relaxed mt-1">
                    WFA splits your asset history into multiple chronological segments. For each segment, the engine seeks optimal strategy parameters inside an **In-Sample window (2 years)**, then tests those parameters on the succeeding, unseen **Out-of-Sample window (6 months)**. 
                    This verifies whether your chosen signals retain their predictive edge or if they collapse as curve-fitted parameters.
                  </p>
                </div>
              </div>

              {/* WINDOW MATRIX GRAPHIC OVERVIEW */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {wfaSegments.map((seg) => (
                  <div key={seg.windowIndex} className="bg-slate-900/20 border border-slate-900 rounded-xl p-4 flex flex-col gap-3 font-sans">
                    <div className="flex items-center justify-between border-b border-slate-900 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-300">ROLL WINDOW {seg.windowIndex}</span>
                        <span className={`px-2 py-0.2 rounded text-[9px] font-extrabold ${seg.isSuccess ? "bg-emerald-950 text-emerald-400" : "bg-red-950 text-red-500"}`}>
                          {seg.isSuccess ? "PROFIT" : "LOSS"}
                        </span>
                      </div>
                      <span className="font-mono text-indigo-400 font-semibold">{seg.efficiencyPct}% WFE</span>
                    </div>

                    <div className="space-y-1.5 text-[11px] text-slate-400 font-mono">
                      <div className="flex justify-between">
                        <span>Optimized Overlays:</span>
                        <span className="text-white font-sans">{JSON.stringify(seg.optimizedParams)}</span>
                      </div>
                      <div className="flex justify-between border-t border-slate-900/50 pt-1.5">
                        <span>IS Optimization (2Y):</span>
                        <span className="text-slate-300">{seg.inSampleStart} to {seg.inSampleEnd}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>IS Return:</span>
                        <span className="text-emerald-450 text-emerald-450 font-bold">{seg.inSampleReturnPct}%</span>
                      </div>
                      <div className="flex justify-between border-t border-slate-900/50 pt-1.5">
                        <span>OOS Test (6M):</span>
                        <span className="text-slate-300">{seg.outOfSampleStart} to {seg.outOfSampleEnd}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>OOS Unseen Return:</span>
                        <span className={seg.outOfSampleReturnPct >= 0 ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>
                          {seg.outOfSampleReturnPct}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* OVERALL STATISTICS SUMMARY */}
              <div className="bg-slate-900/20 border border-slate-900 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                  <h4 className="text-white font-semibold text-sm">Walk-Forward Overfitting Diagnostics</h4>
                  <p className="text-slate-450 text-xs text-slate-400">Average results compiled over {wfaSegments.length} sequential trading roll-overs</p>
                </div>
                
                {robustnessScore && (
                  <div className="flex gap-6 items-center shrink-0">
                    <div className="text-center">
                      <div className="text-2xl font-black font-mono text-indigo-400">
                        {(wfaSegments.reduce((sum, s) => sum + s.efficiencyPct, 0) / (wfaSegments.length || 1)).toFixed(1)}%
                      </div>
                      <div className="text-[10px] uppercase font-bold text-slate-500 mt-1">Avg Efficiency (WFE)</div>
                    </div>
                    <div className="h-8 w-px bg-slate-800"></div>
                    <div className="text-center">
                      <div className="text-2xl font-black font-mono text-slate-100">
                        {wfaSegments.filter(s => s.isSuccess).length} / {wfaSegments.length}
                      </div>
                      <div className="text-[10px] uppercase font-bold text-slate-500 mt-1">OOS Passing Windows</div>
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 3: ROBUSTNESS SCORECARD */}
          {activeTab === "robustness" && robustnessScore && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar text-xs">
              
              {/* PRIMARY CIRCULAR PANEL */}
              <div className="bg-slate-900/20 border border-slate-900 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-around gap-6 text-center md:text-left">
                
                {/* Score Dial Wrapper */}
                <div className="relative h-32 w-32 flex items-center justify-center shrink-0">
                  <svg className="absolute inset-0 transform -rotate-95" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" stroke="#1e293b" strokeWidth="6" fill="transparent" />
                    <circle 
                      cx="50" cy="50" r="40" 
                      stroke={robustnessScore.totalScore >= 75 ? "#10b981" : "#f59e0b"} 
                      strokeWidth="6" 
                      fill="transparent" 
                      strokeDasharray="251.2"
                      strokeDashoffset={251.2 - (251.2 * robustnessScore.totalScore) / 100}
                    />
                  </svg>
                  <div className="text-center">
                    <span className="text-3xl font-black font-mono text-white block">{robustnessScore.totalScore}</span>
                    <span className="text-[9px] uppercase font-bold text-slate-500">Robustness</span>
                  </div>
                </div>

                {/* Status Badges explanation */}
                <div className="max-w-md">
                  <span className={`px-3 py-1 rounded-full border text-[10px] font-bold inline-block mb-3.5 ${
                    robustnessScore.totalScore >= 75 
                      ? "bg-emerald-950/50 text-emerald-400 border-emerald-900" 
                      : "bg-amber-950/50 text-amber-500 border-amber-900"
                  }`}>
                    {robustnessScore.totalScore >= 75 ? "VERIFIED ROBUST MODEL (>75)" : "CRITICAL RISK ADJUSTMENT NEEDED (<75)"}
                  </span>
                  <h3 className="text-white text-base font-semibold leading-tight">Quant Analyst Strategy Validation Verdict</h3>
                  <p className="text-slate-450 leading-relaxed mt-1 text-slate-450">
                    {robustnessScore.totalScore >= 75 
                      ? "Congratulations! Your entry signals, exits, and risk parameters have cleared the recruitment review benchmark. The model preserves healthy out-of-sample efficiency with robust risk thresholds."
                      : "Your strategy does not satisfy the take-home assessment guidelines. Click 'Apply Robustness Optimization' on the sidebar parameters, or tweak stop loss margins to increase score above 75."
                    }
                  </p>
                </div>

              </div>

              {/* SCORE CARD PARAMETER CARDS DEEP DIVE */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* CARD 1: WALK-FORWARD EFFICIENCY */}
                <div className="bg-slate-900/30 border border-slate-900 rounded-xl p-5 space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-sm text-white">Walk-Forward Efficiency</span>
                      <span className="font-mono text-indigo-400 font-bold bg-indigo-950/40 px-2 py-0.5 rounded text-[10px]">{robustnessScore.walkForwardEfficiencyScore} / 25 pts</span>
                    </div>
                    <p className="text-slate-400 leading-relaxed mt-2 text-[11px]">
                      Measures performance carrying over from parameter curves. High values ensure your strategy is truly tracking macro patterns instead of peak over-fitting.
                    </p>
                  </div>
                  <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-900/40 text-[10px] font-mono text-emerald-450 text-slate-300">
                    {robustnessScore.methodologyDetails.wfeMessage}
                  </div>
                </div>

                {/* CARD 2: CONSISTENCY OVERROLL */}
                <div className="bg-slate-900/30 border border-slate-900 rounded-xl p-5 space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-sm text-white">Statistical Return Consistency</span>
                      <span className="font-mono text-indigo-400 font-bold bg-indigo-950/40 px-2 py-0.5 rounded text-[10px]">{robustnessScore.consistencyScore} / 25 pts</span>
                    </div>
                    <p className="text-slate-400 leading-relaxed mt-2 text-[11px]">
                      Percentage of rolling forward tests producing positive returns. Prevents strategies from appearing viable solely based on a single "black swan" or lucky window.
                    </p>
                  </div>
                  <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-900/40 text-[10px] font-mono text-slate-300">
                    {robustnessScore.methodologyDetails.winningWindowsMessage}
                  </div>
                </div>

                {/* CARD 3: PARAMETER DRIFT SENSITIVITY */}
                <div className="bg-slate-900/30 border border-slate-900 rounded-xl p-5 space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-sm text-white">Parameter Drift Sensitivity</span>
                      <span className="font-mono text-indigo-400 font-bold bg-indigo-950/40 px-2 py-0.5 rounded text-[10px]">{robustnessScore.parameterSensitivityScore} / 25 pts</span>
                    </div>
                    <p className="text-slate-400 leading-relaxed mt-2 text-[11px]">
                      Calculates standard deviation of profits across adjacent grids. If slight increments in moving average spans destroy performance, the strategy is brittle.
                    </p>
                  </div>
                  <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-900/40 text-[10px] font-mono text-slate-300">
                    {robustnessScore.methodologyDetails.parameterVarianceMessage}
                  </div>
                </div>

                {/* CARD 4: DRAWDOWNS RISK SAFETY */}
                <div className="bg-slate-900/30 border border-slate-900 rounded-xl p-5 space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-sm text-white">Drawdown Control & Preservation</span>
                      <span className="font-mono text-indigo-400 font-bold bg-indigo-950/40 px-2 py-0.5 rounded text-[10px]">{robustnessScore.drawdownControlScore} / 25 pts</span>
                    </div>
                    <p className="text-slate-400 leading-relaxed mt-2 text-[11px]">
                      Measures absolute drawdowns against bankruptcy limits. Hard bracketing bounds protect starting broker capital from severe equity erosion.
                    </p>
                  </div>
                  <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-900/40 text-[10px] font-mono text-slate-300">
                    {robustnessScore.methodologyDetails.maxDrawdownMessage}
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* TAB 4: CODE EXPORT & SUBMISSION HUB */}
          {activeTab === "export" && robustnessScore && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6 flex flex-col min-h-0 custom-scrollbar text-xs">
              
              <div className="p-5 bg-slate-900/40 border border-slate-900 rounded-2xl space-y-3">
                <h4 className="text-white font-semibold text-sm flex items-center gap-2">
                  <FileCode className="h-5 w-5 text-emerald-500" />
                  Your Ready-To-Submit Code Repository
                </h4>
                <p className="text-slate-400 leading-relaxed">
                  These programmatically structured files match the exact prompt specifications for your Take-Home task. They use yfinance to fetch actual stock series, feed it to a standard Backtrader engine, and calculate robustness. Simply copy these contents into your private GitHub repository and add <code className="text-white px-2 py-1 bg-slate-950 rounded border border-slate-800">markheris34-svg</code> as a reader.
                </p>
              </div>

              {/* FILES SELECTOR & VIEWER PANELS */}
              <div className="flex-1 flex flex-col min-h-0 min-w-0 border border-slate-900 rounded-2xl overflow-hidden">
                <div className="flex border-b border-slate-900 bg-slate-950 px-4 gap-4 overflow-x-auto shrink-0">
                  {Object.keys(exportedFiles).map((filename) => (
                    <button
                      key={filename}
                      onClick={() => setCopiedFile(null)} // reset feedback
                      className="py-3 font-mono text-xs text-slate-400 hover:text-white border-b border-transparent hover:border-slate-800 focus:outline-none"
                    >
                      <span className="px-2.5 py-1 text-slate-300 font-mono text-xs">{filename}</span>
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto bg-slate-950 p-4 font-mono text-[11px] leading-relaxed custom-scrollbar text-slate-300 max-h-[440px]">
                  {Object.entries(exportedFiles).map(([filename, content]) => (
                    <div key={filename} className="space-y-3 mb-6 border border-slate-900 rounded-xl bg-slate-900/25 p-4 relative">
                      <div className="flex justify-between items-center border-b border-slate-800/80 pb-2 mb-3">
                        <span className="text-indigo-400 font-bold">{filename}</span>
                        <button
                          onClick={() => copyToClipboard(filename, content)}
                          className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-slate-900 font-bold text-[10px] transition-all flex items-center gap-2 cursor-pointer"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          {copiedFile === filename ? "Copied!" : "Copy File"}
                        </button>
                      </div>
                      <pre className="whitespace-pre-wrap overflow-x-auto select-all text-slate-200">{content}</pre>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* TAB 5: GEMINI COACH BOX */}
          {activeTab === "ai" && (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-slate-950 p-6">
              
              {/* CHAT LOGS */}
              <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2 custom-scrollbar min-h-0 max-h-[420px]">
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`max-w-2xl rounded-2xl p-4 shadow-sm border ${
                      msg.sender === "user"
                        ? "bg-indigo-950/40 text-slate-100 border-indigo-900/60"
                        : "bg-slate-900/40 text-slate-300 border-slate-900"
                    }`}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-tight font-extrabold flex items-center gap-1">
                          {msg.sender === "user" ? "Candidate Applicant" : "Gemini Quant Advisor"}
                        </span>
                        <span className="text-[9px] text-slate-500">{msg.timestamp}</span>
                      </div>
                      <p className="text-xs leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                    </div>
                  </div>
                ))}
                
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-4 text-xs text-slate-500 flex items-center gap-2">
                      <RefreshCw className="h-3.5 w-3.5 animate-spin text-emerald-500" />
                      <span>Gemini is compiling advice for your take-home interview preparation...</span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* CHIP SUGGESTIONS */}
              <div className="flex flex-wrap gap-2.5 mb-4 shrink-0">
                {[
                  { text: "Critique my active strategy entry exits and drawdown risk limit", label: "Critique Strategy" },
                  { text: "Help me prepare for the live recruiter interview: Ask 3 tough quant questions", label: "Mock Recruiter Interview Prep" },
                  { text: "Explain mathematically why Walk-Forward protects against curve-fitting", label: "Explain WFA Overfitting" },
                  { text: "How does Backtrader handle trading execution fees and slippage modeling?", label: "Backtrader Mechanics" }
                ].map((chip, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(chip.text)}
                    className="px-3.5 py-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800 text-slate-305 text-[11px] text-slate-400 hover:text-white transition-all text-left flex items-center gap-2 cursor-pointer"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    <span>{chip.label}</span>
                  </button>
                ))}
              </div>

              {/* CHAT INPUT FIELD */}
              <div className="flex gap-2 shrink-0">
                <input
                  type="text"
                  placeholder="Ask Gemini about Robustness, Backtesting parameters, or prep for candidate reviews..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                />
                <button
                  onClick={() => handleSendMessage()}
                  className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-505 bg-indigo-600 text-slate-900 hover:bg-indigo-500 font-extrabold text-xs transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Play className="h-4 w-4 shrink-0" />
                  Ask Advisor
                </button>
              </div>

            </div>
          )}

        </div>

      </main>

    </div>
  );
}
