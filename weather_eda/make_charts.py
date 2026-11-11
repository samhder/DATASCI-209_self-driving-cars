"""Weather EDA charts for the DATASCI 209 Exploratory Visualization (Group 4, weather dimension).
Produces PNGs in ./charts and the summary tables used in the write up.  Run after clean_sgo.py.
"""
import pandas as pd, numpy as np, altair as alt, os, json
from math import sqrt
os.makedirs("charts", exist_ok=True)
alt.data_transformers.disable_max_rows()

df = pd.read_csv("ads_clean.csv", parse_dates=["month"])
ex = pd.read_csv("rain_exposure_monthly.csv", parse_dates=["month"])
metro = {"Tempe": "Phoenix", "Scottsdale": "Phoenix", "Chandler": "Phoenix", "Mesa": "Phoenix", "Gilbert": "Phoenix"}
df["metro"] = df["city"].replace(metro)
TOP = ["San Francisco", "Los Angeles", "Austin", "Phoenix", "Atlanta", "Las Vegas"]
W_ORDER = ["Clear", "Cloudy", "Rain", "Other or unknown"]
W_COLORS = ["#d9c89e", "#8f9aa5", "#2f6db3", "#c9c9c9"]
df["weather4"] = df["weather"].where(df["weather"].isin(["Clear", "Cloudy", "Rain"]), "Other or unknown")
SEV_ORDER = ["No injury", "Minor", "Moderate", "Serious", "Fatality", "Unknown"]
SEV_COLORS = ["#dddddd", "#f2b680", "#e8803a", "#c23b22", "#6b0f0f", "#f5f5f5"]

def wilson(k, n, z=1.96):
    if n == 0: return (np.nan, np.nan, np.nan)
    p = k / n; d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d; h = z * sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return p, c - h, c + h

def save(chart, name, w=2):
    chart.save(f"charts/{name}.png", scale_factor=w); print("saved", name)

base_cfg = dict(labelFontSize=12, titleFontSize=13)
def finish(ch):
    return ch.configure_axis(**base_cfg).configure_legend(**base_cfg).configure_title(fontSize=16, anchor="start", subtitleFontSize=12, subtitleColor="#555").configure_view(strokeWidth=0)

# ---------------- Hypothesis 1: ADS crashes are over represented in rain ----------------
# 1a first look: raw counts by weather (all 8 categories)
c = (alt.Chart(df).mark_bar(color="#4e79a7").encode(
        x=alt.X("count():Q", title="Reported crashes"),
        y=alt.Y("weather:N", sort="-x", title=None))
     .properties(width=520, height=240, title="H1 step 1: crashes by reported weather, all ADS incidents (n = 2,945)"))
save(finish(c), "h1_step1_counts")

# 1b: collapse to four groups, normalize, split by metro area
d = df[df["metro"].isin(TOP)]
c = (alt.Chart(d).mark_bar().encode(
        y=alt.Y("metro:N", sort=TOP, title=None),
        x=alt.X("count():Q", stack="normalize", title="Share of crashes", axis=alt.Axis(format="%")),
        color=alt.Color("weather4:N", sort=W_ORDER, scale=alt.Scale(domain=W_ORDER, range=W_COLORS), title="Weather"),
        order=alt.Order("w_idx:Q"),
        tooltip=["metro", "weather4", "count()"])
     .transform_calculate(w_idx=f"indexof({json.dumps(W_ORDER)}, datum.weather4)")
     .properties(width=560, height=230, title={"text": "H1 step 2: weather share of crashes by metro area", "subtitle": "Rain is 1 to 6 percent of crashes everywhere. But how often does it rain in each city?"}))
save(finish(c), "h1_step2_share_by_city")

# exposure table: rain hours share over the months each metro had reports
rows = []
for m in TOP:
    s = d[d["metro"] == m]; months = s["month"].dropna().unique()
    e = ex[(ex["city"] == m) & (ex["month"].isin(months))]
    k = int((s["weather"] == "Rain").sum()); n = len(s)
    p, lo, hi = wilson(k, n); expo = e["rain_hours"].sum() / e["hours"].sum()
    rows.append(dict(metro=m, crashes=n, rain_crashes=k, crash_rain_share=p, lo=lo, hi=hi, rain_hours_share=expo,
                     ratio=p / expo, ratio_lo=lo / expo, ratio_hi=hi / expo))
expo = pd.DataFrame(rows); expo.to_csv("h1_exposure_table.csv", index=False); print(expo.round(3).to_string())

