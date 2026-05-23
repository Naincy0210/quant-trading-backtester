
def robustness_score(wfa, consistency, parameter_stability, drawdown_control):
    score = (
        (0.30 * wfa) +
        (0.25 * consistency) +
        (0.25 * parameter_stability) +
        (0.20 * drawdown_control)
    )

    return round(score, 2)

final_score = robustness_score(
    wfa=82,
    consistency=85,
    parameter_stability=80,
    drawdown_control=84
)

print("Robustness Score:", final_score)
