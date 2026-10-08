# Slimme Boodschappen

Mobiele webapp: boodschappenlijst invoeren → app zoekt supermarkten in de buurt → kiest de beste 1–2 winkels op basis van besparing, afstand en aantal winkels.

## Bestanden

```
slimme-boodschappen/
├── index.html              ← de complete app (alles in één bestand)
├── data/
│   └── aanbiedingen.json   ← actuele aanbiedingen (wekelijks bijwerken)
└── README.md
```

## Online zetten (GitHub Pages)

1. Maak op GitHub een nieuwe repository, bv. `slimme-boodschappen`.
2. Upload `index.html`, `README.md` en de map `data/` (Add file → Upload files).
3. Settings → Pages → Source: *Deploy from a branch* → `main` / `(root)` → Save.
4. Na ±1 minuut staat de app op `https://<jouw-naam>.github.io/slimme-boodschappen/`.
5. Op de telefoon openen en via "Zet op beginscherm" als app vastzetten.

## Aanbiedingen bijwerken

Twee manieren:

- **In de app** (tab *Aanbiedingen*): regels plakken in het formaat
  `Winkel; Product; Verpakking; Normale prijs; Aanbieding; Geldig t/m`
  Voorbeeld: `Jumbo; Douwe Egberts filterkoffie; 500 g; 8,99; 6,99; 12-10`
  Aanbieding mag ook zijn: `1+1`, `2e halve prijs`, `2 voor 5,00`, `25%`.
  Wordt bewaard op dat toestel.
- **Gedeeld via GitHub**: in de app op *Exporteer als aanbiedingen.json* drukken, bestand vervangen in `data/` en committen. Dan zien alle telefoons dezelfde aanbiedingen.

Verlopen aanbiedingen worden automatisch genegeerd.

## Gebruikte openbare diensten (gratis, geen sleutel nodig)

| Wat | Dienst |
|---|---|
| Woonplaats/postcode → coördinaten | PDOK Locatieserver (overheid) |
| Supermarkten in de buurt | OpenStreetMap via Overpass API |
| Rijafstand en reistijd | OSRM demo-server (valt terug op hemelsbrede afstand, dit wordt dan vermeld) |

## Instellingen aanpassen

Bovenin `index.html` staat `const CONFIG = {...}`: standaardafstand, gewichten per voorkeur, kosten per km, "gedoe" per extra winkel en de productwoordenlijst (synoniemen/uitsluitingen, bv. koffiemelk ≠ koffie).