# 1c: dumbbell, crash share vs exposure share
long = expo.melt(id_vars=["metro", "crashes"], value_vars=["crash_rain_share", "rain_hours_share"], var_name="measure", value_name="share")
long["measure"] = long["measure"].map({"crash_rain_share": "Share of crashes in rain", "rain_hours_share": "Share of hours with rain"})
rule = alt.Chart(expo).mark_rule(color="#bbb", strokeWidth=2).encode(y=alt.Y("metro:N", sort=TOP, title=None), x="crash_rain_share:Q", x2="rain_hours_share:Q")
pts = alt.Chart(long).mark_point(size=130, filled=True).encode(
        y=alt.Y("metro:N", sort=TOP), x=alt.X("share:Q", axis=alt.Axis(format="%"), title="Share"),
        color=alt.Color("measure:N", scale=alt.Scale(domain=["Share of crashes in rain", "Share of hours with rain"], range=["#2f6db3", "#9aa5b1"]), title=None),
        tooltip=["metro", "measure", alt.Tooltip("share:Q", format=".1%")])
c = (rule + pts).properties(width=560, height=230, title={"text": "H1 step 3: crashes in rain vs how often it rains, by metro", "subtitle": "Exposure = share of hours with precipitation (Open-Meteo) over the months each city had reports"})
save(finish(c).configure_legend(orient="bottom"), "h1_step3_dumbbell")

# 1d: ratio with 95% interval, reference at 1
expo["ratio_hi_c"] = expo["ratio_hi"].clip(upper=1.55)
c = (alt.Chart(expo).mark_point(size=120, filled=True, color="#2f6db3").encode(
        y=alt.Y("metro:N", sort=alt.EncodingSortField("ratio", order="descending"), title=None),
        x=alt.X("ratio:Q", title="Rain crash share divided by rain hour share (1 = proportional)", scale=alt.Scale(domain=[0, 1.6])),
        tooltip=["metro", "crashes", "rain_crashes", alt.Tooltip("ratio:Q", format=".2f")])
     + alt.Chart(expo).mark_rule(color="#2f6db3", strokeWidth=2).encode(y=alt.Y("metro:N", sort=alt.EncodingSortField("ratio", order="descending")), x="ratio_lo:Q", x2="ratio_hi_c:Q")
     + alt.Chart(pd.DataFrame({"x": [1]})).mark_rule(color="#c23b22", strokeDash=[5, 4]).encode(x="x:Q")
     + alt.Chart(expo).mark_text(align="left", dx=8, dy=1, fontSize=11, color="#555").encode(y=alt.Y("metro:N", sort=alt.EncodingSortField("ratio", order="descending")), x="ratio_hi_c:Q", text=alt.Text("label:N"))
       .transform_calculate(label="datum.rain_crashes + ' of ' + datum.crashes + (datum.ratio_hi > 1.55 ? ' (interval runs to ' + format(datum.ratio_hi, '.1f') + ')' : '')")
    ).properties(width=560, height=240, title={"text": "H1 step 4: in every metro, rain crashes are about half of what rain exposure predicts", "subtitle": "Point = ratio of shares, bar = 95% Wilson interval on the crash share. All six points sit below 1; four intervals exclude it."})
save(finish(c), "h1_step4_ratio_ci")

# 1e: monthly SF: rain crashes vs rain hours
sf = d[d["metro"] == "San Francisco"].groupby("month").agg(crashes=("weather", "size"), rain_crashes=("weather", lambda s: (s == "Rain").sum())).reset_index()
sf = sf.merge(ex[ex["city"] == "San Francisco"][["month", "rain_hours"]], on="month")
sfl = sf.melt(id_vars="month", value_vars=["rain_crashes", "rain_hours"], var_name="series", value_name="value")
sfl["series"] = sfl["series"].map({"rain_crashes": "Crashes reported in rain", "rain_hours": "Hours of rain in the month"})
c = (alt.Chart(sfl).mark_area(opacity=0.85).encode(
        x=alt.X("month:T", title=None), y=alt.Y("value:Q", title=None),
        row=alt.Row("series:N", title=None, header=alt.Header(labelFontSize=12, labelAngle=0, labelAlign="left")),
        color=alt.Color("series:N", scale=alt.Scale(range=["#2f6db3", "#9aa5b1"]), legend=None))
     .resolve_scale(y="independent").properties(width=600, height=110, title={"text": "H1 step 5: San Francisco, month by month", "subtitle": "Rain crashes follow the rainy season (r = 0.56 with rain hours); total crashes do not (r = -0.13)."}))
