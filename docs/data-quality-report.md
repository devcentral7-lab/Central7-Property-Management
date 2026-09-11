# Data quality report

Generated: 2026-09-09T13:25:48.458Z

## Table counts

- **C7_Pulse_DB_Dev**: 10680
- **User**: 6
- **Agents**: 4
- **Apartment Complexes**: 125
- **City**: 127
- **Status Update**: 2664
- **Status Update Archive**: 0
- **Republish Queue**: 0
- **Social Media Queue**: 483
- **Messages**: 3

## Properties

```json
{
  "rowCount": 10680,
  "uniqueRefNos": 10680,
  "duplicateRefNos": 0,
  "statusValues": [
    "Active",
    "Closed",
    "Drop",
    "Duplicate",
    "Hold",
    "Lost",
    "Obsolete"
  ],
  "unknownStatuses": [],
  "propertyTypeValues": [
    "Apartment",
    "Commercial Property",
    "Estate",
    "House",
    "Land"
  ],
  "unknownTypes": [],
  "nullRates": {
    "Name of Contact": 0.0001,
    "Contact No 1": 0.0001,
    "City": 0.0353,
    "Status": 0.0037,
    "Price Total": 0.1209
  }
}
```

## Users / passwords

```json
{
  "rowCount": 6,
  "passwordLooksHashed": 6,
  "passwordLooksPlainOrOther": 0,
  "roles": [
    "Admin",
    "User"
  ]
}
```

Place legacy dumps in `data/raw/*.json` (see `scripts/migrate/export-legacy.ts`) then re-run `npm run migrate:profile`.