import csv
import os
import urllib.request
import shutil
import datetime
import json
import copy

abspath = os.path.abspath(__file__)
dname = os.path.dirname(abspath)
os.chdir(dname)

owid_covid19_filename = "OWID-COVID-19-testing-all-observations.csv"
owid_covid19_source_url = "https://raw.githubusercontent.com/owid/covid-19-data/master/public/data/testing/covid-testing-all-observations.csv"
base_data_dir = "../../docs/assets/data/SARS-CoV-2/"

country_code_src_filepath = "../ISO-3166-Countries-with-Regional-Codes.json"

country_codes = {}
with open(country_code_src_filepath, "r") as dataset_json:
    country_codes = json.load(dataset_json)


def parse_date(date_str):
    return datetime.datetime.strptime(date_str, "%Y-%m-%d")


def key_for_date(date):
    return datetime.datetime.strftime(date, "%Y-%m-%d")


# Download source data if necessary.
if not os.path.exists(owid_covid19_filename):
    print("Downloading " + owid_covid19_filename)
    with urllib.request.urlopen(owid_covid19_source_url) as response, open(
        owid_covid19_filename, "wb"
    ) as out_file:
        shutil.copyfileobj(response, out_file)
    print("Finished downloading " + owid_covid19_filename)

print()
print("processing data...")
print()

data = {}

# Parse the source data and group cases for each country.
with open(owid_covid19_filename, encoding="utf-8") as csvfile:
    reader = csv.DictReader(csvfile)

    for row in reader:
        entity = row["Entity"]
        title_split = entity.find(" - ")
        country = entity[:title_split]
        data_type = entity[title_split + 3 :]

        # if not data_type.startswith("tests performed"):
        #    continue

        # num_tests = int(row["Daily change in cumulative total"])
        tests_per_case_entry = row["Short-term tests per case"]

        if not tests_per_case_entry:
            continue

        tests_per_case = float(tests_per_case_entry)

        is_germany = country == "Germany"

        # if not is_germany:
        #    continue

        date = row["Date"]

        if entity not in data:

            country_code = row["ISO code"]
            for cc in country_codes:
                if cc["alpha-3"] == country_code:
                    country_code = cc["alpha-2"]
                    break

            data[entity] = {"country_code": country_code.lower(), "data_by_type": {}}

        if data_type not in data[entity]["data_by_type"]:
            data_type_parts = data_type.split()

            data[entity]["data_by_type"][data_type] = {
                "title": data_type,
                "positive_tests_for_date": {},
                "file_name": data_type_parts[0]
                + "_"
                + data_type_parts[1]
                + "-OWID.json",
            }

        source_url = row["Source URL"]
        if source_url:
            data[entity]["source_url"] = source_url

        source_label = row["Source label"]
        if source_label:
            data[entity]["source"] = source_label

        data[entity]["data_by_type"][data_type]["positive_tests_for_date"][date] = (
            100000 / tests_per_case
        )
        data[entity]["data_by_type"][data_type]["version_date"] = date

for country in data.keys():

    country_data = data[country]
    country_code = country_data["country_code"]

    for data_by_type_key in country_data["data_by_type"].keys():

        data_by_type = country_data["data_by_type"][data_by_type_key]
        cases_for_date = data_by_type["positive_tests_for_date"]

        dates = sorted(cases_for_date.keys())
        first_date = parse_date(dates[0]).date()
        last_date = parse_date(dates[-1]).date()

        date = first_date
        cases = []
        while date <= last_date:

            date_key = key_for_date(date)

            num_cases = 0
            if date_key in cases_for_date:
                num_cases = round(cases_for_date[date_key])

            cases.append(num_cases)

            date += datetime.timedelta(days=1)

        print()
        print(country)

        print(
            "Data is from "
            + data_by_type["version_date"]
            + " and spans "
            + str((last_date - first_date).days)
            + " days"
        )

        targetDir = base_data_dir + country_code
        if not os.path.exists(targetDir):
            os.mkdir(targetDir)

        target_json = targetDir + "/" + data_by_type["file_name"]
        print()
        print("Writing results to " + target_json)

        source = (
            country_data["source"] if "source" in country_data else "unknown source"
        )
        source_url = country_data["source_url"] if "source_url" in country_data else ""

        result = {
            "startDate": str(first_date),
            "versionDate": data_by_type["version_date"],
            "type": "pcr_tests_100k",
            "averageReportToCaseDelayInDays": 10,
            "source": {
                "name": "Positive results per 100k "
                + data_by_type["title"]
                + " - Data collected by OWID from "
                + source,
                "url": source_url,
                "license": "Attribution 4.0 International (CC BY 4.0)",
                "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
            },
            "data": cases,
        }

        with open(target_json, "w", encoding="utf-8") as outfile:
            json.dump(result, outfile, indent=4, ensure_ascii=False)


##################
print("Updating datasets " + str(len(data.keys())))

owid_dataset = {
    "title": "",
    "description": "Based on data collected by 'Our World in Data'.",
    "filename": "",
}

dataset_json_filepath = base_data_dir + "dataset.json"
dataset = {}
with open(dataset_json_filepath, "r", encoding="utf-8") as dataset_json:
    dataset = json.load(dataset_json)

    def find_entry(arr, key, id):
        for x in arr:
            if x[key] == id:
                return x

    for country in data.keys():

        country_data = data[country]
        country_code = country_data["country_code"]
        if len(country_code) > 2:
            continue

        region = find_entry(dataset["regions"], "path", country_code)

        for data_by_type_key in country_data["data_by_type"].keys():

            data_by_type = country_data["data_by_type"][data_by_type_key]

            owid_dataset["title"] = (
                "Positive results per 100k " + data_by_type["title"] + " (OWID)"
            )
            owid_dataset["filename"] = data_by_type["file_name"]

            if region is None:
                region = {
                    "name": country,
                    "path": country_code,
                    "datasets": [copy.deepcopy(owid_dataset)],
                }
                dataset["regions"].append(region)
            else:
                datasetEntry = find_entry(
                    region["datasets"], "title", owid_dataset["title"]
                )
                if datasetEntry is None:
                    region["datasets"].append(copy.deepcopy(owid_dataset))
                else:
                    for k, v in owid_dataset.items():
                        datasetEntry[k] = copy.deepcopy(v)

dataset["regions"].sort(key=lambda x: x["name"])

print("Writing datasets to " + dataset_json_filepath)
with open(dataset_json_filepath, "w", encoding="utf-8") as dataset_json:
    json.dump(dataset, dataset_json, indent=4, ensure_ascii=False)