save(finish(c), "h1_step5_sf_monthly")

# ---------------- Hypothesis 2: rain and wet roads make crashes more severe ----------------
d2 = df[df["weather4"] != "Other or unknown"]
c = (alt.Chart(d2).mark_bar().encode(
        x=alt.X("weather4:N", sort=W_ORDER[:3], title=None), y=alt.Y("count():Q", title="Crashes"),
        color=alt.Color("severity:N", sort=SEV_ORDER, scale=alt.Scale(domain=SEV_ORDER, range=SEV_COLORS), title="Highest injury"),
        order=alt.Order("s_idx:Q"))
     .transform_calculate(s_idx=f"indexof({json.dumps(SEV_ORDER)}, datum.severity)")
     .properties(width=360, height=300, title={"text": "H2 step 1: severity by weather, counts", "subtitle": "Rain is a sliver; the stacked counts cannot answer the question."}))
save(finish(c), "h2_step1_counts")

c = (alt.Chart(d2).mark_bar().encode(
        y=alt.Y("weather4:N", sort=W_ORDER[:3], title=None),
        x=alt.X("count():Q", stack="normalize", axis=alt.Axis(format="%"), title="Share of crashes"),
        color=alt.Color("severity:N", sort=SEV_ORDER, scale=alt.Scale(domain=SEV_ORDER, range=SEV_COLORS), title="Highest injury"),
        order=alt.Order("s_idx:Q"), tooltip=["weather4", "severity", "count()"])
     .transform_calculate(s_idx=f"indexof({json.dumps(SEV_ORDER)}, datum.severity)")
     .properties(width=560, height=160, title={"text": "H2 step 2: severity shares by weather", "subtitle": "Normalized: roughly 90 percent of crashes in every weather are property damage only."}))
save(finish(c), "h2_step2_normalized")

rows = []
for grp, col in [("weather", "weather4"), ("surface", "surface")]:
    for lvl, s in d2.groupby(col):
        if len(s) < 20: continue
        k = int(s["any_injury"].sum()); n = len(s); p, lo, hi = wilson(k, n)
        rows.append(dict(group=grp, level=lvl, n=n, injured=k, rate=p, lo=lo, hi=hi))
sev = pd.DataFrame(rows); sev.to_csv("h2_injury_rates.csv", index=False); print(sev.round(3).to_string())
sev["label"] = sev["level"] + "  (n = " + sev["n"].astype(str) + ")"
c = (alt.Chart(sev).mark_rule(color="#2f6db3", strokeWidth=2).encode(y=alt.Y("label:N", title=None, sort=alt.EncodingSortField("rate", order="descending")), x="lo:Q", x2="hi:Q")
     + alt.Chart(sev).mark_point(size=140, filled=True, color="#2f6db3").encode(y=alt.Y("label:N", sort=alt.EncodingSortField("rate", order="descending")), x=alt.X("rate:Q", axis=alt.Axis(format="%"), title="Share of crashes with any reported injury", scale=alt.Scale(domain=[0, 0.2])), tooltip=["level", "n", "injured", alt.Tooltip("rate:Q", format=".1%")])
    ).facet(row=alt.Row("group:N", title=None, header=alt.Header(labelFontSize=13, labelAngle=0, labelAlign="left")), spacing=12).resolve_scale(y="independent").properties(title={"text": "H2 step 3: injury rate with 95% intervals", "subtitle": "Rain (7%) and wet roads (10%) are no worse than clear and dry. The rain interval is wide: 8 injuries in 114 crashes."})
save(finish(c), "h2_step3_rates_ci")

# 2d: what changes in rain is who you hit, not how badly
pt = d2[d2["weather4"].isin(["Clear", "Rain"])]
ct = pd.crosstab(pt["crash_partner"], pt["weather4"], normalize="columns").reset_index()
ct["diff_pp"] = (ct["Rain"] - ct["Clear"]) * 100
ct = ct[ct[["Clear", "Rain"]].max(axis=1) > 0.02]
c = (alt.Chart(ct).mark_bar().encode(
        y=alt.Y("crash_partner:N", sort=alt.EncodingSortField("diff_pp", order="descending"), title=None),
        x=alt.X("diff_pp:Q", title="Percentage point difference, rain minus clear"),
        color=alt.condition("datum.diff_pp > 0", alt.value("#2f6db3"), alt.value("#9aa5b1")),
        tooltip=["crash_partner", alt.Tooltip("Clear:Q", format=".1%"), alt.Tooltip("Rain:Q", format=".1%")])
     .properties(width=520, height=260, title={"text": "H2 step 4: what the ADS hits in rain, compared with clear weather", "subtitle": "More passenger cars, 'other' objects and fixed objects; fewer SUVs, heavy trucks and cyclists."}))
