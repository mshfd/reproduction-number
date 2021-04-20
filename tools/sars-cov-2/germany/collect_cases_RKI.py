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

rki_covid19_filename = "RKI_COVID19.csv"
rki_covid19_source_url = "https://www.arcgis.com/sharing/rest/content/items/f10774f1c63e40168479a1feb6c7ca74/data"


def parse_date(date_str):
    return datetime.datetime.strptime(date_str, "%Y/%m/%d %H:%M:%S")


def key_for_date(date):
    return datetime.datetime.strftime(date, "%Y/%m/%d %H:%M:%S")


# Download source data if necessary.
if not os.path.exists(rki_covid19_filename):
    print("Downloading " + rki_covid19_filename)

    req = urllib.request.Request(
        rki_covid19_source_url,
        data=None,
        headers={  # pretend to be a browser (not a bot) to get maximum download speed
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/35.0.1916.47 Safari/537.36"
        },
    )

    with urllib.request.urlopen(req) as Response:
        Length = Response.getheader("content-length")
        BlockSize = 100000  # default value

        if Length:
            Length = int(Length)

        print(f"UrlLib len: {round((Length / 1024) / 1024, 2)} MB")

        with open(rki_covid19_filename, "wb") as out_file:
            Size = 0
            while True:
                BufferNow = Response.read(BlockSize)
                if not BufferNow:
                    break
                out_file.write(BufferNow)
                Size += len(BufferNow)
                if Length:
                    Percent = round((Size / Length) * 100, 2)
                    print(
                        f"download: {Percent}% {rki_covid19_source_url}\r",
                        end="",
                        flush=True,
                    )

    print("Finished downloading " + rki_covid19_filename)


print()
print("processing data...")
print()

num_cases_total = 0
num_deaths_total = 0
num_recovered_total = 0

vaccination_start_date = key_for_date(
    datetime.datetime.strptime("2020-12-27", "%Y-%m-%d")
)
version_date_str = ""
cases_for_date = {}
deaths_for_date_80_plus = {}
deaths_for_date_80_below = {}
deaths_per_age_group = {}
deaths_per_age_group_with_sympton_onset = {}
cases_per_age_group = {}

num_unkown_onset_deaths = 0

# Parse the source data and accumulate cases for each date where the COVID-19 onset occurred.
with open(rki_covid19_filename) as csvfile:
    reader = csv.DictReader(csvfile)

    # See https://www.arcgis.com/home/item.html?id=f10774f1c63e40168479a1feb6c7ca74 for details on how to interpret the data.
    for row in reader:
        is_berlin = row["IdBundesland"] == "11"

        # if not is_berlin:
        #    continue

        # if num_cases_total > 30000:
        #    break

        version_date_str = row["Datenstand"]
        num_cases = int(row["AnzahlFall"])
        num_deaths = int(row["AnzahlTodesfall"])
        num_recovered = int(row["AnzahlGenesen"])
        age_group = row["Altersgruppe"]

        num_cases_total += num_cases
        num_deaths_total += num_deaths
        num_recovered_total += num_recovered

        issue_date = row["Meldedatum"]
        cases_date = row["Refdatum"]
        if cases_date not in cases_for_date:
            cases_for_date[cases_date] = 0

        cases_for_date[cases_date] += num_cases

        if age_group not in cases_per_age_group:
            cases_per_age_group[age_group] = num_cases
            deaths_per_age_group[age_group] = 0
            deaths_per_age_group_with_sympton_onset[age_group] = 0
        else:
            cases_per_age_group[age_group] += num_cases

        if issue_date not in deaths_for_date_80_plus:
            deaths_for_date_80_plus[issue_date] = 0
            deaths_for_date_80_below[issue_date] = 0

        if num_deaths != 0:
            is_case_date = int(row["IstErkrankungsbeginn"])
            case_date_is_known = (
                1 if is_case_date == 1 or issue_date != cases_date else 0
            )

            if case_date_is_known == 0:
                num_unkown_onset_deaths += num_deaths

            deaths_per_age_group[age_group] += num_deaths
            deaths_per_age_group_with_sympton_onset[age_group] += (
                num_deaths * case_date_is_known
            )

            if age_group == "A80+":
                deaths_for_date_80_plus[issue_date] += num_deaths
            else:
                deaths_for_date_80_below[issue_date] += num_deaths


