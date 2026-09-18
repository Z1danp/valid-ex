from calibration import result
import pandas as pd

samples = [
    {
        "name": "Sampel 1",
        "weight": 0.7290,
        "volume": 50.0,
        "df": 1.0,
        "conc": 0.000
    },
    {
        "name": "Sampel 2",
        "weight": 0.1242,
        "volume": 50.0,
        "df": 100.0,
        "conc": 0.21
    },
    {
        "name": "Sampel 3",
        "weight": 0.1414,
        "volume": 50.0,
        "df": 100.0,
        "conc": 0.26
    },
    {
        "name": "Sampel 4",
        "weight": 0.0955,
        "volume": 50.0,
        "df": 100.0,
        "conc": 0.25
    },
    {
        "name": "Sampel 5",
        "weight": 0.0909,
        "volume": 50.0,
        "df": 100.0,
        "conc": 0.37
    },
]

def calculate_sample_concentration(
    sample_conc: float,
    blank_conc: float,
    volume_ml: float,
    weight_g: float,
    df: float = 1.0
) -> float:
    """
    TODO: Driver (User) implements this function!
    Rumus: ((sample_conc - blank_conc) * volume_ml * df) / weight_g
    Guardrails:
    - weight_g harus > 0 (raise ValueError("Weight must be positive"))
    - volume_ml harus > 0 (raise ValueError("Volume must be positive"))
    - jika (sample_conc - blank_conc) < 0, return 0.0
    """
    if volume_ml <= 0:
        raise ValueError(
            f'Volume must be positive'
        )
    net_conc = sample_conc - blank_conc
    if net_conc <= 0:
        return 0.0

    conc = (net_conc * volume_ml * 10**-3 * df) / (weight_g * 10**-3)
    return conc


def get_detection_status(sample_conc: float, lod: float, loq: float) -> str:
    """
    TODO: Driver (User) implements this function!
    Guardrails:
    - jika sample_conc < lod -> return "ND"
    - jika lod <= sample_conc < loq -> return "<LOQ"
    - jika sample_conc >= loq -> return "QUANTIFIABLE"
    """
    if sample_conc < lod:
        return f'ND'
    if lod <= sample_conc and sample_conc < loq:
        return f'LOQ'
    if sample_conc >= loq:
        f'QUANTIFIABLE'

konsentrasi = []
for sample in samples:
    hasil = calculate_sample_concentration(sample["conc"], 0, 50, sample["weight"], sample["df"])
    konsentrasi.append(hasil)

df_all = pd.DataFrame(samples)
df_all["conc_mg/kg"] = konsentrasi
print(df_all)