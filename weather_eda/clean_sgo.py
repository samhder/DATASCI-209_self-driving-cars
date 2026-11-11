"""Clean and harmonize the two NHTSA Standing General Order ADS incident files.

Input : the archive (incidents Jul 2021 to Jun 2025, old schema, 137 columns) and the current file
        (Apr 2025 onward, amended schema, 116 columns), as downloaded from nhtsa.gov.
Output: ads_clean.csv, one row per incident, with harmonized weather, surface, lighting,
        severity, time, and location fields plus a few derived columns used in the EDA.
"""
import sys, re
import pandas as pd
import numpy as np

ARCHIVE, CURRENT, OUT = sys.argv[1], sys.argv[2], sys.argv[3]

A = pd.read_csv(ARCHIVE, low_memory=False, encoding="utf-8-sig")
C = pd.read_csv(CURRENT, low_memory=False, encoding="utf-8-sig")
A["source_file"] = "archive_2021_2025"
C["source_file"] = "current_2025_on"

# 1. keep the latest version of each report, then one row per real-world incident
def latest(df):
    df = df.sort_values(["Report ID", "Report Version"]).drop_duplicates("Report ID", keep="last")
    return df.drop_duplicates("Same Incident ID", keep="first")
A, C = latest(A), latest(C)

# 2. harmonize column names between schemas
def yes(df, col):
    return df[col].astype(str).str.strip().str.upper().eq("Y") if col in df else pd.Series(False, index=df.index)

def primary_weather(df, flags):
    """flags: list of (column, label) in priority order; worst condition wins when several are ticked."""
    out = pd.Series("Unknown", index=df.index, dtype=object)
    for col, label in reversed(flags):   # iterate low priority first so high priority overwrites
        out = out.where(~yes(df, col), label)
    return out

A_flags = [("Weather - Snow", "Snow"), ("Weather - Rain", "Rain"), ("Weather - Fog/Smoke", "Fog or smoke"),
           ("Weather - Severe Wind", "Severe wind"), ("Weather - Cloudy", "Cloudy"), ("Weather - Clear", "Clear"),
           ("Weather - Other", "Other"), ("Weather - Unknown", "Unknown")]
C_flags = [("Weather - Snow", "Snow"), ("Weather - Rain", "Rain"), ("Weather - Fog/Smoke/Haze", "Fog or smoke"),
           ("Weather - Severe Wind", "Severe wind"), ("Weather - Dust Storm", "Other"), ("Weather - Severe Hurricane", "Other"),
           ("Weather - Structure-Indoor", "Other"), ("Weather - Cloudy", "Cloudy"), ("Weather - Partly Cloudy", "Cloudy"),
           ("Weather - Clear", "Clear"), ("Weather - Unk - See Narrative", "Unknown")]

A["weather"] = primary_weather(A, A_flags)
C["weather"] = primary_weather(C, C_flags)
# archive "Other" with text "Thundering" is rain weather in practice
A.loc[A["Weather - Other Text"].astype(str).str.contains("Thunder", case=False, na=False), "weather"] = "Rain"

A["surface_wet"] = A["Roadway Surface"].isin(["Wet", "Snow / Slush / Ice"])
C["surface_wet"] = yes(C, "Roadway-Wet Surface Condition")
A["surface"] = A["Roadway Surface"].fillna("Unknown").replace({"Snow / Slush / Ice": "Snow or ice", "Other, see Narrative": "Other"})
C["surface"] = np.where(C["surface_wet"], "Wet", np.where(yes(C, "Roadway-Unknown"), "Unknown", "Dry"))

A["lighting"] = A["Lighting"].fillna("Unknown").replace({"Dark - Unknown Lighting": "Dark - Lighted", "Other, see Narrative": "Unknown"})
C["lighting"] = np.nan   # not collected under the amended order

