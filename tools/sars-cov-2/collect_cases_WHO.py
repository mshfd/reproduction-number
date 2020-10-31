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
base_data_dir = "../../docs/assets/data/SARS-CoV-2/"


def parse_date(date_str):
    return datetime.datetime.strptime(date_str, "%Y-%m-%d")


def key_for_date(date):
    return datetime.datetime.strftime(date, "%Y-%m-%d")


# Download source data if necessary.
if not os.path.exists(who_covid19_filename):
    print("Downloading " + who_covid19_filename)
    with urllib.request.urlopen(who_covid19_source_url) as response, open(
        who_covid19_filename, "wb"
    ) as out_file:
        shutil.copyfileobj(response, out_file)
    print("Finished downloading " + who_covid19_filename)

    # remove white spaces from first line of csv file
    with open(who_covid19_filename, "r+") as f:
        txt = f.readlines()
        txt[0] = txt[0][3:].replace(" ", "")
        f.seek(0)
        f.writelines(txt)
        f.truncate()

print()
print("processing data...")
print()

version_date_str = ""
data = {}

# Parse the source data and group cases for each country.
with open(who_covid19_filename, encoding="utf-8") as csvfile:
    reader = csv.DictReader(csvfile)

    for row in reader:
        cases_date = row["Date_reported"]
        country = row["Country"]
        country_code = row["Country_code"]
        new_cases = int(row["New_cases"])
        new_deaths = int(row["New_deaths"])
        is_germany = country == "Germany"

        if country == "Other":
            country_code = "XX"

        # if not is_germany:
        #    continue

        if country not in data:
            data[country] = {
                "country_code": country_code.lower(),
                "cases_for_date": {},
                "num_cases_total": 0,
                "num_deaths_total": 0,
            }

        data[country]["num_cases_total"] += new_cases
        data[country]["num_deaths_total"] += new_deaths

        data[country]["cases_for_date"][cases_date] = new_cases
        version_date_str = cases_date

version_date = datetime.datetime.strptime(version_date_str, "%Y-%m-%d")

for country in data.keys():

    country_data = data[country]
    country_code = country_data["country_code"]
    cases_for_date = country_data["cases_for_date"]
    num_cases_total = country_data["num_cases_total"]
    num_deaths_total = country_data["num_deaths_total"]

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

        date += datetime.timedelta(days=1)

    print()
    print(country)
    print("Number of cases in total: " + str(num_cases_total))
    print("Number of deaths in total: " + str(num_deaths_total))

    print(
        "Data is from "
        + str(version_date.date())
        + " and spans "
        + str((last_date - first_date).days)
        + " days"
    )

    targetDir = base_data_dir + country_code
    if not os.path.exists(targetDir):
        os.mkdir(targetDir)

    target_json = targetDir + "/cases-WHO.json"
    print()
    print("Writing results to " + target_json)

    result = {
        "startDate": str(first_date),
        "versionDate": str(version_date.date()),
        "type": "cases",
        "averageReportToCaseDelayInDays": 10,
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

    with open(target_json, "w") as outfile:
        json.dump(result, outfile, indent=4, ensure_ascii=False)


##################
print("Updating datasets " + str(len(data.keys())))

who_dataset = {
    "title": "WHO COVID-19 Cases",
    "description": "The WHO coronavirus disease (COVID-19) data presents official daily counts of COVID-19 cases and deaths reported by countries, territories and areas. Caution must be taken when interpreting all data presented, and differences between information products published by WHO, national public health authorities, and other sources using different inclusion criteria and different data cut-off times are to be expected.",
    "filename": "cases-WHO.json",
}

dataset_json_filepath = base_data_dir + "dataset.json"
dataset = {}
with open(dataset_json_filepath, "r") as dataset_json:
    dataset = json.load(dataset_json)

    def find_entry(arr, key, id):
        for x in arr:
            if x[key] == id:
                return x

    for country in data.keys():

        country_data = data[country]
        country_code = country_data["country_code"]

        region = find_entry(dataset["regions"], "path", country_code)

        if region is None:
            region = {"name": country, "path": country_code, "datasets": [who_dataset]}
            dataset["regions"].append(region)
        else:
            datasetEntry = find_entry(region["datasets"], "title", who_dataset["title"])
            if datasetEntry is None:
                region["datasets"].append(who_dataset)
            else:
                for k, v in who_dataset.items():
                    datasetEntry[k] = v


dataset["regions"].sort(key=lambda x: x["name"])

print("Writing datasets to " + dataset_json_filepath)
with open(dataset_json_filepath, "w") as dataset_json:
    json.dump(dataset, dataset_json, indent=4, ensure_ascii=False)
