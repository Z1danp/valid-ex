import numpy as np
import os
import sys
from scipy.stats import linregress
from typing import List, Dict, Any, Union

def create_calibration(
    x: Union[List[float], np.ndarray], 
    y: Union[List[float], np.ndarray]
) -> Dict[str, Any]:
    """
    Menghitung regresi kalibrasi linear (OLS), residual, dan batas deteksi (LOD/LOQ)
    berdasarkan standar ISO/IEC 17025 dan template validasi laboratorium ICP-OES.

    Parameters:
    -----------
    x : List[float] atau np.ndarray
        Array konsentrasi larutan standar (ppm atau mg/L).
    y : List[float] atau np.ndarray
        Array respon detektor (counts per second / c/s).

    Returns:
    --------
    Dict[str, Any] berisi:
        - x, y: array input standar
        - slope: kemiringan garis regresi (m)
        - intercept: titik potong sumbu y (c)
        - r_squared: koefisien determinasi (R^2)
        - y_pred: nilai prediksi y' = m*x + c
        - residuals: galat y - y'
        - residuals_squared: kuadrat galat (y - y')^2
        - ss_res: total kuadrat galat sum((y - y')^2)
        - df: derajat kebebasan (N - 2)
        - s_b: standar deviasi residual s_{y/x}
        - lod: limit of detection (3 * s_b / slope)
        - loq: limit of quantitation (10 * s_b / slope)
    """
    x_arr = np.asarray(x, dtype=float)
    y_arr = np.asarray(y, dtype=float)

    # Invarian 1: Panjang array harus identik
    if len(x_arr) != len(y_arr):
        raise ValueError(
            f"Length of x and y must be identical. Got len(x)={len(x_arr)}, len(y)={len(y_arr)}."
        )

    # Invarian 2: Derajat kebebasan minimal (N >= 3)
    n = len(x_arr)
    if n < 3:
        raise ValueError(
            f"Minimum 3 points required to calculate residual degrees of freedom (df = N - 2). Got N={n}."
        )

    # 1. Regresi Linear OLS via SciPy (identik dengan formula Excel: SLOPE, INTERCEPT, RSQ)
    reg = linregress(x_arr, y_arr)
    slope = float(reg.slope)
    intercept = float(reg.intercept)
    r_squared = float(reg.rvalue ** 2)

    # Invarian 3: Slope harus positif (intensitas harus naik seiring kenaikan konsentrasi)
    if slope <= 0:
        raise ValueError(
            f"Slope must be positive for calibration curve. Got slope={slope}."
        )

    # 2. Nilai prediksi y' = m*x + c
    y_pred = slope * x_arr + intercept

    # 3. Residual dan kuadrat residual
    residuals = y_arr - y_pred
    residuals_squared = residuals ** 2
    ss_res = float(np.sum(residuals_squared))

    # 4. Derajat kebebasan dan Standar Deviasi Residual (S_B / s_{y/x})
    df = n - 2
    s_b = float(np.sqrt(ss_res / df))

    # 5. Penentuan LOD (3σ) dan LOQ (10σ) terkonversi ke satuan konsentrasi
    lod = float(3.0 * (s_b / slope))
    loq = float(10.0 * (s_b / slope))

    return {
        "x": x_arr.tolist(),
        "y": y_arr.tolist(),
        "slope": slope,
        "intercept": intercept,
        "r_squared": r_squared,
        "y_pred": y_pred.tolist(),
        "residuals": residuals.tolist(),
        "residuals_squared": residuals_squared.tolist(),
        "ss_res": ss_res,
        "df": df,
        "s_b": s_b,
        "lod": lod,
        "loq": loq,
    }

x = [0.0, 0.1, 0.3, 0.5, 0.7, 0.8, 1.0]
y = [33.25, 2279.39, 5403.57, 9132.67, 12614.31, 13896.79, 17610.61]

result = create_calibration(x, y)

# print(result)