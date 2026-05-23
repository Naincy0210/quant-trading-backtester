import { Candle, StrategyType, RiskConfig, Trade, Position, EquityPoint, BacktestResult, WfaSegment, RobustnessScore } from "../types";

// ==========================================
// TECHNICAL INDICATOR CALCULATORS
// ==========================================

export function calculateSMA(data: number[], period: number): number[] {
  const sma: number[] = new Array(data.length).fill(NaN);
  if (data.length < period) return sma;

  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i];
  }
  sma[period - 1] = sum / period;

  for (let i = period; i < data.length; i++) {
    sum = sum - data[i - period] + data[i];
    sma[i] = sum / period;
  }
  return sma;
}

export function calculateEMA(data: number[], period: number): number[] {
  const ema: number[] = new Array(data.length).fill(NaN);
  if (data.length < period) return ema;

  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i];
  }
  ema[period - 1] = sum / period; // Start with SMA

  for (let i = period; i < data.length; i++) {
    ema[i] = data[i] * k + ema[i - 1] * (1 - k);
  }
  return ema;
}

export function calculateRSI(data: number[], period: number): number[] {
  const rsi: number[] = new Array(data.length).fill(NaN);
  if (data.length <= period) return rsi;

  let gains = 0;
  let losses = 0;

  // First RSI value
  for (let i = 1; i <= period; i++) {
    const diff = data[i] - data[i - 1];
    if (diff > 0) {
      gains += diff;
    } else {
      losses -= diff;
    }
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < data.length; i++) {
    const diff = data[i] - data[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return rsi;
}

export function calculateBollingerBands(data: number[], period: number, stdDevMultiplier: number) {
  const middle: number[] = calculateSMA(data, period);
  const upper: number[] = new Array(data.length).fill(NaN);
  const lower: number[] = new Array(data.length).fill(NaN);

  for (let i = period - 1; i < data.length; i++) {
    let varianceSum = 0;
    const avg = middle[i];
    for (let j = i - period + 1; j <= i; j++) {
      varianceSum += Math.pow(data[j] - avg, 2);
    }
    const stdDev = Math.sqrt(varianceSum / period);
    upper[i] = avg + stdDevMultiplier * stdDev;
    lower[i] = avg - stdDevMultiplier * stdDev;
  }

  return { upper, middle, lower };
}

// ==========================================
// CORE BACKTESTING ENGINE
// ==========================================

export function runBacktest(
  candles: Candle[],
  strategyType: StrategyType,
  params: any,
  risk: RiskConfig,
  startTime?: string,
  endTime?: string
): BacktestResult {
  // Filter candles if dates are supplied
  const filteredCandles = candles.filter((c) => {
    if (startTime && c.date < startTime) return false;
    if (endTime && c.date > endTime) return false;
    return true;
  });

  if (filteredCandles.length < 50) {
    throw new Error("Insufficient historical candle data for the selected period.");
  }

  const closes = filteredCandles.map((c) => c.close);
  const dates = filteredCandles.map((c) => c.date);

  // Pre-calculate indicators
  let indicatorData: any = {};
  if (strategyType === "SMA") {
    indicatorData.fast = calculateSMA(closes, params.fastPeriod);
    indicatorData.slow = calculateSMA(closes, params.slowPeriod);
  } else if (strategyType === "RSI") {
    indicatorData.rsi = calculateRSI(closes, params.period);
  } else if (strategyType === "MACD") {
    const ema12 = calculateEMA(closes, params.fastPeriod);
    const ema26 = calculateEMA(closes, params.slowPeriod);
    const macdLine: number[] = new Array(closes.length).fill(NaN);
    for (let i = 0; i < closes.length; i++) {
      if (!isNaN(ema12[i]) && !isNaN(ema26[i])) {
        macdLine[i] = ema12[i] - ema26[i];
      }
    }
    // Filter non-NaNs to find signal line
    const nonNanIdx = macdLine.findIndex((v) => !isNaN(v));
    const macdForSignal = macdLine.map((v) => (isNaN(v) ? 0 : v));
    const signalLine = calculateEMA(macdForSignal, params.signalPeriod);
    
    // Correct NaNs of signal line
    for (let i = 0; i < closes.length; i++) {
      if (i < nonNanIdx + params.signalPeriod - 1) {
        signalLine[i] = NaN;
      }
    }

    indicatorData.macd = macdLine;
    indicatorData.signal = signalLine;
  } else if (strategyType === "BB") {
    const { upper, middle, lower } = calculateBollingerBands(closes, params.period, params.stdDev);
    indicatorData.upper = upper;
    indicatorData.middle = middle;
    indicatorData.lower = lower;
  }

  // Backtest Simulation loop variables
  let cash = risk.startingCapital;
  let portfolioValue = cash;
  let maxPortfolioValue = cash;
  let currentPosition: Position | null = null;
  const trades: Trade[] = [];
  const equityCurve: EquityPoint[] = [];

  // Minimum required bars to trigger strategy
  const minRequiredBarIdx = Math.max(
    50,
    strategyType === "SMA" ? Math.max(params.fastPeriod, params.slowPeriod) : 0,
    strategyType === "RSI" ? params.period : 0,
    strategyType === "MACD" ? Math.max(params.fastPeriod, params.slowPeriod) + params.signalPeriod : 0,
    strategyType === "BB" ? params.period : 0
  );

  let totalWinPnL = 0;
  let totalLossPnL = 0;
  let winTradesCount = 0;
  let loseTradesCount = 0;

  for (let i = 0; i < filteredCandles.length; i++) {
    const candle = filteredCandles[i];
    const closePrice = candle.close;
    const highPrice = candle.high;
    const lowPrice = candle.low;
    const openPrice = candle.open;

    // Skip bars before indices are stable
    if (i < minRequiredBarIdx) {
      equityCurve.push({
        date: candle.date,
        equity: cash,
        drawdown: 0,
        cash: cash,
        closePrice: closePrice,
      });
      continue;
    }

    // 1. RISK MANAGEMENT CHECKS (Stop-Loss and Take-Profit)
    let triggeredSL = false;
    let triggeredTP = false;
    let exitPrice = closePrice;
    let exitReason = "";

    if (currentPosition) {
      const entryPrice = currentPosition.entryPrice;
      const stopLossPrice = entryPrice * (1 - risk.stopLossPct / 100);
      const takeProfitPrice = entryPrice * (1 + risk.takeProfitPct / 100);

      // Simple bar-level check. Stop-loss has priority for preservation of capital
      if (lowPrice <= stopLossPrice && risk.stopLossPct > 0) {
        triggeredSL = true;
        exitPrice = stopLossPrice;
        exitReason = "Stop-Loss (SL) Triggered";
      } else if (highPrice >= takeProfitPrice && risk.takeProfitPct > 0) {
        triggeredTP = true;
        exitPrice = takeProfitPrice;
        exitReason = "Take-Profit (TP) Triggered";
      }
    }

    // 2. SIGNAL CALCULATIONS & CROSSOVERS
    const prevClose = closes[i - 1];
    
    let buySignal = false;
    let sellSignal = false;

    if (strategyType === "SMA") {
      const fastCurr = indicatorData.fast[i];
      const fastPrev = indicatorData.fast[i - 1];
      const slowCurr = indicatorData.slow[i];
      const slowPrev = indicatorData.slow[i - 1];

      // Golden Cross (Fast SMA crosses above Slow SMA)
      if (fastPrev <= slowPrev && fastCurr > slowCurr) {
        buySignal = true;
      }
      // Death Cross (Fast SMA crosses below Slow SMA)
      if (fastPrev >= slowPrev && fastCurr < slowCurr) {
        sellSignal = true;
      }
    } else if (strategyType === "RSI") {
      const rsiCurr = indicatorData.rsi[i];
      const rsiPrev = indicatorData.rsi[i - 1];
      const oversold = params.oversold;
      const overbought = params.overbought;

      // Oversold bounce (RSI crossing up from below oversold)
      if (rsiPrev <= oversold && rsiCurr > oversold) {
        buySignal = true;
      }
      // Overbought dip (RSI crossing down from above overbought)
      if (rsiPrev >= overbought && rsiCurr < overbought) {
        sellSignal = true;
      }
    } else if (strategyType === "MACD") {
      const macdCurr = indicatorData.macd[i];
      const macdPrev = indicatorData.macd[i - 1];
      const sigCurr = indicatorData.signal[i];
      const sigPrev = indicatorData.signal[i - 1];

      // MACD crossing Signal Line up
      if (macdPrev <= sigPrev && macdCurr > sigCurr) {
        buySignal = true;
      }
      // MACD crossing Signal Line down
      if (macdPrev >= sigPrev && macdCurr < sigCurr) {
        sellSignal = true;
      }
    } else if (strategyType === "BB") {
      const closePrev = closes[i - 1];
      const upperCurr = indicatorData.upper[i];
      const lowerCurr = indicatorData.lower[i];
      
      // Close breakthroughs upper BB (breakout entry)
      if (closePrev <= indicatorData.upper[i - 1] && closePrice > upperCurr) {
        buySignal = true;
      }
      // Close crossing below middle BB (profit taking / mean reversion exit)
      if (closePrev >= indicatorData.middle[i - 1] && closePrice < indicatorData.middle[i]) {
        sellSignal = true;
      }
      // Or fallback below lower BB
      if (closePrev >= indicatorData.lower[i - 1] && closePrice < lowerCurr) {
        sellSignal = true;
      }
    }

    // 3. EXECUTE TRADES
    if (currentPosition) {
      // Exit position
      if (triggeredSL || triggeredTP || sellSignal) {
        const units = currentPosition.units;
        const entryPrice = currentPosition.entryPrice;
        
        // Slippage & Commission simulation on exit
        const slippageValue = exitPrice * (risk.slippagePct / 100);
        const actualExitPrice = Math.max(0.01, triggeredSL 
          ? exitPrice - slippageValue // stop-loss gets worse fill
          : exitPrice - slippageValue);
        
        const grossValue = units * actualExitPrice;
        const commissionCharge = grossValue * (risk.commissionPct / 100);
        const finalExitValue = grossValue - commissionCharge;
        
        cash += finalExitValue;
        portfolioValue = cash;

        const pnl = finalExitValue - (units * entryPrice);
        const pnlPct = (pnl / (units * entryPrice)) * 100;

        if (pnl >= 0) {
          totalWinPnL += pnl;
          winTradesCount++;
        } else {
          totalLossPnL += pnl;
          loseTradesCount++;
        }

        trades.push({
          id: Math.random().toString(36).substring(2, 9),
          type: "SELL",
          date: candle.date,
          price: Number(actualExitPrice.toFixed(2)),
          units: Number(units.toFixed(4)),
          cost: Number((units * entryPrice).toFixed(2)),
          pnl: Number(pnl.toFixed(2)),
          pnlPct: Number(pnlPct.toFixed(2)),
          cashAfter: Number(cash.toFixed(2)),
          portfolioValueAfter: Number(portfolioValue.toFixed(2)),
          reason: exitReason || (sellSignal ? `${strategyType} Strategy Exit Signal` : "Manual Rule Exit"),
        });

        currentPosition = null;
      } else {
        // Just holding
        portfolioValue = cash + currentPosition.units * closePrice;
      }
    } else {
      // Enter position
      if (buySignal) {
        // Sizing based on current portfolio value
        const sizingValue = portfolioValue * (risk.positionSizePct / 100);
        const cashToUse = Math.min(cash * 0.98, sizingValue); // Cap at cash (leave 2% buffer)
        
        if (cashToUse > 10) { // minimum trade size
          const slippageValue = openPrice * (risk.slippagePct / 100);
          const actualEntryPrice = openPrice + slippageValue; // fill is slightly higher for buy
          
          const commissionValue = cashToUse * (risk.commissionPct / 100);
          const valueForUnits = cashToUse - commissionValue;
          
          const units = valueForUnits / actualEntryPrice;
          
          cash -= cashToUse;
          portfolioValue = cash + units * closePrice;

          currentPosition = {
            ticker: filteredCandles[0].date, // dummy
            units: units,
            entryPrice: actualEntryPrice,
            entryDate: candle.date,
          };

          trades.push({
            id: Math.random().toString(36).substring(2, 9),
            type: "BUY",
            date: candle.date,
            price: Number(actualEntryPrice.toFixed(2)),
            units: Number(units.toFixed(4)),
            cost: Number(cashToUse.toFixed(2)),
            cashAfter: Number(cash.toFixed(2)),
            portfolioValueAfter: Number(portfolioValue.toFixed(2)),
            reason: `${strategyType} Golden Entry Trigger`,
          });
        }
      } else {
        portfolioValue = cash;
      }
    }

    // Update historical peaks for drawdown calculation
    maxPortfolioValue = Math.max(maxPortfolioValue, portfolioValue);
    const drawdown = ((portfolioValue - maxPortfolioValue) / maxPortfolioValue) * 100;

    equityCurve.push({
      date: candle.date,
      equity: Number(portfolioValue.toFixed(2)),
      drawdown: Number(drawdown.toFixed(2)),
      cash: Number(cash.toFixed(2)),
      closePrice: closePrice,
    });
  }

  // Compute final stats
  const totalTrades = trades.filter((t) => t.type === "SELL").length;
  const netProfit = portfolioValue - risk.startingCapital;
  const percentageReturn = (netProfit / risk.startingCapital) * 100;
  
  const minEquity = Math.min(...equityCurve.map((e) => e.equity));
  const maxDrawdown = Math.min(...equityCurve.map((e) => e.drawdown)); // Drawdowns are negative numbers, we want worst (i.e. absolute min)
  
  const winningTrades = winTradesCount;
  const losingTrades = loseTradesCount;
  const winRate = totalTrades === 0 ? 0 : (winningTrades / totalTrades) * 100;
  const avgProfit = winningTrades === 0 ? 0 : totalWinPnL / winningTrades;
  const avgLoss = losingTrades === 0 ? 0 : Math.abs(totalLossPnL / losingTrades);
  const profitFactor = avgLoss === 0 ? totalWinPnL : totalWinPnL / (avgLoss * losingTrades);

  return {
    ticker: filteredCandles[0]?.close ? "Asset" : "N/A",
    strategyType,
    params,
    startingCapital: risk.startingCapital,
    finalCapital: Number(portfolioValue.toFixed(2)),
    netProfit: Number(netProfit.toFixed(2)),
    percentageReturn: Number(percentageReturn.toFixed(2)),
    maxDrawdown: Number(Math.abs(maxDrawdown).toFixed(2)), // Return absolute percentage
    winRate: Number(winRate.toFixed(2)),
    totalTrades,
    winningTrades,
    losingTrades,
    avgProfit: Number(avgProfit.toFixed(2)),
    avgLoss: Number(avgLoss.toFixed(2)),
    profitFactor: isNaN(profitFactor) || !isFinite(profitFactor) ? 0 : Number(profitFactor.toFixed(2)),
    trades,
    equityCurve,
  };
}

// ==========================================
// PARAMETER GRID OPTIMIZER
// ==========================================

export function runInSampleOptimization(
  candles: Candle[],
  strategyType: StrategyType,
  risk: RiskConfig,
  startTime: string,
  endTime: string
): any {
  // Define grid arrays to optimize over
  let bestParams: any = {};
  let bestReturn = -Infinity;

  if (strategyType === "SMA") {
    const fastGrid = [5, 10, 15, 20];
    const slowGrid = [30, 40, 50, 60];
    
    for (const fast of fastGrid) {
      for (const slow of slowGrid) {
        if (fast >= slow) continue;
        const result = runBacktest(candles, "SMA", { fastPeriod: fast, slowPeriod: slow }, { ...risk, positionSizePct: 100 }, startTime, endTime);
        if (result.percentageReturn > bestReturn) {
          bestReturn = result.percentageReturn;
          bestParams = { fastPeriod: fast, slowPeriod: slow };
        }
      }
    }
  } else if (strategyType === "RSI") {
    const rsiGrid = [7, 10, 14, 20];
    const oversoldGrid = [20, 25, 30, 35];
    const overboughtGrid = [65, 70, 75, 80];

    for (const len of rsiGrid) {
      for (const os of oversoldGrid) {
        for (const ob of overboughtGrid) {
          const result = runBacktest(candles, "RSI", { period: len, oversold: os, overbought: ob }, { ...risk, positionSizePct: 100 }, startTime, endTime);
          if (result.percentageReturn > bestReturn) {
            bestReturn = result.percentageReturn;
            bestParams = { period: len, oversold: os, overbought: ob };
          }
        }
      }
    }
  } else if (strategyType === "MACD") {
    const fastGrid = [8, 12, 15];
    const slowGrid = [22, 26, 30];
    const signalGrid = [7, 9, 11];

    for (const f of fastGrid) {
      for (const s of slowGrid) {
        for (const sig of signalGrid) {
          if (f >= s) continue;
          const result = runBacktest(candles, "MACD", { fastPeriod: f, slowPeriod: s, signalPeriod: sig }, { ...risk, positionSizePct: 100 }, startTime, endTime);
          if (result.percentageReturn > bestReturn) {
            bestReturn = result.percentageReturn;
            bestParams = { fastPeriod: f, slowPeriod: s, signalPeriod: sig };
          }
        }
      }
    }
  } else if (strategyType === "BB") {
    const periodGrid = [10, 15, 20, 25];
    const devGrid = [1.5, 2.0, 2.5];

    for (const p of periodGrid) {
      for (const d of devGrid) {
        const result = runBacktest(candles, "BB", { period: p, stdDev: d }, { ...risk, positionSizePct: 100 }, startTime, endTime);
        if (result.percentageReturn > bestReturn) {
          bestReturn = result.percentageReturn;
          bestParams = { period: p, stdDev: d };
        }
      }
    }
  }

  // Fallback defaults if grid didn't yield anything
  if (Object.keys(bestParams).length === 0) {
    if (strategyType === "SMA") return { fastPeriod: 10, slowPeriod: 50 };
    if (strategyType === "RSI") return { period: 14, oversold: 30, overbought: 70 };
    if (strategyType === "MACD") return { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 };
    return { period: 20, stdDev: 2.0 };
  }

  return bestParams;
}

// ==========================================
// WALK-FORWARD ANALYSIS RUNNER
// ==========================================

export function runWalkForwardAnalysis(
  candles: Candle[],
  strategyType: StrategyType,
  risk: RiskConfig
): WfaSegment[] {
  if (candles.length < 1000) {
    throw new Error("Walk-Forward Analysis requires at least 4-5 years of daily data (>= 1,000 bars) to be meaningful.");
  }

  // We have 1260 daily business bars (approx 5 calendar years)
  // Let's carve out 4 rolling segments of 2 years (in-sample optimization) followed by 6 months (out-of-sample test)
  // segment 1: 
  //   In-Sample: Bars 0 to 504 (Years 1 & 2)
  //   Out-of-Sample: Bars 504 to 630 (First 6 months of Year 3)
  // segment 2:
  //   In-Sample: Bars 126 to 630 (6 months later)
  //   Out-of-Sample: Bars 630 to 756
  // segment 3:
  //   In-Sample: Bars 252 to 756
  //   Out-of-Sample: Bars 756 to 882
  // segment 4:
  //   In-Sample: Bars 378 to 882
  //   Out-of-Sample: Bars 882 to 1008
  // segment 5:
  //   In-Sample: Bars 504 to 1008
  //   Out-of-Sample: Bars 1008 to 1134
  // segment 6:
  //   In-Sample: Bars 630 to 1134
  //   Out-of-Sample: Bars 1134 to 1260

  const stepSize = 126; // 6 solar business months
  const inSampleSize = 504; // 2 solar business years
  const outOfSampleSize = 126; // 6 solar business months
  
  const segmentsCount = 6;
  const segments: WfaSegment[] = [];

  for (let s = 0; s < segmentsCount; s++) {
    const isStartIdx = s * stepSize;
    const isEndIdx = isStartIdx + inSampleSize;
    const oosStartIdx = isEndIdx;
    const oosEndIdx = oosStartIdx + outOfSampleSize;

    if (oosEndIdx > candles.length) break;

    const isStartC = candles[isStartIdx];
    const isEndC = candles[isEndIdx - 1];
    const oosStartC = candles[oosStartIdx];
    const oosEndC = candles[oosEndIdx - 1];

    if (!isStartC || !isEndC || !oosStartC || !oosEndC) continue;

    const isStartDate = isStartC.date;
    const isEndDate = isEndC.date;
    const oosStartDate = oosStartC.date;
    const oosEndDate = oosEndC.date;

    // 1. Run in-sample optimization to find the best parameters on this window
    const optimizedParams = runInSampleOptimization(candles, strategyType, risk, isStartDate, isEndDate);

    // 2. Compute finalized IS performance metrics
    const isResult = runBacktest(candles, strategyType, optimizedParams, { ...risk, startingCapital: 100000 }, isStartDate, isEndDate);

    // 3. Run those optimized parameters on the UNSEEN forward out-of-sample window
    const oosResult = runBacktest(candles, strategyType, optimizedParams, { ...risk, startingCapital: 100000 }, oosStartDate, oosEndDate);

    // 4. Compute efficiency
    // Walk-Forward Efficiency (WFE) is Out-of-sample Return % annualized relative to In-sample Return % annualized.
    // Simplifying: (OOS Return / 0.5 Year) / (IS Return / 2 Years) -> OOS Return / (IS Return / 4)
    // If IS return is negative or close to zero, we bound it gracefully to avoid NaNs.
    const isAnnualized = isResult.percentageReturn / 2.0;
    const oosAnnualized = oosResult.percentageReturn / 0.5;

    let efficiencyPct = 0;
    if (isAnnualized > 0) {
      efficiencyPct = Number(((oosAnnualized / isAnnualized) * 100).toFixed(1));
    } else if (isAnnualized <= 0 && oosAnnualized > 0) {
      efficiencyPct = 120; // Exceptionally high because it rescued a negative in-sample period
    } else {
      efficiencyPct = 0; // Both flat/negative
    }

    efficiencyPct = Math.min(250, Math.max(0, efficiencyPct)); // Bound between 0% and 250%

    segments.push({
      windowIndex: s + 1,
      inSampleStart: isStartDate,
      inSampleEnd: isEndDate,
      outOfSampleStart: oosStartDate,
      outOfSampleEnd: oosEndDate,
      optimizedParams,
      inSampleReturnPct: Number(isResult.percentageReturn.toFixed(1)),
      inSampleDrawdown: Number(isResult.maxDrawdown.toFixed(1)),
      outOfSampleReturnPct: Number(oosResult.percentageReturn.toFixed(1)),
      outOfSampleDrawdown: Number(oosResult.maxDrawdown.toFixed(1)),
      efficiencyPct,
      isSuccess: oosResult.percentageReturn > 0,
    });
  }

  return segments;
}

// ==========================================
// ROBUSTNESS SCORE CALCULATOR
// ==========================================

export function calculateRobustness(
  fullResult: BacktestResult,
  wfaSegments: WfaSegment[],
  strategyType: StrategyType,
  params: any,
  candles: Candle[],
  risk: RiskConfig
): RobustnessScore {
  
  // 1. Walk-Forward Efficiency Score (25pts)
  // Average WFE across windows. Target average efficiency is > 50-60%.
  // efficiencyPct values represent out-of-sample return compared to in-sample.
  const avgWfe = wfaSegments.reduce((sum, seg) => sum + seg.efficiencyPct, 0) / (wfaSegments.length || 1);
  let wfeScore = 0;
  let wfeMessage = "";
  if (avgWfe >= 80) {
    wfeScore = 25;
    wfeMessage = `Exceptional walk-forward efficiency (${avgWfe.toFixed(1)}%). Zero parameters degradation.`;
  } else if (avgWfe >= 50) {
    wfeScore = 18 + ((avgWfe - 50) / 30) * 7;
    wfeMessage = `Good walk-forward efficiency (${avgWfe.toFixed(1)}%). Performance carries over reliably.`;
  } else if (avgWfe >= 25) {
    wfeScore = 10 + ((avgWfe - 25) / 25) * 8;
    wfeMessage = `Moderate efficiency degradation (${avgWfe.toFixed(1)}%). High likelihood of overfitting.`;
  } else {
    wfeScore = Math.max(0, (avgWfe / 25) * 10);
    wfeMessage = `Poor walk-forward efficiency (${avgWfe.toFixed(1)}%). Code suffers from curve-fitting.`;
  }

  // 2. Consistency Score (25pts)
  // Does it perform across most windows, or only one lucky period?
  // Calculated as: (Winning OOS segments / Total segments) * 25
  const winningSegments = wfaSegments.filter((seg) => seg.outOfSampleReturnPct > -0.5).length; // Break-even or win
  const winningSegmentRatio = winningSegments / (wfaSegments.length || 1);
  const consistencyScore = winningSegmentRatio * 25;
  const hWinPct = winningSegmentRatio * 100;
  let consistencyMsg = "";
  if (winningSegmentRatio >= 0.8) {
    consistencyMsg = `Excellent consistency: ${winningSegments}/${wfaSegments.length} windows achieved positive return (${hWinPct.toFixed(0)}%).`;
  } else if (winningSegmentRatio >= 0.6) {
    consistencyMsg = `Stable consistency: ${winningSegments}/${wfaSegments.length} windows ended positive (${hWinPct.toFixed(0)}%).`;
  } else if (winningSegmentRatio >= 0.4) {
    consistencyMsg = `Vulnerable consistency: only ${winningSegments}/${wfaSegments.length} windows ended positive (${hWinPct.toFixed(0)}%).`;
  } else {
    consistencyMsg = `Critical inconsistencies: ${winningSegments}/${wfaSegments.length} windows ended positive (${hWinPct.toFixed(0)}%). Unstable.`;
  }

  // 3. Parameter Sensitivity Score (25pts)
  // Does a small change in parameters destroy the results?
  // Let's disturb the current parameters slightly (5 variations), measure variance of Returns.
  // Standard deviation of adjacent parameter return variance: Low variation = Robust.
  let returnsGrid: number[] = [];
  
  if (strategyType === "SMA") {
    const variations = [
      { fastPeriod: params.fastPeriod - 2, slowPeriod: params.slowPeriod - 5 },
      { fastPeriod: params.fastPeriod - 1, slowPeriod: params.slowPeriod - 2 },
      { fastPeriod: params.fastPeriod,     slowPeriod: params.slowPeriod },
      { fastPeriod: params.fastPeriod + 1, slowPeriod: params.slowPeriod + 2 },
      { fastPeriod: params.fastPeriod + 2, slowPeriod: params.slowPeriod + 5 },
    ];
    for (const v of variations) {
      if (v.fastPeriod >= v.slowPeriod || v.fastPeriod < 2) continue;
      const res = runBacktest(candles, "SMA", v, risk);
      returnsGrid.push(res.percentageReturn);
    }
  } else if (strategyType === "RSI") {
    const variations = [
      { period: params.period - 2, oversold: params.oversold - 2, overbought: params.overbought + 2 },
      { period: params.period - 1, oversold: params.oversold - 1, overbought: params.overbought + 1 },
      { period: params.period,     oversold: params.oversold,     overbought: params.overbought },
      { period: params.period + 1, oversold: params.oversold + 1, overbought: params.overbought - 1 },
      { period: params.period + 2, oversold: params.oversold + 2, overbought: params.overbought - 2 },
    ];
    for (const v of variations) {
      if (v.period < 2) continue;
      const res = runBacktest(candles, "RSI", v, risk);
      returnsGrid.push(res.percentageReturn);
    }
  } else if (strategyType === "MACD") {
    const variations = [
      { fastPeriod: params.fastPeriod - 1, slowPeriod: params.slowPeriod - 2, signalPeriod: params.signalPeriod - 1 },
      { fastPeriod: params.fastPeriod - 1, slowPeriod: params.slowPeriod - 1, signalPeriod: params.signalPeriod },
      { fastPeriod: params.fastPeriod,     slowPeriod: params.slowPeriod,     signalPeriod: params.signalPeriod },
      { fastPeriod: params.fastPeriod + 1, slowPeriod: params.slowPeriod + 1, signalPeriod: params.signalPeriod },
      { fastPeriod: params.fastPeriod + 1, slowPeriod: params.slowPeriod + 2, signalPeriod: params.signalPeriod + 1 },
    ];
    for (const v of variations) {
      if (v.fastPeriod >= v.slowPeriod || v.fastPeriod < 2) continue;
      const res = runBacktest(candles, "MACD", v, risk);
      returnsGrid.push(res.percentageReturn);
    }
  } else if (strategyType === "BB") {
    const variations = [
      { period: params.period - 2, stdDev: params.stdDev - 0.2 },
      { period: params.period - 1, stdDev: params.stdDev - 0.1 },
      { period: params.period,     stdDev: params.stdDev },
      { period: params.period + 1, stdDev: params.stdDev + 0.1 },
      { period: params.period + 2, stdDev: params.stdDev + 0.2 },
    ];
    for (const v of variations) {
      if (v.period < 2 || v.stdDev <= 0.1) continue;
      const res = runBacktest(candles, "BB", v, risk);
      returnsGrid.push(res.percentageReturn);
    }
  }

  const baseReturn = fullResult.percentageReturn;
  let devSum = 0;
  for (const r of returnsGrid) {
    devSum += Math.pow(r - baseReturn, 2);
  }
  const variancePct = returnsGrid.length === 0 ? 0 : Math.sqrt(devSum / returnsGrid.length);
  
  let sensitivityScore = 0;
  let sensitivityMsg = "";
  if (variancePct < 5) {
    sensitivityScore = 25;
    sensitivityMsg = `Completely stable parameters: returns fluctuate minimally (variance of ${variancePct.toFixed(1)}%).`;
  } else if (variancePct < 15) {
    sensitivityScore = 18 + ((15 - variancePct) / 10) * 7;
    sensitivityMsg = `Highly stable parameters: small changes yield tight results (variance of ${variancePct.toFixed(1)}%).`;
  } else if (variancePct < 30) {
    sensitivityScore = 10 + ((30 - variancePct) / 15) * 8;
    sensitivityMsg = `Moderate parameter sensitivity: returns drift under parameter changes (variance of ${variancePct.toFixed(1)}%).`;
  } else {
    sensitivityScore = Math.max(0, 10 - ((variancePct - 30) / 40) * 10);
    sensitivityMsg = `Extremely hyper-sensitive parameters! Danger of peak-fitting (variance of ${variancePct.toFixed(1)}%).`;
  }

  // 4. Drawdown Control Score (25pts)
  // Max Drawdown: < 15% is excellent (25 pts), > 40% is highly dangerous (0 pts)
  const maxDD = fullResult.maxDrawdown;
  let ddScore = 0;
  let ddMsg = "";
  if (maxDD <= 10) {
    ddScore = 25;
    ddMsg = `Pristine risk profile: maximum drawdown is very low and fully controlled (${maxDD.toFixed(1)}%).`;
  } else if (maxDD <= 20) {
    ddScore = 18 + ((20 - maxDD) / 10) * 7;
    ddMsg = `Strong risk management: drawdown level is reasonable for daily trading (${maxDD.toFixed(1)}%).`;
  } else if (maxDD <= 35) {
    ddScore = 10 + ((35 - maxDD) / 15) * 8;
    ddMsg = `Aggressive risk profile: maximum drawdown is significant (${maxDD.toFixed(1)}%). Consider trailing stop-loss.`;
  } else {
    ddScore = Math.max(0, 10 - ((maxDD - 35) / 35) * 10);
    ddMsg = `Stressed risk profile: maximum peak-to-trough drop is alarming (${maxDD.toFixed(1)}%). Fails safe thresholds.`;
  }

  const rawTotal = wfeScore + consistencyScore + sensitivityScore + ddScore;
  const totalScore = Number(Math.min(100, Math.max(10, rawTotal)).toFixed(1));

  return {
    totalScore,
    walkForwardEfficiencyScore: Number(wfeScore.toFixed(1)),
    consistencyScore: Number(consistencyScore.toFixed(1)),
    parameterSensitivityScore: Number(sensitivityScore.toFixed(1)),
    drawdownControlScore: Number(ddScore.toFixed(1)),
    methodologyDetails: {
      wfeValue: Number(avgWfe.toFixed(1)),
      wfeMessage: wfeMessage,
      winningWindowsRatio: Number(winningSegmentRatio.toFixed(2)),
      winningWindowsMessage: consistencyMsg,
      parameterVariancePct: Number(variancePct.toFixed(1)),
      parameterVarianceMessage: sensitivityMsg,
      maxDrawdownValue: Number(maxDD.toFixed(1)),
      maxDrawdownMessage: ddMsg,
    },
  };
}
