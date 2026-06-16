# JB7 UAE Auto Workshop

An original offline-first desktop app for UAE auto workshops. It is designed as a standalone Windows-ready Electron application with no subscription checks, cloud login, or internet requirement.

This project does not modify, crack, or redistribute any third-party installer. It implements common auto repair shop workflows in a new codebase.

## Workshop features

- Dashboard for active jobs, appointments, revenue, balances, and low-stock alerts
- Customer, fleet, and vehicle records with UAE plate, VIN, odometer, and emirate fields
- Job cards and work orders with technician assignment, approval status, inspection notes, and recommendations
- Tax invoices and estimates with AED formatting, 5% VAT, TRN, payment tracking, and print/PDF support
- Inventory for parts, tires, services, consumables, suppliers, prices, and reorder levels
- Appointment calendar with offline booking status
- Reports for VAT summary, job pipeline, and invoice ledger
- Local JSON backup export/import for shop-controlled data portability

## Development

```bash
npm install
npm run dev
```

## Desktop development

```bash
npm run desktop:dev
```

## Build and package

```bash
npm run build
npm run desktop:pack
```

To create a Windows NSIS installer, run this on a Windows build machine:

```bash
npm run desktop:build:win
```

## Offline data

The app stores workshop records in local browser/Electron storage under `jb7-uae-workshop-offline-v1`. Use **Export backup** before reinstalling or moving devices.
