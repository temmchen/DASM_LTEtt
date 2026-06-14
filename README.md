# Labor DASM — Virtuelles Labor zur Drehstrom-Asynchronmaschine

Ein vollständiges, browserbasiertes Schülerlabor zur **Drehstrom-Asynchronmaschine (DASM)**
für den Elektrotechnik-Unterricht am *Lycée technique d'Ettelbruck*.

Die Schüler·innen durchlaufen vier Phasen: **Theorie → Antestat → virtueller Versuch → Auswertung**.
Am Ende laden sie zwei PDF-Protokolle herunter (Antestat-Ergebnis und Messprotokoll), die sie
an die Lehrkraft abgeben. Beide PDFs tragen einen **Prüfcode** gegen nachträgliche Manipulation.

---

## 1. Inhalt / Dateistruktur

```
virtuelles DASM Labor/
├── index.html              Startseite mit Übersicht + animierter Maschine
├── theorie.html            Theorie: Aufbau, Schlupf, Kloss, Kippmoment, Wirkungsgrad
├── antestat.html           Eingangstest (randomisierte Fragen, gesperrte Antworten, PDF)
├── labor.html              Virtueller Prüfstand (Kennlinie, Kippmoment, Bewertung, PDF)
├── styles.css              Gemeinsames Design ("Kupfer & Phosphor") — Quelldatei
├── erzeuge_kennlinien.py   Python-Skript, das die Kennlinien-Bilder erzeugt
├── js/
│   ├── antestat.js         Fragengenerator, Bewertung, PDF-Export
│   └── labor.js            Physiksimulation, Messwerterfassung, Bewertung, PDF-Export
└── bilder/
    ├── kennlinie_drehmoment.png
    ├── kennlinie_belastung.png
    ├── kennlinie_strom.png
    ├── kennlinie_wirkungsgrad.png
    ├── kloss.png
    ├── leistungsbilanz.png
    └── kennwerte.json      Kontrollwerte der Beispielmaschine
```

---

## 2. Starten

### Lokal (zum Ausprobieren)
Einfach `index.html` im Browser öffnen — per Doppelklick genügt. Jede HTML-Seite ist
**selbstständig**: Design (CSS) und Seitenlogik (JavaScript) sind direkt eingebettet, es gibt
also keine Pfadprobleme. Die Dateien `styles.css` und der Ordner `js/` bleiben als gut lesbare
**Quelldateien** erhalten; wer Anpassungen vornehmen will, ändert dort und überträgt sie in den
`<style>`- bzw. `<script>`-Block der Seiten (oder bearbeitet den eingebetteten Block direkt).

**Wichtig:** Für Formelsatz, Diagramm und PDF-Erzeugung wird eine Internetverbindung benötigt,
weil drei Bibliotheken über ein CDN geladen werden:

- **MathJax** – Formelsatz auf der Theorieseite
- **Chart.js** – Live-Kennlinie im Labor
- **jsPDF** – PDF-Erzeugung der Protokolle

Ohne Internet werden Formeln, Diagramm und PDF-Download nicht funktionieren (die Simulation
selbst läuft trotzdem).

### Auf GitHub Pages (empfohlen für den Unterricht)
1. Den gesamten Ordnerinhalt in ein GitHub-Repository legen (Dateien im Wurzelverzeichnis).
2. Unter **Settings → Pages** als Quelle den `main`-Branch / `/root` wählen.
3. Nach kurzer Zeit ist das Labor unter `https://<benutzername>.github.io/<repo>/` erreichbar.
4. Diesen Link an die Klasse weitergeben.

> Die Seiten verlinken untereinander **relativ**, funktionieren also in jedem Unterordner.

---

## 3. Ablauf für die Schüler·innen

| Phase | Seite | Was passiert |
|------|-------|--------------|
| 1 | `theorie.html` | Durcharbeiten der Grundlagen (Formeln, Kennlinien). |
| 2 | `antestat.html` | 10 **zufällig** ausgewählte Fragen, jede·r bekommt einen anderen Satz. Antworten sind nach Bestätigung **gesperrt**. Am Ende **PDF** herunterladen und abgeben. |
| 3 | `labor.html` | Maschine einschalten, schrittweise belasten, Messpunkte aufnehmen, Kippmoment finden. Fehlbedienung → Punktabzug. |
| 4 | `labor.html` (Auswertung) | Kennlinie + ermittelte Kennwerte (M_K, s_K, η). **Messprotokoll-PDF** herunterladen und abgeben. |

---

## 4. Bewertung am Prüfstand

Jede·r startet mit **100 Punkten**. Punktabzug erfolgt automatisch bei:

