import { Candle } from "../types";

// Seeded random number generator to make datasets deterministic and reproducible
function createRandom(seedString: string) {
  let h = 1500450271;
  for (let i = 0; i < seedString.length; i++) {
    h = Math.imul(h ^ seedString.charCodeAt(i), 2246822507);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export interface TickerInfo {
  symbol: string;
  name: string;
  startingPrice: number;
  volatility: number; // Daily standard deviation scale
  drift: number;      // Annual growth drift
  jumpProbability: number;
}

export const LISTED_TICKERS: TickerInfo[] = [
  { symbol: "AAPL", name: "Apple Inc.", startingPrice: 125, volatility: 0.015, drift: 0.12, jumpProbability: 0.005 },
  { symbol: "MSFT", name: "Microsoft Corp.", startingPrice: 240, volatility: 0.014, drift: 0.15, jumpProbability: 0.004 },
  { symbol: "TSLA", name: "Tesla Inc.", startingPrice: 200, volatility: 0.028, drift: 0.10, jumpProbability: 0.012 },
  { symbol: "NVDA", name: "Nvidia Corp.", startingPrice: 15, volatility: 0.030, drift: 0.65, jumpProbability: 0.015 }, // Huge tech run
  { symbol: "INFY", name: "Infosys Ltd.", startingPrice: 18, volatility: 0.016, drift: 0.08, jumpProbability: 0.003 },
  { symbol: "RELIANCE", name: "Reliance Industries Ltd.", startingPrice: 2000, volatility: 0.012, drift: 0.11, jumpProbability: 0.003 },
];

/**
 * Generates 5 years of daily candle data ending on May 23, 2026.
 * Generates exactly 1260 daily bars (approx 252 trading days/year)
 */
export function generateHistoricalCandles(ticker: string): Candle[] {
  const info = LISTED_TICKERS.find((t) => t.symbol === ticker) || LISTED_TICKERS[0];
  const rand = createRandom(info.symbol + "_v5");

  const totalDays = 1260;
  const candles: Candle[] = [];
  
  // Starting date is approx 5 years prior to late May 2026
  let currentDate = new Date("2021-05-24");
  let currentPrice = info.startingPrice;

  for (let i = 0; i < totalDays; i++) {
    // Standard Geometric Brownian Motion step
    const dt = 1 / 252;
    // Box-Muller transform for normal random
    const u1 = rand();
    const u2 = rand();
    const z = Math.sqrt(-2.0 * Math.log(u1 || 0.0001)) * Math.cos(2.0 * Math.PI * u2);

    // Drifts and shock
    const annualReturn = info.drift;
    const vol = info.volatility;
    const dailyReturn = (annualReturn - 0.5 * vol * vol) * dt + vol * Math.sqrt(dt) * z;
    
    let priceMultiplier = Math.exp(dailyReturn);
    
    // Jump probability (e.g. earnings gaps)
    if (rand() < info.jumpProbability) {
      const jumpSign = rand() > 0.45 ? 1 : -1;
      const jumpSize = rand() * 0.06 + 0.02; // 2% to 8% gap
      priceMultiplier *= (1 + jumpSign * jumpSize);
    }

    const prevClose = currentPrice;
    currentPrice = Math.max(1.0, currentPrice * priceMultiplier);

    // Intra-day movement calculation
    const dailyVol = vol * 1.5;
    const openGap = prevClose * (1 + (rand() - 0.5) * dailyVol * 0.4);
    const dayOpen = Math.max(0.5, openGap);
    
    // Low and High bounds
    const maxMove = Math.max(dayOpen, currentPrice);
    const minMove = Math.min(dayOpen, currentPrice);
    
    const dayHigh = maxMove * (1 + rand() * dailyVol * 0.8);
    const dayLow = minMove * (1 - rand() * dailyVol * 0.8);
    const dayVolume = Math.round((5000000 + rand() * 15000000) * (ticker === "RELIANCE" ? 0.3 : 1));

    // Format Date string
    const dateStr = currentDate.toISOString().split("T")[0];

    candles.push({
      date: dateStr,
      open: Number(dayOpen.toFixed(2)),
      high: Number(dayHigh.toFixed(2)),
      low: Number(dayLow.toFixed(2)),
      close: Number(currentPrice.toFixed(2)),
      volume: dayVolume,
    });

    // Advance to next business day (skip Sat and Sun)
    do {
      currentDate.setDate(currentDate.getDate() + 1);
    } while (currentDate.getDay() === 0 || currentDate.getDay() === 6);
  }

  return candles;
}

/**
 * Parses user uploaded CSV file data (expecting yfinance export structure)
 */
export function parseYFinanceCSV(csvText: string): Candle[] {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return [];

  // Identify column headers
  const headers = lines[0].toLowerCase().split(",");
  const dateIdx = headers.indexOf("date");
  const openIdx = headers.indexOf("open");
  const highIdx = headers.indexOf("high");
  const lowIdx = headers.indexOf("low");
  const closeIdx = headers.indexOf("close");
  const adjCloseIdx = headers.indexOf("adj close");
  const volIdx = headers.indexOf("volume");

  if (dateIdx === -1 || closeIdx === -1) {
    throw new Error("Invalid yfinance CSV: 'Date' and 'Close' columns are required.");
  }

  const candles: Candle[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Handle comma splits taking into account quotes if any (usually simple in Yahoo stock files)
    const cols = line.split(",");
    if (cols.length < headers.length) continue;

    const dateStr = cols[dateIdx]?.trim();
    
    // We prefer adjusted close if present to correctly account for dividends and stock splits,
    // which the yfinance instructions recommend standard trading developers use for backtesting!
    const targetCloseIdx = adjCloseIdx !== -1 && cols[adjCloseIdx] ? adjCloseIdx : closeIdx;
    
    const open = openIdx !== -1 ? Number(cols[openIdx]) : Number(cols[closeIdx]);
    const high = highIdx !== -1 ? Number(cols[highIdx]) : Number(cols[closeIdx]);
    const low = lowIdx !== -1 ? Number(cols[lowIdx]) : Number(cols[closeIdx]);
    const close = Number(cols[targetCloseIdx]);
    const volume = volIdx !== -1 ? Math.round(Number(cols[volIdx])) : 1000000;

    if (!dateStr || isNaN(close)) continue;

    candles.push({
      date: dateStr,
      open: isNaN(open) ? close : Number(open.toFixed(2)),
      high: isNaN(high) ? close : Number(high.toFixed(2)),
      low: isNaN(low) ? close : Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: isNaN(volume) ? 1000000 : volume,
    });
  }

  // Sort chronologically in case order got swapped
  return candles.sort((a, b) => a.date.localeCompare(b.date));
}
