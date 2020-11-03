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


def calcMedian(days_until_death):
    days_per_case = []
    for i, v in enumerate(days_until_death):
        for c in range(int(v)):
            days_per_case.append(i)
    return np.median(days_per_case)


def parse_date(date_str):
    if date_str[-3] == ":":
        return datetime.datetime.strptime(date_str, "%d.%m.%Y %H:%M:%S")
    elif date_str[1] == "." or date_str[2] == ".":
        return datetime.datetime.strptime(date_str, "%d.%m.%Y")
    elif date_str[1] == "/" or date_str[2] == "/":
        return datetime.datetime.strptime(date_str, "%m/%d/%Y")
    elif date_str[4] == "/":
        return datetime.datetime.strptime(date_str, "%Y/%m/%d")
    else:
        return datetime.datetime.strptime(date_str, "%Y-%m-%d")


def key_for_date(date):
    return datetime.datetime.strftime(date, "%Y-%m-%d")


num_deaths_total = 0
num_real_deaths_total = 0

version_date_str = ""
cases_for_date = {}
days_until_death = np.zeros((81), dtype=np.float64)
days_until_death_real = np.zeros((81), dtype=np.float64)

num_unkown_onset_deaths = 0
publish_death_delay_days = 2

num_onset_after_death = 0
num_extreme_late_deaths = 0

start_date = datetime.datetime.strptime("2020-04-08", "%Y-%m-%d")
end_date = datetime.datetime.strptime("2020-10-21", "%Y-%m-%d")

start_date = datetime.datetime.strptime("2020-08-01", "%Y-%m-%d")
end_date = datetime.datetime.strptime("2020-08-31", "%Y-%m-%d")

date = start_date - datetime.timedelta(days=1)
include_previous_day = False
while date < end_date:

    date += datetime.timedelta(days=1)

    date_key = key_for_date(date)

    rki_covid19_filename_prefix = "C:/Users/Richard Schubert/dev/CSV-Dateien-mit-Covid-19-Infektionen/RKI_COVID19_"
    rki_covid19_filename = rki_covid19_filename_prefix + key_for_date(date) + ".csv"

    # Parse the source data and accumulate cases for each date where the COVID-19 onset occurred.
    # See https://www.arcgis.com/home/item.html?id=f10774f1c63e40168479a1feb6c7ca74 for details on how to interpret the data.

    if not os.path.isfile(rki_covid19_filename):
        include_previous_day = True
        continue

    with open(rki_covid19_filename) as csvfile:
        reader = csv.DictReader(csvfile)

        print("processing " + rki_covid19_filename)

        for row in reader:

            new_death = int(float(row["NeuerTodesfall"]))

            is_new_death_from_today = new_death == 1
            is_new_death_from_yesterday = include_previous_day and (new_death == -1)

            process_this_case = is_new_death_from_today or is_new_death_from_yesterday
            skip_this_case = not process_this_case

            if skip_this_case:
                continue

            num_deaths = int(float(row["AnzahlTodesfall"]))

            issue_date = row["Meldedatum"]
            cases_date = row["Refdatum"]

            if num_deaths > 0:
                num_deaths_total += num_deaths

                num_days = (date.date() - parse_date(cases_date).date()).days

                case_date_is_known = issue_date != cases_date or (
                    "IstErkrankungsbeginn" in row
                    and int(float(row["IstErkrankungsbeginn"])) == 1
                )

                if num_days < 0:
                    # symptom onset after death is not possible
                    case_date_is_known = False
                    num_onset_after_death += num_deaths

                # it takes some time to issue death certificate etc.
                num_days = num_days - (
                    publish_death_delay_days - 1
                    if is_new_death_from_yesterday
                    else publish_death_delay_days
                )

                if num_days >= days_until_death.size:
                    num_extreme_late_deaths += num_deaths

                num_days = 0 if num_days < 0 else num_days
                num_days = (
                    days_until_death.size - 1
                    if num_days >= days_until_death.size
                    else num_days
                )

                if case_date_is_known:
                    days_until_death_real[num_days] += num_deaths
                else:
                    days_until_death[num_days] += num_deaths
                    num_unkown_onset_deaths += num_deaths

    include_previous_day = False


# take all days after median
days_until_death_median = calcMedian(days_until_death_real)
# for day in range(days_until_death_median, days_until_death.size):
#    days_until_death_real[day] = days_until_death[day]
#    days_until_death[day] = 0

# make sure the median is reached by adding a normalized distribution before the target median
cdf = norm.cdf(np.arange(-2, 2, 4 / (days_until_death_median)))
cdf_sum = sum(cdf)

# while (median := calcMedian(days_until_death_real)) > days_until_death_median:
#    for day in range(0, days_until_death_median):
#        if days_until_death[day] > 0:
#            days_until_death_real[day] += cdf[day]
#            days_until_death[day] -= cdf[day]

# for day in range(0, days_until_death_median):
#    days_until_death_real[day] = round(days_until_death_real[day])
#    days_until_death[day] = round(days_until_death[day])

print("days_until_death: " + str(days_until_death))
print("days_until_death_real: " + str(days_until_death_real))
print("median: " + str(days_until_death_median))

num_real_deaths_total = int(sum(days_until_death_real))

fig, ax = plt.subplots(figsize=(16, 9))
x = range(0, days_until_death.size)
y = days_until_death
y2 = days_until_death_real

x_ticks = [0, 10, 20, 30, 40, 50, 60, 70, 80]
x_labels = ["0", "10", "20", "30", "40", "50", "60", "70", "80+"]

ax.bar(x, y2, color="tab:red")
ax.bar(x, y, bottom=y2, color="tab:blue")
ax.set_xticks(x_ticks)
ax.set_xticklabels(x_labels)

ax.set(
    xlabel="Symptom onset to death [days]",
    ylabel="Number of deaths",
    title="Number of deaths assigned to their duration of illness (positive SARS-CoV-2) - Cases total: "
    + str(num_deaths_total)
    + "\nDeaths with known symptom onset - Cases total: "
    + str(num_real_deaths_total),
)
ax.grid()

extra = Rectangle((0, 0), 1, 1, fill=False, edgecolor="none", linewidth=0)
ax.legend(
    [extra],
    ["Germany between " + str(start_date.date()) + " - " + str(end_date.date())],
    loc="upper right",
)

# axins = ax.inset_axes([0.2, 0.3, 0.6, 0.6])
# axins.bar(x, y2, color="tab:red")
# axins.set(
#    title="Deaths caused or induced most likely by COVID-19 - Cases total: "
#    + str(num_real_deaths_total)
# )
# axins.set_xticks(x_ticks)
# axins.set_xticklabels(x_labels)
# ax.indicate_inset_zoom(axins)

# plt.show()
plt.savefig(
    "symptom-onset-to-death.png",
    dpi=200,
    pad_inches=0.1,
    bbox_inches=Bbox.from_bounds(0, 0, 16, 9),
)


print("Data spans " + str((end_date - start_date).days) + " days")

print("Number of onset after death " + str(num_onset_after_death))
print("Number of extreme late deaths: " + str(num_extreme_late_deaths))
