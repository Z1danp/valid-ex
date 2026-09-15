import pytest
import numpy as np
from src.calibration import create_calibration

def test_create_calibration_with_mo_lab_data():
    """
    Ground-Truth test anchored directly to the sanitized ICP-OES Mo dataset
    from template-olah-data.xlsx.
    """
    x = [0.0, 0.1, 0.3, 0.5, 0.7, 0.8, 1.0]
    y = [33.25, 2279.39, 5403.57, 9132.67, 12614.31, 13896.79, 17610.61]

    result = create_calibration(x, y)

    # 1. Slope & Intercept check
    # Template has slope ~ 17330 and intercept ~ 292.67
    assert pytest.approx(result["slope"], rel=1e-3) == 17330.13
    assert pytest.approx(result["intercept"], rel=1e-2) == 292.67

    # 2. Linearity check (r^2 >= 0.995)
    assert result["r_squared"] >= 0.995
    assert pytest.approx(result["r_squared"], rel=1e-4) == 0.9989

    # 3. Residuals check
    # Sum of raw residuals must be zero (OLS normal equations property)
    assert pytest.approx(sum(result["residuals"]), abs=1e-6) == 0.0

    # 4. Standard Deviation of Residuals (S_B / s_y/x)
    # Degrees of freedom df = 7 - 2 = 5
    assert result["df"] == 5
    # Excel W12: 234.130669
    assert pytest.approx(result["s_b"], rel=1e-4) == 234.1307
    # Excel X12 (LOD): 0.040530
    assert pytest.approx(result["lod"], rel=1e-4) == 0.04053
    # Excel Y12 (LOQ): 0.135101
    assert pytest.approx(result["loq"], rel=1e-4) == 0.13510


def test_mismatched_lengths():
    """Validates that arrays of different lengths are rejected."""
    x = [0.1, 0.5, 1.0]
    y = [1000.0, 5000.0]
    with pytest.raises(ValueError, match="Length of x and y must be identical"):
        create_calibration(x, y)


def test_insufficient_points_raises_value_error():
    """
    Degrees of freedom invariant: N must be at least 3
    because 2 points consume all degrees of freedom (df = N - 2 = 0).
    """
    x = [0.1, 0.5]
    y = [1000.0, 5000.0]
    with pytest.raises(ValueError, match="Minimum 3 points required"):
        create_calibration(x, y)


def test_negative_or_zero_slope_raises_value_error():
    """Validates that a flat or inverse calibration line is rejected."""
    x = [0.1, 0.5, 1.0]
    y = [5000.0, 5000.0, 5000.0]  # Flat line
    with pytest.raises(ValueError, match="Slope must be positive"):
        create_calibration(x, y)
