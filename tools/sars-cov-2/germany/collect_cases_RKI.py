
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
import numpy.random as rand

abspath = os.path.abspath(__file__)
dname = os.path.dirname(abspath)
os.chdir(dname)

rki_covid19_filename = "RKI_COVID19.csv"
rki_covid19_source_url = "https://www.arcgis.com/sharing/rest/content/items/f10774f1c63e40168479a1feb6c7ca74/data"


def calcMedian(x):
    median_point = sum(x) / 2
    acc = 0
    for i, v in enumerate(x):
        acc += v
        if acc >= median_point:
            return i
    return 0


def parse_date(date_str):
    return datetime.datetime.strptime(date_str, "%Y/%m/%d %H:%M:%S")


def key_for_date(date):
    return datetime.datetime.strftime(date, "%Y/%m/%d %H:%M:%S")


# Download source data if necessary.
if not os.path.exists(rki_covid19_filename):
    print("Downloading " + rki_covid19_filename)
    with urllib.request.urlopen(rki_covid19_source_url) as response, open(
        rki_covid19_filename, "wb"
    ) as out_file:
        shutil.copyfileobj(response, out_file)
    print("Finished downloading " + rki_covid19_filename)


print()
print("processing data...")
print()

num_cases_total = 0
num_deaths_total = 0
num_recovered_total = 0
num_real_deaths_total = 0

version_date_str = ""
cases_for_date = {}
days_until_death = np.zeros((100), dtype=np.float64)
days_until_death_real = np.zeros((100), dtype=np.float64)

# Parse the source data and accumulate cases for each date where the COVID-19 onset occurred.
with open(rki_covid19_filename) as csvfile:
    reader = csv.DictReader(csvfile)

    # See https://www.arcgis.com/home/item.html?id=f10774f1c63e40168479a1feb6c7ca74 for details on how to interpret the data.
    for row in reader:
        version_date_str = row["Datenstand"]
        num_cases = int(row["AnzahlFall"])
        num_deaths = int(row["AnzahlTodesfall"])
        num_recovered = int(row["AnzahlGenesen"])
        is_berlin = row["IdBundesland"] == "11"

        # if not is_berlin:
        #    continue

        num_cases_total += num_cases
        num_deaths_total += num_deaths
        num_recovered_total += num_recovered

        death_date = row["Meldedatum"]
        cases_date = row["Refdatum"]
        if cases_date not in cases_for_date:
            cases_for_date[cases_date] = 0

        cases_for_date[cases_date] += num_cases

        if num_deaths > 0:
            is_case_date = int(row["IstErkrankungsbeginn"])
            if is_case_date != 1:
                cases_date = death_date
            num_days = (parse_date(death_date).date() -
                        parse_date(cases_date).date()).days
            days_until_death[num_days] += num_deaths


version_date = datetime.datetime.strptime(
    version_date_str, "%d.%m.%Y, %H:%M Uhr")

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

# take all days after mean
days_until_death_mean = 13
for day in range(days_until_death_mean, days_until_death.size):
    days_until_death_real[day] = days_until_death[day]
    days_until_death[day] = 0

num_deaths_after_mean = sum(days_until_death_real[days_until_death_mean:])

# make sure the mean is reached by adding a normalized distribution before the target mean
cdf = norm.cdf(np.arange(-2, 2, 4 / (days_until_death_mean)))
print(str(cdf))
cdf_sum = sum(cdf)
print(str(num_deaths_after_mean) + " : " + str(cdf_sum))

it = 0
median = calcMedian(days_until_death_real)
while median > days_until_death_mean:
    for day in range(0, days_until_death_mean):
        if days_until_death[day] > 0:
            days_until_death_real[day] += cdf[day]
            days_until_death[day] -= cdf[day]

    it += 1
    if it > 1000:
        it = 0
        print(str(days_until_death_real))
        print("median: " + str(median))

    median = calcMedian(days_until_death_real)


for day in range(0, days_until_death_mean):
    days_until_death_real[day] = round(days_until_death_real[day])
    days_until_death[day] = round(days_until_death[day])

print(str(days_until_death_real))
print("median: " + str(median))

num_real_deaths_total = int(sum(days_until_death_real))

fig, ax = plt.subplots(figsize=(16, 9))
x = range(0, days_until_death.size)
y = days_until_death
y2 = days_until_death_real

ax.bar(x, y2, color='tab:red')
ax.bar(x, y, bottom=y2, color='tab:blue')

ax.set(xlabel='Symptom onset to death [days]', ylabel='Number of deaths',
       title='Number of deaths assigned to their duration of illness (positive SARS-CoV-2) - Cases total: ' + str(num_deaths_total))
ax.grid()

extra = Rectangle((0, 0), 1, 1, fill=False, edgecolor='none', linewidth=0)
ax.legend([extra], ["Germany - " + str(version_date.date())], loc='upper right')

axins = ax.inset_axes([0.2, 0.3, 0.6, 0.6])
axins.bar(x, y2, color='tab:red')
axins.set(title='Deaths caused or induced most likely by COVID-19 - Cases total: ' +
          str(num_real_deaths_total))
ax.indicate_inset_zoom(axins)

# plt.show()
plt.savefig("symptom-onset-to-death.png", dpi=200, pad_inches=0.1,
            bbox_inches=Bbox.from_bounds(0, 0, 16, 9))

print()
print("Number of cases in total: " + str(num_cases_total))
print("Number of recovered cases in total: " + str(num_recovered_total))
print("Number of deaths in total: " + str(num_deaths_total))
print("Probable number of real deaths in total: " + str(num_real_deaths_total))

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
