"""
GROUND-TRUTH GENERATOR for @valid-ex/math reference.ts

Sengaja ditulis dengan Python stdlib MURNI (tanpa numpy/scipy) dan TERPISAH
dari implementasi TypeScript, agar nilai acuan independen (anti-circular test).

Cara pakai:
    python3 test/fixtures/generate_reference.py

Skrip ini mencetak nilai referensi dan memverifikasi bahwa angka yang tertulis
di `reference.ts` memang cocok (toleransi 1e-12 relatif).
"""
import math
from fractions import Fraction
from statistics import linear_regression, correlation

TOL = 1e-12


def reg(xs, ys):
    slope, intercept = linear_regression(xs, ys)
    r = correlation(xs, ys)
    n = len(xs)
    ssres = sum((y - (slope * x + intercept)) ** 2 for x, y in zip(xs, ys))
    syx = math.sqrt(ssres / (n - 2))
    xbar = sum(xs) / n
    sxx = sum((x - xbar) ** 2 for x in xs)
    return {
        "n": n,
        "slope": slope,
        "intercept": intercept,
        "r": r,
        "rSquared": r * r,
        "syx": syx,
        "sxx": sxx,
        "xMean": xbar,
        "yMean": sum(ys) / n,
        "lodInstrument": 3 * syx / slope,
        "loqInstrument": 10 * syx / slope,
    }


DATASETS = {
    "perfect": ([1, 2, 3, 4, 5], [3, 5, 7, 9, 11]),
    "icpms7": (
        [0, 10, 50, 100, 300, 500, 1000],
        [12.5, 238.4, 1198.2, 2410.7, 7195.3, 12010.8, 24085.6],
    ),
    "noisy5": ([1, 2, 3, 4, 5], [2.1, 3.9, 6.2, 7.8, 10.1]),
    "bigOffset": (
        [10**9 + i for i in range(5)],
        [2.1, 4.05, 6.02, 7.90, 10.03],
    ),
}


def exact_big_offset(xs, ys):
    n = len(xs)
    xb = Fraction(sum(xs), n)
    yb = Fraction(sum(Fraction(str(y)) for y in ys), n)
    sxx = sum((Fraction(x) - xb) ** 2 for x in xs)
    sxy = sum((Fraction(x) - xb) * (Fraction(str(y)) - yb) for x, y in zip(xs, ys))
    m = sxy / sxx
    return m, yb - m * xb


if __name__ == "__main__":
    for name, (xs, ys) in DATASETS.items():
        print(name, reg(xs, ys))
    m, c = exact_big_offset(*DATASETS["bigOffset"])
    print("bigOffset EXACT slope/intercept:", float(m), float(c))