save(finish(c), "h2_step4_partner_shift")

# 2e: pre crash speed distribution by weather (strip + median)
sp = d2.dropna(subset=["speed_mph"])
sp = sp[sp["speed_mph"] <= 60]
c = (alt.Chart(sp).mark_boxplot(extent="min-max", size=28, color="#2f6db3").encode(
        x=alt.X("weather4:N", sort=W_ORDER[:3], title=None), y=alt.Y("speed_mph:Q", title="ADS pre crash speed (mph)"))
     .properties(width=360, height=280, title={"text": "H2 step 5: pre crash speed is the same in rain", "subtitle": "Median speed is 0 mph in all three; most reported crashes involve a stopped or crawling vehicle."}))
save(finish(c), "h2_step5_speed")

# ---------------- Hypothesis 3: some operators handle weather worse ----------------
ops = df.groupby("operator").agg(n=("weather", "size"), rain=("weather", lambda s: (s == "Rain").sum())).reset_index()
ops = ops[ops["n"] >= 20]; ops["rain_share"] = ops["rain"] / ops["n"]
ops["label"] = ops["operator"] + " (n = " + ops["n"].astype(str) + ")"
c = (alt.Chart(ops).mark_bar(color="#2f6db3").encode(
        y=alt.Y("label:N", sort="-x", title=None), x=alt.X("rain_share:Q", axis=alt.Axis(format="%"), title="Share of crashes in rain"),
        tooltip=["operator", "n", "rain"])
     .properties(width=520, height=260, title={"text": "H3 step 1: rain share of crashes by operator", "subtitle": "Avride and Aurora look worst. Is that the operator or where they drive?"}))
save(finish(c), "h3_step1_operator")

# 3b: same, but faceted by metro, operators with >= 15 crashes in that metro
oc = df[df["metro"].isin(TOP)].groupby(["metro", "operator"]).agg(n=("weather", "size"), rain=("weather", lambda s: (s == "Rain").sum())).reset_index()
oc = oc[oc["n"] >= 15]; oc["rain_share"] = oc["rain"] / oc["n"]
oc = oc.merge(expo[["metro", "rain_hours_share"]], on="metro")
c = (alt.Chart(oc).mark_point(size=120, filled=True).encode(
        x=alt.X("rain_share:Q", axis=alt.Axis(format="%"), title="Share of crashes in rain"),
        y=alt.Y("operator:N", title=None), color=alt.Color("operator:N", legend=None),
        tooltip=["metro", "operator", "n", "rain"])
     + alt.Chart(oc).mark_rule(color="#c23b22", strokeDash=[4, 3]).encode(x="rain_hours_share:Q")
    ).properties(width=200, height=120).facet(facet=alt.Facet("metro:N", sort=TOP, title=None), columns=3).resolve_scale(y="independent").properties(title={"text": "H3 step 2: the same operators inside each metro", "subtitle": "Red dashed line = share of hours with rain in that metro. Every operator sits below its city's exposure line."})
save(finish(c), "h3_step2_operator_by_city")

# 3c: seasonality heatmap, rain crash share by metro and calendar month vs exposure
d3 = df[df["metro"].isin(TOP)].copy(); d3["cal_month"] = d3["month"].dt.month
hm = d3.groupby(["metro", "cal_month"]).agg(n=("weather", "size"), rain=("weather", lambda s: (s == "Rain").sum())).reset_index()
hm["rain_share"] = hm["rain"] / hm["n"]
e2 = ex.copy(); e2["cal_month"] = e2["month"].dt.month
e2 = e2.groupby(["city", "cal_month"]).apply(lambda g: g["rain_hours"].sum() / g["hours"].sum()).rename("expo").reset_index().rename(columns={"city": "metro"})
hm = hm.merge(e2, on=["metro", "cal_month"])
hml = hm.melt(id_vars=["metro", "cal_month", "n"], value_vars=["rain_share", "expo"], var_name="what", value_name="value")
hml["what"] = hml["what"].map({"rain_share": "Share of crashes in rain", "expo": "Share of hours with rain"})
c = (alt.Chart(hml).mark_rect().encode(
        x=alt.X("cal_month:O", title="Calendar month"), y=alt.Y("metro:N", sort=TOP, title=None),
        color=alt.Color("value:Q", scale=alt.Scale(scheme="blues", domain=[0, 0.3]), title="Share", legend=alt.Legend(format="%")),
        tooltip=["metro", "cal_month", "what", alt.Tooltip("value:Q", format=".1%"), "n"])
     .properties(width=480, height=150).facet(row=alt.Row("what:N", title=None, header=alt.Header(labelFontSize=13, labelAngle=0, labelAlign="left")))
     .properties(title={"text": "H3 step 3: rain crashes follow each city's rainy season", "subtitle": "Top: when ADS crashes happen in rain. Bottom: when it rains. Winter in California, summer in Texas and Georgia."}))
