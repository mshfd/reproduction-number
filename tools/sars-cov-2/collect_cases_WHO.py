import csv
import os
import urllib.request
import shutil
import datetime
import json

abspath = os.path.abspath(__file__)
dname = os.path.dirname(abspath)
os.chdir(dname)

who_covid19_filename = "WHO-COVID-19-global-data.csv"
who_covid19_source_url = "https://covid19.who.int/WHO-COVID-19-global-data.csv"


def parse_date(date_str):
    return datetime.datetime.strptime(date_str, "%Y-%m-%d")


def key_for_date(date):
    return datetime.datetime.strftime(date, "%Y-%m-%d")


# Download source data if necessary.
if not os.path.exists(who_covid19_filename):
    print("Downloading " + who_covid19_filename)
    with urllib.request.urlopen(who_covid19_source_url) as response, open(who_covid19_filename, "wb") as out_file:
        shutil.copyfileobj(response, out_file)
    print("Finished downloading " + who_covid19_filename)
    
    print("Removing all whitespaces " + who_covid19_filename)
    # remove all white spaces from csv file
    with open(who_covid19_filename, 'r+') as f:
        txt = f.read().replace(' ', '')
        f.seek(0)
        f.write(txt)
        f.truncate()

print()
print("processing data...")
print()

version_date_str = ""
data = {}

# Parse the source data and group cases for each country.
with open(who_covid19_filename) as csvfile:
    reader = csv.DictReader(csvfile)

    for row in reader:
        cases_date = row["Date_reported"]
        country = row["Country"]
        new_cases = int(row["New_cases"])
        new_deaths = int(row["New_deaths"])
        is_germany = country == "Germany"

        if not is_germany:
            continue

        if country not in data:
            data[country] = {
                'cases_for_date': {},
                'num_cases_total': 0,
                'num_deaths_total': 0
            }

        data[country]['num_cases_total'] += new_cases
        data[country]['num_deaths_total'] += new_deaths

        data[country]['cases_for_date'][cases_date] = new_cases
        version_date_str = cases_date

version_date = datetime.datetime.strptime(version_date_str, "%Y-%m-%d")

for country in data.keys():

    country_data = data[country]
    cases_for_date = country_data['cases_for_date']
    num_cases_total = country_data['num_cases_total']
    num_deaths_total = country_data['num_deaths_total']

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

    print()
    print("Number of cases in total: " + str(num_cases_total))
    print("Number of deaths in total: " + str(num_deaths_total))

    print(
        "Data is from "
        + str(version_date.date())
        + " and spans "
        + str((last_date - first_date).days)
        + " days"
    )

    targetJson = "docs/assets/data/SARS-CoV-2/" + country + "/cases-WHO.json"
    print()
    print("Writing results to " + targetJson)

    result = {
        "startDate": str(first_date),
        "versionDate": str(version_date.date()),
        "type": "cases",
        "source": {
            "name": "World Health Organization",
            "url": "https://www.who.int/",
            "license": "Attribution-NonCommercial-ShareAlike 3.0 IGO",
            "licenseUrl": "https://creativecommons.org/licenses/by-nc-sa/3.0/igo/",
        },
        "metrics": {
            "numCases": num_cases_total,
            "numDeaths": num_deaths_total,
        },
        "data": cases,
    }

    with open("../../" + targetJson, "w") as outfile:
        json.dump(result, outfile, indent=4)
