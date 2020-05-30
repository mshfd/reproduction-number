import csv, os
import urllib.request
import shutil
import datetime

abspath = os.path.abspath(__file__)
dname = os.path.dirname(abspath)
os.chdir(dname)

rki_covid19_filename = "RKI_COVID19.csv"
rki_covid19_url = "https://www.arcgis.com/sharing/rest/content/items/f10774f1c63e40168479a1feb6c7ca74/data?token=hIaOEUx0TvgLxywZzt9HqdMHkfmovw1Fxix6iTMRk4LbRfYVgj810RuH_0oj-QhXBR32V3bVqlLPU3xfqztjfF9uBqm-2dgWxnJZg_K60K4Z2ndEbpyXDoAlcKL0SBpzt_IN8jfSJVvN3seLhjMG1dLwFuUB8w6LedGL_q7NvEc6ZeDdhx5lyxD5QDN6WdW3"


def parse_date(date_str):
    return datetime.datetime.strptime(date_str, "%Y/%m/%d %H:%M:%S")


def key_for_date(date):
    return datetime.datetime.strftime(date, "%Y/%m/%d %H:%M:%S")


# download source data if necessary
if not os.path.exists(rki_covid19_filename):
    print("Downloading " + rki_covid19_filename)
    with urllib.request.urlopen(rki_covid19_url) as response, open(
        rki_covid19_filename, "wb"
    ) as out_file:
        shutil.copyfileobj(response, out_file)
    print("Finished downloading " + rki_covid19_filename)

# parse the source data and accumulate cases for each date where the COVID-19 onset occurred
with open(rki_covid19_filename) as csvfile:
    reader = csv.DictReader(csvfile)

    num_cases_total = 0
    version_date_str = ""
    new_cases_for_date = {}
    for row in reader:
        version_date_str = row["Datenstand"]
        new_cases = int(row["AnzahlFall"])

        num_cases_total += new_cases

        new_cases_date = row["Refdatum"]
        if new_cases_date not in new_cases_for_date:
            new_cases_for_date[new_cases_date] = 0

        new_cases_for_date[new_cases_date] += new_cases

    version_date = datetime.datetime.strptime(version_date_str, "%d.%m.%Y, %H:%M Uhr")

    dates = sorted(new_cases_for_date.keys())
    first_date = parse_date(dates[0]).date()
    last_date = parse_date(dates[-1]).date()

    date = first_date
    while date < last_date:

        date += datetime.timedelta(days=1)
        date_key = key_for_date(date)

        num_new_cases = 0
        if date_key in new_cases_for_date:
            num_new_cases = new_cases_for_date[date_key]

        print(str(date) + " had " + str(num_new_cases) + " new cases")

    print()
    print("Number of cases in total: " + str(num_cases_total))
    print(
        "Data is from "
        + str(version_date.date())
        + " and spans "
        + str((last_date - first_date).days)
        + " days"
    )
