
import backtrader as bt
import yfinance as yf
from strategy import MovingAverageRSIStrategy

symbol = "AAPL"

data = yf.download(symbol, start="2018-01-01", end="2024-12-31")

feed = bt.feeds.PandasData(dataname=data)

cerebro = bt.Cerebro()

cerebro.addstrategy(MovingAverageRSIStrategy)

cerebro.adddata(feed)

starting_capital = 100000

cerebro.broker.setcash(starting_capital)

cerebro.broker.setcommission(commission=0.001)

print("Starting Portfolio Value:", cerebro.broker.getvalue())

results = cerebro.run()

final_value = cerebro.broker.getvalue()

returns = ((final_value - starting_capital) / starting_capital) * 100

print("Final Portfolio Value:", final_value)
print("Percentage Return:", round(returns, 2), "%")

cerebro.plot()
