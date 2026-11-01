# Indian medicine catalogue (prescription name suggestions)

`indian_medicines.json.gz` powers `GET /api/v1/prescriptions/medicine-suggestions`.

- **Source:** [junioralive/Indian-Medicine-Dataset](https://github.com/junioralive/Indian-Medicine-Dataset), MIT License (copy in `LICENSE-dataset.txt`). The upstream repository does not state where its data was collected from.
- **Size:** 252,751 unique products (253,973 rows before removing exact duplicates).
- **Format:** gzip JSON array; each row is `[name, composition, packLabel, manufacturer, discontinued(0|1)]`.
- **Changes from upstream:** prices dropped, whitespace normalised, both composition columns joined with ` + `, exact duplicates removed.

Limits: this is a community dataset, not an official regulator list. It may be out of date or contain errors. It is used only to suggest names while typing. The doctor always confirms what is prescribed, and can type any name that is not in the list.

To refresh: download `DATA/indian_medicine_data.csv` from the source repository and rebuild with the same row format.
