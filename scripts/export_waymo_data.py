import argparse
import csv
import json
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('quarterly_csv', type=Path)
args = parser.parse_args()
rows = []
with args.quarterly_csv.open() as handle:
    for row in csv.DictReader(handle):
        miles = int(float(row['miles']))
        crashes = int(row['crashes'])
        if miles <= 0 or crashes < 0:
            raise ValueError('Invalid mileage or crash count')
        rows.append({
            'quarter': row['quarter'].replace(' ', '').replace('Q', ' Q'),
            'crashes': crashes,
            'miles': miles,
            'miles_millions': miles / 1e6,
            'rate': crashes / miles * 1e6,
        })
if len({row['quarter'] for row in rows}) != len(rows):
    raise ValueError('Duplicate quarter')
rows.sort(key=lambda row: row['quarter'])
output = Path(__file__).resolve().parents[1] / 'static/data/waymo-quarterly.json'
output.write_text(json.dumps({
    'description': 'Waymo driverless ADS crash reports and published rider-only miles, all reported locations.',
    'period': '2024 Q3–2026 Q2',
    'sources': [
        'https://www.nhtsa.gov/laws-regulations/standing-general-order-crash-reporting',
        'https://waymo.com/safety/impact/',
    ],
    'quarters': rows,
}, indent=2) + '\n')
print(output)
