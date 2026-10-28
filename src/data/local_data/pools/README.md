# Pool Spy — swimming-pool detections (Mairangi Bay)

Backyard swimming-pool detections for the Mairangi Bay area (Auckland, New
Zealand), bundled for the **Pool Spy** layer (`local-pools`).

- Source: Wasabi Digital aerial-imagery detection pipeline (YOLO on Esri
  World Imagery / LINZ aerial tiles), reprojected to WGS84 (EPSG:4326)
- License: detection results © Wasabi Digital. Base imagery remains the
  property of its providers (Esri / LINZ) and is **not** redistributed here.
- Feature count: 204
- Runtime file: `mairangi-pools.geojsonl`

Each feature is a `Point` (detection centroid) with these properties:

| Property | Meaning |
| --- | --- |
| `id` | Stable detection id (`pool-<n>`) |
| `confidence` | Detector confidence, 0–1 |
| `parcel_id` | NZ parcel (Lot/DP) the detection falls within, where resolved |
| `area_m2` | Detected pool area in square metres, where measured |
| `source` | Provenance string |

**Extraction.** 2026-10-28, z19 aerial tiles (900 tiles) over Mairangi Bay;
364 raw boxes → 212 after global NMS → 204 after colour/geometry validation.

**Accuracy caveat.** These are *candidate* detections, not verified pools. A
manual vision pass over 72 detections (the 36 highest- and 36
lowest-confidence crops) found 63 real pools (34/36 and 29/36) ≈ 88%
precision, so confidence is a ranking signal, not a precision guarantee.
Refresh the file (and record the extraction date and query) before replacing
it.
