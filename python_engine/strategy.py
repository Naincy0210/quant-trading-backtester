
import backtrader as bt

class MovingAverageRSIStrategy(bt.Strategy):
    params = (
        ("short_window", 50),
        ("long_window", 200),
        ("rsi_period", 14),
        ("rsi_buy", 55),
        ("stop_loss", 0.05),
    )

    def __init__(self):
        self.short_ma = bt.indicators.SimpleMovingAverage(
            self.data.close, period=self.params.short_window
        )

        self.long_ma = bt.indicators.SimpleMovingAverage(
            self.data.close, period=self.params.long_window
        )

        self.rsi = bt.indicators.RSI(
            self.data.close, period=self.params.rsi_period
        )

        self.crossover = bt.indicators.CrossOver(
            self.short_ma, self.long_ma
        )

        self.buy_price = None

    def next(self):
        if not self.position:
            if self.crossover > 0 and self.rsi > self.params.rsi_buy:
                self.buy()
                self.buy_price = self.data.close[0]

        else:
            stop_price = self.buy_price * (1 - self.params.stop_loss)

            if self.crossover < 0 or self.data.close[0] < stop_price:
                self.sell()