version_date = datetime.datetime.strptime(version_date_str, "%d.%m.%Y, %H:%M Uhr")


dates = sorted(cases_for_date.keys())
first_date = parse_date(dates[0]).date()
last_date = parse_date(dates[-1]).date()

date = first_date
cases = []
deaths = []
death_ratio = []
num_deaths_for_day_rolling = []
num_deaths_for_date_80_plus_rolling = []
while date <= last_date:

    date_key = key_for_date(date)

    num_cases = 0
    if date_key in cases_for_date:
        num_cases = cases_for_date[date_key]

    num_deaths_for_day_80_plus = (
        deaths_for_date_80_plus[date_key] if date_key in deaths_for_date_80_plus else 0
    )
    num_deaths_for_day = (
        num_deaths_for_day_80_plus + deaths_for_date_80_below[date_key]
        if date_key in deaths_for_date_80_below
        else num_deaths_for_day_80_plus
    )

    num_deaths_for_day_rolling.append(num_deaths_for_day)
    num_deaths_for_date_80_plus_rolling.append(num_deaths_for_day_80_plus)

    if len(num_deaths_for_day_rolling) > 20:
        num_deaths_for_day_rolling.pop(0)
        num_deaths_for_date_80_plus_rolling.pop(0)

    num_deaths_for_day_rolled = np.sum(num_deaths_for_day_rolling)
    num_deaths_for_date_80_plus_rolled = np.sum(num_deaths_for_date_80_plus_rolling)

    death_ratio_for_day_smoothed = 0
    if num_deaths_for_day_rolled > 0:
        death_ratio_for_day_smoothed = (
            10000 * num_deaths_for_date_80_plus_rolled / num_deaths_for_day_rolled
        )

    cases.append(num_cases)
    deaths.append(num_deaths_for_day)
    death_ratio.append(int(round(death_ratio_for_day_smoothed)))
    print(str(date) + " had " + str(num_cases) + " new cases")

    date += datetime.timedelta(days=1)


print()
print("Number of cases in total: " + str(num_cases_total))
print("Number of recovered cases in total: " + str(num_recovered_total))
print("Number of deaths in total: " + str(num_deaths_total))
print(
    "Number of deaths without known onset date: "
    + str(num_unkown_onset_deaths)
    + " ("
    + str(round(100 * num_unkown_onset_deaths / num_deaths_total, 1))
    + "%)"
)
print(
    "Number of active cases in total on "
    + str(version_date.date())
    + ": "
    + str(num_cases_total - num_recovered_total - num_deaths_total)
)


sorted_keys = sorted(deaths_per_age_group.keys())
for key in sorted_keys:
    value = deaths_per_age_group[key]
    num_deaths_with_sympton_onset = deaths_per_age_group_with_sympton_onset[key]
    print(
        "Number of deaths in age group "
        + key
        + ": "
        + str(value)
        + " with known symptom onset "
        + str(num_deaths_with_sympton_onset)
        + "("
        + str(
            round(100 * num_deaths_with_sympton_onset / (value if value > 0 else 1), 1)
        )
        + " %)"
    )

for key in sorted_keys:
    deaths_for_age_group = deaths_per_age_group[key]
    cases_for_age_group = cases_per_age_group[key]
    print(
        "Lethality per 100k "
        + key
        + ": "
        + str(int(round(100000 * deaths_for_age_group / cases_for_age_group)))
    )

print(
    "Data is from "
    + str(version_date.date())
    + " and spans "
    + str((last_date - first_date).days)
    + " days"
)


def store_to_file(targetJson, data, average_report_to_case_delay_in_days, data_type):

    print()
    print("Writing results to " + targetJson)

    result = {
        "startDate": str(first_date),
        "versionDate": str(version_date.date()),
        "type": data_type,
        "averageReportToCaseDelayInDays": average_report_to_case_delay_in_days,
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
        "data": data,
    }

    with open("../../../" + targetJson, "w") as outfile:
        json.dump(result, outfile, indent=4, ensure_ascii=False)


store_to_file("docs/assets/data/SARS-CoV-2/de/cases-RKI.json", cases, 0, "cases")
store_to_file("docs/assets/data/SARS-CoV-2/de/deaths-RKI.json", deaths, 10, "cases")
store_to_file(
    "docs/assets/data/SARS-CoV-2/de/death-by-age-ratio-RKI.json",
    death_ratio,
    10,
    "death-by-age-ratio",
)
