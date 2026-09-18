import pytest
from src.sample_quant import calculate_sample_concentration, get_detection_status

def test_calculate_sample_concentration_with_lab_template_samples():
    """
    Ground-Truth test anchored to Samples 1 to 5 from template-olah-data.xlsx.
    Formula: ((Conc_sample - Conc_blank) * Volume * dF) / Weight
    """
    blank_conc = 0.0  # Cell E6

    # Sampel 1: Conc = 0.0 mg/L -> result must be 0.0 mg/kg
    res1 = calculate_sample_concentration(
        sample_conc=0.0,
        blank_conc=blank_conc,
        volume_ml=50.0,
        weight_g=0.729,
        df=1.0
    )
    assert res1 == 0.0

    # Sampel 2: Conc = 0.21 mg/L, W = 0.1242 g, V = 50 mL, dF = 100
    # Expected: (0.21 - 0) * 50 * 100 / 0.1242 = 8454.106... mg/kg
    res2 = calculate_sample_concentration(
        sample_conc=0.21,
        blank_conc=blank_conc,
        volume_ml=50.0,
        weight_g=0.1242,
        df=100.0
    )
    assert pytest.approx(res2, rel=1e-4) == 8454.1063

    # Sampel 3: Conc = 0.26 mg/L, W = 0.1414 g, V = 50 mL, dF = 100
    # Expected: (0.26 - 0) * 50 * 100 / 0.1414 = 9193.776... mg/kg
    res3 = calculate_sample_concentration(
        sample_conc=0.26,
        blank_conc=blank_conc,
        volume_ml=50.0,
        weight_g=0.1414,
        df=100.0
    )
    assert pytest.approx(res3, rel=1e-4) == 9193.7765


def test_negative_net_concentration_returns_zero():
    """
    Guardrail: In lab template, IF((E8 - E$6) < 0, "0.00", ...)
    When sample signal is slightly below the digestion blank, result is 0.0.
    """
    result = calculate_sample_concentration(
        sample_conc=0.005,
        blank_conc=0.010,  # Blank is higher than sample
        volume_ml=50.0,
        weight_g=0.5,
        df=1.0
    )
    assert result == 0.0


def test_invalid_weight_or_volume_raises_value_error():
    """Physical constraint: weight and volume must be strictly positive."""
    with pytest.raises(ValueError, match="Weight must be positive"):
        calculate_sample_concentration(0.2, 0.0, 50.0, weight_g=0.0, df=1.0)

    with pytest.raises(ValueError, match="Volume must be positive"):
        calculate_sample_concentration(0.2, 0.0, volume_ml=-10.0, weight_g=0.5, df=1.0)


def test_get_detection_status_iso17025():
    """
    Evaluates regulatory reporting zone:
    - < LOD -> ND (Not Detected)
    - LOD <= x < LOQ -> <LOQ (Trace)
    - >= LOQ -> QUANTIFIABLE
    """
    lod = 0.0405
    loq = 0.1351

    assert get_detection_status(sample_conc=0.02, lod=lod, loq=loq) == "ND"
    assert get_detection_status(sample_conc=0.08, lod=lod, loq=loq) == "<LOQ"
    assert get_detection_status(sample_conc=0.21, lod=lod, loq=loq) == "QUANTIFIABLE"
