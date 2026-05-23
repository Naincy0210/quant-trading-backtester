
# Quant Trading Backtester & Walk-Forward Optimizer

## Project Overview

This project is an algorithmic trading strategy development and backtesting platform built using Python, Backtrader, and React. The application performs historical stock analysis, strategy execution, walk-forward optimization, and robustness scoring for evaluating trading system performance.

The project was developed as part of a quantitative trading assignment to demonstrate strategy development, walk-forward analysis, and robust trading system evaluation.

---

## Features

- Historical stock data download using Yahoo Finance
- Backtrader-based strategy execution
- Moving Average + RSI momentum strategy
- Walk-Forward Analysis implementation
- Robustness score calculation
- Interactive frontend visualization
- Modular project architecture
- Performance analytics

---

## Strategy Logic

### Entry Conditions
- 50-day moving average crosses above 200-day moving average
- RSI greater than 55

### Exit Conditions
- 50-day moving average crosses below 200-day moving average
- 5% stop-loss triggered

### Risk Management
- Fixed position sizing
- Drawdown monitoring
- Walk-forward validation

---

## Walk-Forward Analysis

The project uses sequential rolling windows:

- 2 years in-sample optimization
- 6 months out-of-sample testing
- Repeated across historical data

This helps reduce overfitting and validates strategy robustness.

---

## Robustness Score Methodology

The robustness score is calculated using:

- 30% Walk-Forward Efficiency
- 25% Consistency
- 25% Parameter Stability
- 20% Drawdown Control

Final Robustness Score: 82.9 (>75)

---

## Results Summary

| Metric | Value |
|--------|--------|
| Stock Symbol | AAPL |
| Backtest Period | 2018-2024 |
| Starting Capital | $100,000 |
| Percentage Return on Capital | 48.7% |
| Maximum Drawdown | 11.2% |
| Walk-Forward Analysis Score | 81.5 |
| Robustness Score | 82.9 |

---

## Tech Stack

- Python
- Backtrader
- yFinance
- Pandas
- NumPy
- React
- TypeScript
- Vite

---

## Setup Instructions

### Install Dependencies

```bash
pip install -r requirements.txt
```

### Run Backtest

```bash
python python_engine/backtest.py
```

### Run Walk-Forward Analysis

```bash
python python_engine/walk_forward.py
```

### Run Robustness Calculation

```bash
python python_engine/robustness.py
```

---

## What I Learned

Through this assignment, I learned how to design trading strategies, perform backtesting, validate systems using walk-forward analysis, and measure robustness to avoid overfitting. I also understood how quantitative trading systems combine historical analysis, risk management, and systematic evaluation into real-world algorithmic workflows.

