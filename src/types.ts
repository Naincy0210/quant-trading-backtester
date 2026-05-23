export interface Candle {
  date: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type StrategyType = "SMA" | "RSI" | "MACD" | "BB";

export interface StrategyParams {
  SMA: {
    fastPeriod: number;
    slowPeriod: number;
  };
  RSI: {
    period: number;
    oversold: number;
    overbought: number;
  };
  MACD: {
    fastPeriod: number;
    slowPeriod: number;
    signalPeriod: number;
  };
  BB: {
    period: number;
    stdDev: number;
  };
}

export interface RiskConfig {
  startingCapital: number;
  positionSizePct: number; // e.g. 10 means 10% of equity per trade
  stopLossPct: number;    // e.g. 2 means 2% stop-loss
  takeProfitPct: number;  // e.g. 5 means 5% take-profit
  commissionPct: number;  // e.g. 0.1 means 0.1% commission
  slippagePct: number;    // e.g. 0.05 means 0.05% slippage
}

export interface Trade {
  id: string;
  type: "BUY" | "SELL";
  date: string;
  price: number;
  units: number;
  cost: number;
  pnl?: number; // Profit and Loss (only set for sell trades)
  pnlPct?: number; 
  cashAfter: number;
  portfolioValueAfter: number;
  reason: string;
}

export interface Position {
  ticker: string;
  units: number;
  entryPrice: number;
  entryDate: string;
}

export interface EquityPoint {
  date: string;
  equity: number;
  drawdown: number;
  cash: number;
  closePrice: number;
}

export interface BacktestResult {
  ticker: string;
  strategyType: StrategyType;
  params: any; // dynamically matched params
  startingCapital: number;
  finalCapital: number;
  netProfit: number;
  percentageReturn: number;
  maxDrawdown: number;
  winRate: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  avgProfit: number;
  avgLoss: number;
  profitFactor: number;
  trades: Trade[];
  equityCurve: EquityPoint[];
}

export interface WfaSegment {
  windowIndex: number;
  inSampleStart: string;
  inSampleEnd: string;
  outOfSampleStart: string;
  outOfSampleEnd: string;
  
  // Best parameters found during in-sample optimization
  optimizedParams: any;
  inSampleReturnPct: number;
  inSampleDrawdown: number;

  // Performance of those optimized parameters in out-of-sample test
  outOfSampleReturnPct: number;
  outOfSampleDrawdown: number;
  
  efficiencyPct: number; // (OOS Return Pct / IS Return Pct) normalized
  isSuccess: boolean;
}

export interface RobustnessScore {
  totalScore: number;
  walkForwardEfficiencyScore: number; // 25pts
  consistencyScore: number;           // 25pts
  parameterSensitivityScore: number;   // 25pts
  drawdownControlScore: number;        // 25pts
  methodologyDetails: {
    wfeValue: number;
    wfeMessage: string;
    winningWindowsRatio: number;
    winningWindowsMessage: string;
    parameterVariancePct: number;
    parameterVarianceMessage: string;
    maxDrawdownValue: number;
    maxDrawdownMessage: string;
  };
}

export interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
}