sev_map = {
    "No Injuries Reported": "No injury", "Property Damage. No Injured Reported": "No injury", "No Injured Reported": "No injury",
    "Minor": "Minor", "Minor W/O Hospitalization": "Minor", "Minor W/ Hospitalization": "Minor",
    "Moderate": "Moderate", "Moderate W/ Hospitalization": "Moderate", "Moderate W/O Hospitalization": "Moderate",
    "Serious": "Serious", "Serious W/ Hospitalization": "Serious", "Fatality": "Fatality", "Unknown": "Unknown",
}
for df in (A, C):
    df["severity"] = df["Highest Injury Severity Alleged"].map(sev_map).fillna("Unknown")
    df["any_injury"] = df["severity"].isin(["Minor", "Moderate", "Serious", "Fatality"])
    df["hospital_or_worse"] = df["Highest Injury Severity Alleged"].astype(str).str.contains("W/ Hospitalization|Serious|Fatality|Moderate", regex=True)

keep = ["Report ID", "Same Incident ID", "Reporting Entity", "Operating Entity", "Make", "Model", "Model Year",
        "Incident Date", "Incident Time (24:00)", "City", "State", "Roadway Type", "Crash With",
        "Highest Injury Severity Alleged", "SV Pre-Crash Movement", "CP Pre-Crash Movement", "SV Precrash Speed (MPH)",
        "Within ODD?", "Narrative", "weather", "surface", "surface_wet", "lighting", "severity", "any_injury",
        "hospital_or_worse", "source_file"]
A2 = A.reindex(columns=keep + ["Posted Speed Limit (MPH)"])
C2 = C.reindex(columns=keep + ["Posted Speed Limit (MPH)"])
df = pd.concat([A2, C2], ignore_index=True)

# 3. derived fields
df["month"] = pd.to_datetime(df["Incident Date"], format="%b-%Y", errors="coerce")
df["year"] = df["month"].dt.year
t = pd.to_datetime(df["Incident Time (24:00)"], format="%H:%M", errors="coerce")
df["hour"] = t.dt.hour
df["daypart"] = pd.cut(df["hour"], bins=[-1, 5, 9, 15, 19, 23], labels=["Night (0-5)", "Morning (6-9)", "Midday (10-15)", "Evening (16-19)", "Night (20-23)"])
df["adverse_weather"] = df["weather"].isin(["Rain", "Snow", "Fog or smoke", "Severe wind"])
df["operator"] = df["Reporting Entity"].str.replace(r",? (LLC|Inc\.?|Operations|Motor Company)$", "", regex=True).str.strip()
df["operator"] = df["operator"].replace({"General Motors": "Cruise (GM)", "Cruise": "Cruise (GM)", "Transdev Alternative Services": "Transdev"})
df["city"] = df["City"].str.strip().str.title()
city_fix = {"Sf": "San Francisco", "San Fransisco": "San Francisco", "Mountain View": "Mountain View"}
df["city"] = df["city"].replace(city_fix)
df["crash_partner"] = df["Crash With"].fillna("Unknown").replace({
    "Non-Motorist: Cyclist": "Cyclist", "Non-Motorist: Pedestrian": "Pedestrian", "Non-Motorist: Other": "Other non-motorist",
    "Other, see Narrative": "Other", "Other Fixed Object": "Fixed object", "Pole / Tree": "Fixed object"})
df["speed_mph"] = pd.to_numeric(df["SV Precrash Speed (MPH)"], errors="coerce")

df.to_csv(OUT, index=False)
print("archive incidents", len(A2), "current incidents", len(C2), "total", len(df))
print("weather", df["weather"].value_counts().to_dict())
print("surface", df["surface"].value_counts().to_dict())
print("severity", df["severity"].value_counts().to_dict())
print("cities", df["city"].value_counts().head(8).to_dict())
print("operators", df["operator"].value_counts().head(8).to_dict())
print("hour missing", df["hour"].isna().sum(), "month range", df["month"].min().date(), df["month"].max().date())
