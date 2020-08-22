import csv
import os
import urllib.request
import shutil
import datetime
import json
import matplotlib.pyplot as plt
import numpy as np

abspath = os.path.abspath(__file__)
dname = os.path.dirname(abspath)
os.chdir(dname)

rki_covid19_filename = "RKI_COVID19.csv"
rki_covid19_source_url = "https://www.arcgis.com/sharing/rest/content/items/f10774f1c63e40168479a1feb6c7ca74/data"


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
days_until_death = np.zeros((100), dtype=np.int32)

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
            num_days = (parse_date(death_date).date() - parse_date(cases_date).date()).days
            days_until_death[num_days] += num_deaths
            if 7 <= num_days <= 30: 
                num_real_deaths_total += num_deaths


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


fig, ax = plt.subplots()
ax.bar(range(0, days_until_death.size), days_until_death)
ax.set(xlabel='Symptom onset to death [days]', ylabel='Number of cases',
       title='Case duration until death')
ax.grid()
plt.show()

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

