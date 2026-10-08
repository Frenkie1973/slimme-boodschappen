# Slimme Boodschappen

Webapp die voor een boodschappenlijstje berekent waar je het voordeligst boodschappen doet, inclusief reiskosten.

**Live:** https://frenkie1973.github.io/slimme-boodschappen/
**Testversie:** https://frenkie1973.github.io/slimme-boodschappen/beta/

## Wat de app doet
- Inloggen met e-mail en wachtwoord. Alleen goedgekeurde e-mailadressen krijgen toegang (beheer via tab **Beheer**).
- Productzoeker met suggesties, foutcorrectie ("huzaren salede" → huzarensalade) en "Bedoel je…?".
- Vergelijkt per supermarkt in de buurt: aanbiedingen + normale prijzen, rijafstand en autokosten.
- Advies: **Beste keuze (incl. reiskosten)**, Dichtstbij met alles, Laagste boodschappenprijs.
- Statussen: ACTUEEL / VEROUDERD / NIET BESCHIKBAAR. Geen verzonnen prijzen, geen demo-data.

## Bronnen
| Gegevens | Bron | Bijgewerkt |
|---|---|---|
| Aanbiedingen (11 ketens) | PrijsProfeet API (gratis laag, bronvermelding verplicht) | 2× per dag via GitHub Actions |
| Normale prijzen (10 ketens) | Checkjebon.nl (MIT) | dagelijks; app laadt 1× per 20 uur |
| Supermarktlocaties | OpenStreetMap (ODbL) | wekelijks via GitHub Actions |
| Locatie / routes | PDOK Locatieserver / OSRM | live |

## Architectuur
```
GitHub Pages ── index.html (app)            ← live
             └─ beta/index.html             ← testversie
GitHub Actions ─ sync.yml    (06:15 + 18:15) → PrijsProfeet → Firestore (alleen leesbaar voor goedgekeurde gebruikers)
               └ winkels.yml (maandagnacht)  → OpenStreetMap → data/winkels.json
Firebase (Spark, gratis) ─ Authentication + Firestore (regels: firestore.rules)
```

## Mappenstructuur
```
index.html                 app (één bestand)
beta/index.html            testversie
data/winkels.json          supermarktlocaties (automatisch)
sync/sync.mjs              aanbiedingen ophalen → Firestore
sync/winkels.mjs           supermarktlocaties ophalen
sync/package.json
.github/workflows/sync.yml
.github/workflows/winkels.yml
firestore.rules            beveiligingsregels (kopie; actief in Firebase-console)
```
`data/aanbiedingen.json` wordt niet meer gebruikt (was voor v1).

## Beheer
- **Gebruiker toevoegen:** app → Beheer → Toegang → e-mailadres → Toevoegen. Gebruiker maakt zelf een account aan en bevestigt de mail (kan in *Ongewenste e-mail* belanden).
- **Synchronisatie handmatig starten:** GitHub → Actions → "Aanbiedingen synchroniseren" → *Run workflow*.
- **Bron tijdelijk uitzetten:** app → Beheer → vinkje uit.
- **Oude versie terugzetten:** branch `v1-backup`.

## Geheimen
- `FIREBASE_SERVICE_ACCOUNT` staat alleen in GitHub → Settings → Secrets. Nooit in code of chat zetten.
- De Firebase *web*-configuratie in `index.html` is openbaar van aard; beveiliging zit in de Firestore-regels en in de domeinbeperking van de websleutel.

## Kosten
€0: Firebase Spark (geen betaalmethode gekoppeld), GitHub Actions gratis voor openbare repo, PrijsProfeet gratis laag.

## Product toevoegen aan de herkenning
In `index.html` → `CONFIG.products` (strikte definitie voor vergelijken) en `CONCEPTS` (synoniemen voor de zoeker). Eerst in `beta/` testen, daarna naar de hoofdmap kopiëren.
