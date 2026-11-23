import argparse
import csv
import io
import json
import math
import zipfile
from collections import Counter
from decimal import Decimal
from pathlib import Path


def read_table(archive_path, filename):
    with zipfile.ZipFile(archive_path) as archive:
        name = next(name for name in archive.namelist() if name.lower().split('/')[-1] == filename)
        with archive.open(name) as handle:
            yield from csv.DictReader(io.TextIOWrapper(handle, encoding='latin-1'))



def build_locations(records, mileage_dir, legacy_path):
    with legacy_path.open() as handle:
        legacy = list(csv.DictReader(handle))
    location_by_id = {}
    for row in legacy:
        report_id = row['SGO Report ID']
        if report_id in location_by_id:
            assert location_by_id[report_id] == row['Location']
        location_by_id[report_id] = row['Location']
    assert all(row['SGO Report ID'] in location_by_id
               for row in records if row['Year Month'] <= '202509')

    months = ['202406', '202409', '202412', '202503', '202506',
              '202509', '202512', '202603', '202606']
    snapshots = {}
    for month in months:
        with (mileage_dir / f'miles_through_{month}.csv').open() as handle:
            reader = csv.DictReader(handle)
            geography = reader.fieldnames[0]
            snapshots[month] = {row[geography]: Decimal(row['Waymo RO Miles (Millions)'])
                                for row in reader}

    areas = {
        'la': ('Los Angeles', 'LOS_ANGELES', ['Los Angeles']),
        'phoenix': ('Phoenix', 'PHOENIX', ['Maricopa']),
    }
    locations = {}
    for key, (label, depot, counties) in areas.items():
        assert all(row['County'] in counties for row in records
                   if location_by_id.get(row['SGO Report ID']) == depot)
        area_quarters = []
        for previous, current in zip(months, months[1:]):
            quarter = f'{current[:4]} Q{(int(current[4:]) - 1) // 3 + 1}'
            quarter_records = [row for row in records if row['quarter'] == quarter]
            if current <= '202509':
                miles_millions = snapshots[current][depot] - snapshots[previous][depot]
                area_records = [row for row in quarter_records
                                if location_by_id[row['SGO Report ID']] == depot]
                geography = 'legacy location'
            else:
                earlier = (snapshots[previous][depot] if current == '202512'
                           else sum(snapshots[previous][county] for county in counties))
                miles_millions = sum(snapshots[current][county] for county in counties) - earlier
                area_records = [row for row in quarter_records if row['County'] in counties]
                geography = 'county'
            assert miles_millions > 0
            area_quarters.append({
                'quarter': quarter,
                'miles': int(miles_millions * 1000000),
                'miles_millions': float(miles_millions),
                'crashes': len(area_records),
                'injury_crashes': sum(row['Is Any-Injury-Reported'] == 'True' for row in area_records),
                'fatal_crashes': sum(row['Is Any Fatal Injury'] == 'True' for row in area_records),
                'geography': geography,
            })
        locations[key] = {
            'label': label,
            'counties': counties,
            'legacy_location': depot,
            'quarters': area_quarters,
        }
    return locations


