# fault-assistant — Offline maintenance fault assistant

A technician describes (or types/speaks) a fault and gets the matching troubleshooting
steps from a manual stored **on the device**, in **English or Gujarati**. Works fully
offline: no server, no cloud APIs, no external fonts or scripts.

## Features
- Text search in English and Gujarati (Hinglish/Gujarati synonyms such as `garam`, `dabav`, `ગરમ`, `દબાણ`)
- Results show numbered steps with tick-boxes (progress is kept on the device)
- Browse all procedures offline
- Voice input where the device's browser supports it
- Photo capture of the nameplate/panel; the photo stays on the device
- Installable PWA with a service worker that caches the app and manual for offline use
- Manual ingestion from structured Markdown **or** long PDFs (page-level search)

## Quick start
```bash
# 1. Build the on-device manual index (from the sample, or your own files)
python3 tools/build_index.py manuals/sample_pump_manual.md
#    your PDF:  pip install pypdf && python3 tools/build_index.py --pdf manuals/plant_manual.pdf

# 2. Run tests (no dependencies)
node tests/search.test.js

# 3. Serve the app (any static server; for the field, copy the folder to a phone/tablet)
cd app && python3 -m http.server 8000
# open http://<host>:8000 once while online so the service worker caches everything
```

## Writing your manual (structured Markdown)
```
# SECTION: motor-overheating
tags: overheat, hot, garam, ગરમ, તાપમાન
## en
Title: Motor is overheating
Symptoms: Casing too hot, high temperature alarm.
Steps:
1. Stop and isolate the motor.
2. Check ventilation.
## gu
Title: મોટર વધુ ગરમ થાય છે
Steps:
1. મોટર બંધ કરો.
2. હવાની અવરજવર તપાસો.
```
Add a `## gu` block for each procedure to get Gujarati answers; the same `tags` line should
include the words technicians actually use (both languages).

## Layout
```
app/            offline web app (index.html, app.js, search.js, sw.js, styles.css)
app/data/       generated manual index (manual.json) — built, do not edit by hand
manuals/        source manuals (sample provided)
tools/          build_index.py — Markdown/PDF -> manual.json
tests/          search.test.js — offline search regression tests
```

## Limitations / next steps
- Photo recognition (reading fault codes from a photo with OCR) is not included; the technician
  types the code shown in the photo. Adding on-device OCR (e.g. Tesseract with Gujarati data) is the next step.
- The sample manual is illustrative only. Verify all procedures against your equipment manual before use.
- Voice recognition depends on the device; Gujarati voice needs the Gujarati speech pack installed.
