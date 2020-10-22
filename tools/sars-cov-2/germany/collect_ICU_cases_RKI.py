import csv
import os
import urllib.request
import shutil
import datetime
import json
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle
from matplotlib.transforms import Bbox
import numpy as np
from scipy.stats import norm

abspath = os.path.abspath(__file__)
dname = os.path.dirname(abspath)
os.chdir(dname)

rki_icu_covid19_filename = "RKI_ICU_COVID19.csv"


def parse_date(date_str):
    return datetime.datetime.strptime(date_str, "%m/%d/%Y")


def key_for_date(date):
    return datetime.datetime.strftime(date, "%m/%d/%Y")


print()
print("processing data...")
print()


version_date_str = ""
cases_for_date = {}

with open(rki_icu_covid19_filename) as csvfile:
    reader = csv.DictReader(csvfile)

    for row in reader:
        version_date_str = row["Datum"]
        num_cases = int(row["AnzahlFall"])
        num_deaths = int(row["AnzahlTodesfall"])
        num_recovered = int(row["AnzahlGenesen"])
        is_berlin = row["IdBundesland"] == "11"

        cases_date = row["Datum"]
        if cases_date not in cases_for_date:
            cases_for_date[cases_date] = 0

        cases_for_date[cases_date] += num_cases

        if num_deaths > 0:
            is_case_date = int(row["IstErkrankungsbeginn"])
            if is_case_date != 1:
                cases_date = death_date
                num_unkown_onset_deaths += 1

            num_days = (
                parse_date(death_date).date() - parse_date(cases_date).date()
            ).days

            num_days = 0 if num_days < 0 else num_days
            num_days = (
                days_until_death.size - 1
                if num_days >= days_until_death.size
                else num_days
            )

            days_until_death[num_days] += num_deaths


version_date = datetime.datetime.strptime(version_date_str, "%d.%m.%Y, %H:%M Uhr")


dates = sorted(cases_for_date.keys())
first_date = parse_date(dates[0]).date()
last_date = parse_date(dates[-1]).date()

date = first_date
cases = []
while date <= last_date:

    date_key = key_for_date(date)

    num_cases = 0
    if date_key in cases_for_date:
        num_cases = cases_for_date[date_key]

    cases.append(num_cases)
    print(str(date) + " had " + str(num_cases) + " new cases")

    date += datetime.timedelta(days=1)

# take all days after median
days_until_death_median = 13
for day in range(days_until_death_median, days_until_death.size):
    days_until_death_real[day] = days_until_death[day]
    days_until_death[day] = 0

# make sure the median is reached by adding a normalized distribution before the target median
cdf = norm.cdf(np.arange(-2, 2, 4 / (days_until_death_median)))
cdf_sum = sum(cdf)

while (median := calcMedian(days_until_death_real)) > days_until_death_median:
    for day in range(0, days_until_death_median):
        if days_until_death[day] > 0:
            days_until_death_real[day] += cdf[day]
            days_until_death[day] -= cdf[day]

for day in range(0, days_until_death_median):
    days_until_death_real[day] = round(days_until_death_real[day])
    days_until_death[day] = round(days_until_death[day])

print("days_until_death: " + str(days_until_death))
print("days_until_death_real: " + str(days_until_death_real))
print("median: " + str(median))

num_real_deaths_total = int(sum(days_until_death_real))

fig, ax = plt.subplots(figsize=(16, 9))
x = range(0, days_until_death.size)
y = days_until_death
y2 = days_until_death_real

x_ticks = [0, 10, 20, 30, 40, 50]
x_labels = ["0", "10", "20", "30", "40", "50+"]

ax.bar(x, y2, color="tab:red")
ax.bar(x, y, bottom=y2, color="tab:blue")
ax.set_xticks(x_ticks)
ax.set_xticklabels(x_labels)

ax.set(
    xlabel="Symptom onset to death [days]",
    ylabel="Number of deaths",
    title="Number of deaths assigned to their duration of illness (positive SARS-CoV-2) - Cases total: "
    + str(num_deaths_total),
)
ax.grid()

extra = Rectangle((0, 0), 1, 1, fill=False, edgecolor="none", linewidth=0)
ax.legend([extra], ["Germany - " + str(version_date.date())], loc="upper right")

axins = ax.inset_axes([0.2, 0.3, 0.6, 0.6])
axins.bar(x, y2, color="tab:red")
axins.set(
    title="Deaths caused or induced most likely by COVID-19 - Cases total: "
    + str(num_real_deaths_total)
)
axins.set_xticks(x_ticks)
axins.set_xticklabels(x_labels)

ax.indicate_inset_zoom(axins)

# plt.show()
plt.savefig(
    "symptom-onset-to-death.png",
    dpi=200,
    pad_inches=0.1,
    bbox_inches=Bbox.from_bounds(0, 0, 16, 9),
)

print()
print("Number of cases in total: " + str(num_cases_total))
print("Number of recovered cases in total: " + str(num_recovered_total))
print("Number of deaths in total: " + str(num_deaths_total))
print("Probable number of real deaths in total: " + str(num_real_deaths_total))
print("Number of deaths without known onset date: " + str(num_unkown_onset_deaths))

print(
    "Number of active cases in total on "
    + str(version_date.date())
    + ": "
    + str(num_cases_total - num_recovered_total - num_deaths_total)
)

print(
    "Data is from "
    + str(version_date.date())
    + " and spans "
    + str((last_date - first_date).days)
    + " days"
)

targetJson = "docs/assets/data/SARS-CoV-2/de/cases-RKI.json"
print()
print("Writing results to " + targetJson)

result = {
    "startDate": str(first_date),
    "versionDate": str(version_date.date()),
    "type": "cases",
    "averageReportToCaseDelayInDays": 0,
    "source": {
        "name": "Robert Koch-Institut",
        "url": "https://www.arcgis.com/home/item.html?id=f10774f1c63e40168479a1feb6c7ca74",
        "license": "Data licence Germany - attribution - version 2.0",
        "licenseUrl": "https://www.govdata.de/dl-de/by-2-0",
    },
    "metrics": {
        "numCases": num_cases_total,
        "numRecovered": num_recovered_total,
        "numDeaths": num_deaths_total,
    },
    "data": cases,
}

with open("../../../" + targetJson, "w") as outfile:
    json.dump(result, outfile, indent=4, ensure_ascii=False)