save(finish(c), "h3_step3_season_heatmap")

# 3d: monthly rain crashes vs rain hours, small multiples per metro (months with at least 5 crashes)
mm = d3.groupby(["metro", "month"]).agg(rain=("weather", lambda s: (s == "Rain").sum()), n=("weather", "size")).reset_index()
mm = mm.merge(ex.rename(columns={"city": "metro"})[["metro", "month", "rain_hours", "hours"]], on=["metro", "month"])
mm = mm[mm["n"] >= 5]
mm["rain_crash_share"] = mm["rain"] / mm["n"]
mm["exposure"] = mm["rain_hours"] / mm["hours"]
corr = mm.groupby("metro").apply(lambda g: g["rain_crash_share"].corr(g["exposure"])).round(2).to_dict(); print("monthly corr", corr)
mml = mm.melt(id_vars=["metro", "month", "n"], value_vars=["rain_crash_share", "exposure"], var_name="series", value_name="value")
mml["series"] = mml["series"].map({"rain_crash_share": "Share of crashes in rain", "exposure": "Share of hours with rain"})
panels = []
for m in TOP:
    sub = mml[mml["metro"] == m]
    panels.append(alt.Chart(sub).mark_line(clip=True).encode(
        x=alt.X("month:T", title=None, scale=alt.Scale(domain=[pd.Timestamp("2021-07-01"), pd.Timestamp("2026-08-01")])),
        y=alt.Y("value:Q", axis=alt.Axis(format="%"), title=None, scale=alt.Scale(domain=[0, 0.4])),
        color=alt.Color("series:N", scale=alt.Scale(range=["#2f6db3", "#9aa5b1"]), title=None),
        strokeWidth=alt.condition("datum.series == 'Share of crashes in rain'", alt.value(2.2), alt.value(1.2)),
        tooltip=["metro", "month:T", "series", alt.Tooltip("value:Q", format=".0%"), "n"])
      .properties(width=260, height=120, title=alt.TitleParams(f"{m}  (r = {corr.get(m, float('nan')):.2f})", fontSize=12, anchor="start")))
c = alt.concat(*panels, columns=2, spacing=14).properties(title={"text": "H3 step 4: month by month, rain crash share tracks rain exposure where the data is dense (SF, LA: r = 0.69)", "subtitle": "Blue: share of that month's crashes reported in rain. Gray: share of hours with rain. Months with fewer than 5 crashes dropped. The four newer metros are too sparse to judge yet."})
save(finish(c).configure_legend(orient="bottom"), "h3_step4_monthly_small_multiples")

# 3e: lighting x weather (archive only) - does rain at night look different
la = df.dropna(subset=["lighting"]); la = la[la["weather4"].isin(["Clear", "Cloudy", "Rain"]) & la["lighting"].isin(["Daylight", "Dark - Lighted", "Dawn / Dusk", "Dark - Not Lighted"])]
c = (alt.Chart(la).mark_bar().encode(
        y=alt.Y("weather4:N", sort=W_ORDER[:3], title=None),
        x=alt.X("count():Q", stack="normalize", axis=alt.Axis(format="%"), title="Share of crashes"),
        color=alt.Color("lighting:N", sort=["Daylight", "Dawn / Dusk", "Dark - Lighted", "Dark - Not Lighted"], scale=alt.Scale(range=["#f3d98b", "#e8a44a", "#5b6c84", "#1f2a3a"]), title="Lighting"),
        tooltip=["weather4", "lighting", "count()"])
     .properties(width=560, height=150, title={"text": "H3 step 5: lighting at the time of the crash, by weather (2021 to mid 2025 reports only)", "subtitle": "About 40 percent of crashes are in the dark whatever the weather; rain at night is not over represented."}))
save(finish(c), "h3_step5_lighting")
print("done")