- **Bremse belastet, obwohl die Maschine nicht läuft** (−10)
- **Anlauf unter zu hoher Last** (Maschine kommt nicht hoch) (−10)
- **Mehrfaches/unkontrolliertes Kippen** (−8 je weiteres Mal; das *erste* Kippen ist zum
  Auffinden des Kippmoments vorgesehen und kostet nichts)
- **Zu langes Verharren im Kippzustand** → Motorschutz löst aus (−15)

Alle Ereignisse erscheinen mit Uhrzeit im **Ereignisprotokoll** und der Punktestand steht
oben rechts am Prüfstand. Der erreichte Wert wird ins PDF übernommen.

---

## 5. Manipulationsschutz (Prüfcode)

Beide PDFs enthalten am Ende einen **Prüfcode**, der aus den tatsächlichen Antworten bzw.
Messwerten und dem Punktestand berechnet wird (Hashwert).

- Das Antestat-PDF nutzt einen SHA-256-basierten Code über die kanonische Antwortfolge.
- Das Messprotokoll nutzt einen kombinierten Hash über die Messreihe.

Verändert jemand das PDF nachträglich (z. B. Punktzahl oder Antworten), passt der Code nicht
mehr zu den dargestellten Werten.

> **Hinweis zur Sicherheit:** Da alles im Browser läuft, ist dies ein **Abschreckungs-Mechanismus**,
> kein kryptografisch sicherer Nachweis. Für hohe Verbindlichkeit empfiehlt sich zusätzlich eine
> kurze mündliche Rückfrage oder die Abgabe über die Schulplattform. Wer den Code serverseitig
> verifizieren möchte, kann den Hash-Algorithmus aus `js/antestat.js` (`pruefcodeBerechnen`)
> bzw. `js/labor.js` (`laborPruefcode`) nachbauen.

---

## 6. Daten der Beispielmaschine (für die Korrektur)

Käfigläufer-Asynchronmotor, Sternschaltung:

| Größe | Wert |
|-------|------|
| Bemessungsleistung P_N | 1,5 kW |
| Spannung U_N | 400 V (Y), Strang 230 V |
| Frequenz f | 50 Hz |
| Polpaarzahl p | 2 |
| Synchrondrehzahl n_s | 1500 1/min |
| Nenndrehzahl n_N | ≈ 1420 1/min |
| Nennmoment M_N | ≈ 10,1 Nm |
| Nennstrom I_N | ≈ 3,2 A |
| cos φ (Nennlast) | ≈ 0,80 |
| Wirkungsgrad η | ≈ 85 % |
| **Kippmoment M_K** | **≈ 24,3 Nm** |
| **Kippschlupf s_K** | **≈ 0,285 (28,5 %)** |
| Kippdrehzahl n_K | ≈ 1073 1/min |
| Anzugsmoment M_A | ≈ 14,4 Nm |

Die Simulation und alle Kennlinien-Bilder verwenden **dasselbe** Γ-Ersatzschaltbild, die Werte
sind daher konsistent. Die Bremse misst das **Wellenmoment**; das gemessene Kippmoment liegt
deshalb minimal unter dem berechneten Luftspaltwert (Reibung). Diese Abweichung wird in der
Auswertung erklärt und ist ein bewusster didaktischer Punkt.

### Erwartetes Schülerergebnis
Eine saubere Messreihe ergibt einen Kennlinienverlauf wie in `bilder/kennlinie_belastung.png`,
ein gemessenes Kippmoment um **24 Nm** und einen besten Wirkungsgrad nahe der Nennlast (~85 %).

---

## 7. Anpassen

- **Andere Maschine:** Die Parameter stehen oben in `js/labor.js` (Objekt `P`) und in
  `erzeuge_kennlinien.py`. Nach Änderung das Python-Skript erneut ausführen, um die Bilder neu
  zu erzeugen:
  ```bash
  pip install matplotlib numpy
  python erzeuge_kennlinien.py
  ```
- **Anzahl Antestat-Fragen:** Konstante `ANZAHL_FRAGEN` in `js/antestat.js`.
- **Fragenpool erweitern:** Weitere Generator-Funktionen in `js/antestat.js` schreiben und in
  das Array `GENERATOREN` aufnehmen.
- **Punkteregeln:** Funktion `abzug(...)`-Aufrufe in `js/labor.js`.

---

## 8. Didaktischer Hinweis

Das Labor ersetzt nicht den realen Versuch, eignet sich aber für Vorbereitung, Vertretungs-
stunden, Distanzunterricht oder zur Differenzierung. Da jede·r einen anderen Aufgabensatz und
eine eigene Messreihe erzeugt, wird einfaches Abschreiben erschwert.

Viel Erfolg im Unterricht!
