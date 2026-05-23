
import pandas as pd

def calculate_wfa_score(in_sample_returns, out_sample_returns):
    efficiencies = []

    for ins, outs in zip(in_sample_returns, out_sample_returns):
        if ins == 0:
            efficiencies.append(0)
        else:
            efficiencies.append((outs / ins) * 100)

    return round(sum(efficiencies) / len(efficiencies), 2)

in_sample = [12, 15, 10, 14]
out_sample = [10, 13, 8, 12]

score = calculate_wfa_score(in_sample, out_sample)

print("Walk Forward Analysis Score:", score)
