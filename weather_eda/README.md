# Weather dimension EDA (Solomon)

Exploratory visualization for the DATASCI 209 Group 4 project, weather / road surface / lighting slice.

- `Group4_Exploratory_Visualization_Weather.docx` is the written report (three hypotheses, refinement steps, conclusions).
- `Group4_Weather_EDA.ipynb` reproduces everything in Colab. Put the two NHTSA CSVs in `data/` first.
- `clean_sgo.py` merges the two NHTSA ADS files (archive 2021 to 2025 and the current amended order file) into `ads_clean.csv`, one row per incident with harmonized weather, surface, lighting, severity, month, hour, operator, metro and crash partner. Teammates can use `ads_clean.csv` directly for the operator and time of day sections.
- `make_charts.py` builds the 15 charts in `charts/` and the two summary tables.
- `data/rain_exposure_monthly.csv` is the share of hours with precipitation per month for six metros (Open-Meteo historical archive), the denominator for the rain exposure comparison.

The raw NHTSA CSVs are not committed (6.5 MB); download them from https://www.nhtsa.gov/laws-regulations/standing-general-order-crash-reporting (ADS Incident Report Data, current and Archive 2021 to 2025).

Headline: once exposure is accounted for, weather barely registers in ADS crash reports. The share of crashes in rain is about half the share of time it rains in every metro, injury rates in rain and on wet roads are no higher than in clear, dry conditions, and apparent operator differences are explained by where and when the operators drive.