def build_driver_benchmarks(path):
    comparisons = {
        'all': ('Police Report', 'Police-reported (non-Dynamic)'),
        'injury': ('Any Injury', 'Any-injury-reported (observed, non-Dynamic)'),
        'fatal': ('Any Fatal', 'Any Fatal'),
    }
    counties = {'la': 'Los Angeles', 'phoenix': 'Maricopa'}
    with path.open() as handle:
        rows = list(csv.DictReader(handle))
    result = {}
    for key, county in counties.items():
        result[key] = {}
        for outcome, (label, comparison) in comparisons.items():
            matches = [row for row in rows if row['County Name'] == county
                       and row['Outcome'] == label
                       and row['Benchmark Comparison'] == comparison
                       and row['Grouping Type'] == 'All Crashes'
                       and row['Conflict Partner Type Group'] == 'All Crashes']
            assert len(matches) == 1, (county, outcome, len(matches))
            result[key][outcome] = {
                'rate': float(matches[0]['Benchmark IPMM']),
                'county': county,
                'comparison': comparison,
            }
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--waymo-records', type=Path, required=True)
    parser.add_argument('--crss-dir', type=Path, required=True)
    parser.add_argument('--fars-dir', type=Path, required=True)
    parser.add_argument('--mileage-dir', type=Path, required=True)
    parser.add_argument('--legacy-crashes', type=Path, required=True)
    parser.add_argument('--driver-benchmarks', type=Path, required=True)
    args = parser.parse_args()
    data_dir = Path(__file__).resolve().parents[1] / 'static/data'
    quarters = json.loads((data_dir / 'waymo-quarterly.json').read_text())['quarters']
    annual = json.loads((data_dir / 'human-annual.json').read_text())['annual']
    with args.waymo_records.open() as handle:
        records = list(csv.DictReader(handle))
    assert len(records) == sum(row['crashes'] for row in quarters)
    assert all(row['Is Police-Reported'] == 'True' for row in records)

    counts = {
        'injury': Counter(row['quarter'] for row in records if row['Is Any-Injury-Reported'] == 'True'),
        'fatal': Counter(row['quarter'] for row in records if row['Is Any Fatal Injury'] == 'True'),
    }
    outcomes = {}
    for outcome in counts:
        outcomes[outcome] = {
            'quarters': [
                dict(row, crashes=counts[outcome][row['quarter']],
                     rate=counts[outcome][row['quarter']] / row['miles_millions'])
                for row in quarters
            ],
            'annual': [],
        }

    for baseline in annual:
        year = baseline['year']
        crss_path = args.crss_dir / f'CRSS{year}CSV.zip'
        severity = {}
        for row in read_table(crss_path, 'accident.csv'):
            assert row['CASENUM'] not in severity
            severity[row['CASENUM']] = int(row['MAX_SEV'])
        total_weight = 0
        injury_weight = 0
        injury_sample = 0
        for row in read_table(crss_path, 'vehicle.csv'):
            if row['UNITTYPE'] != '1':
                continue
            weight = float(row['WEIGHT'])
            total_weight += weight
            if severity[row['CASENUM']] in {1, 2, 3, 4, 5}:
                injury_weight += weight
                injury_sample += 1
        assert math.isclose(total_weight, baseline['estimated_crash_involvements'], rel_tol=1e-9)
        outcomes['injury']['annual'].append({
            'year': year,
            'sampled_vehicles': injury_sample,
            'estimated_crash_involvements': injury_weight,
            'miles_millions': baseline['miles_millions'],
            'rate': injury_weight / baseline['miles_millions'],
        })

        fatal_count = 0
        for row in read_table(args.fars_dir / f'FARS{year}NationalCSV.zip', 'vehicle.csv'):
            if row['UNITTYPE'] == '1' and int(row['STATE']) <= 56:
                fatal_count += 1
        outcomes['fatal']['annual'].append({
            'year': year,
            'crash_involvements': fatal_count,
            'miles_millions': baseline['miles_millions'],
            'rate': fatal_count / baseline['miles_millions'],
        })
        print(year, 'injury estimate', round(injury_weight), 'fatal involvements', fatal_count, flush=True)

    locations = build_locations(records, args.mileage_dir, args.legacy_crashes)

    payload = {
        'description': 'Vehicle involvements in police-reported crashes, classified by whether anyone in the crash was injured or fatally injured. Injury includes fatal crashes. Mileage denominators match the all-crashes series.',
        'injury_definition': 'CRSS crash-level MAX_SEV values 1–5, joined by CASENUM to in-transport VEHICLE records and weighted by VEHICLE.WEIGHT. Unknown injury status is excluded. Waymo uses Is Any-Injury-Reported=True.',
        'fatal_definition': 'FARS in-transport VEHICLE records for the 50 states and DC. Waymo uses Is Any Fatal Injury=True. These count vehicle involvements in fatal crashes, including vehicles with no occupant fatality.',
        'sources': [
            'https://waymo.com/safety/impact/',
            'https://www.nhtsa.gov/crash-data-systems/crash-report-sampling-system',
            'https://www.nhtsa.gov/crash-data-systems/fatality-analysis-reporting-system',
            'https://www.fhwa.dot.gov/policyinformation/statistics/2024/vm202.cfm',
        ],
        'outcomes': outcomes,
        'locations': locations,
        'driver_benchmarks': build_driver_benchmarks(args.driver_benchmarks),
        'driver_benchmark_definition': 'Published county-level, non-dynamic human-driver benchmarks from Waymo CSV3. Injury uses the observed benchmark without an underreporting correction. Multi-location benchmarks are weighted by Waymo mileage over the displayed quarters; they are fixed references, not annual observations.',
        'driver_benchmark_source': 'https://storage.googleapis.com/waymo-uploads/files/documents/safety/safety-impact-data/CSV3%20-%20Collision%20Counts%20and%20Comparison%20to%20Benchmarks%20202009-202606-2022benchmark.csv',
        'location_definition': 'Los Angeles and Phoenix use archived CSV2 Location labels with matching depot mileage through 2025 Q3, then their corresponding counties. Their location-to-county crosswalk is verified against historical crash records. All locations uses the national driver trend; selected locations use published county driver benchmarks.',
        'legacy_crash_source': 'https://storage.googleapis.com/waymo-uploads/files/documents/safety/safety-impact-data/CSV2%20-%20Crashes%20with%20SGO%20ID%20and%20Group%20Membership%20202009-202509-2022benchmark.csv',
    }
    output = data_dir / 'crash-outcomes.json'
    output.write_text(json.dumps(payload, indent=2) + '\n')
    print(output, flush=True)


if __name__ == '__main__':
    main()
