<img src="https://www.rgzh.ch/themes/AK/svg/rb/lion.svg" align="right" height="100" width="100">

# Stundenplan-Anzeigen

Vollbild-Seiten für die Infoscreens in den Foyers und Lehrerzimmern. Jede Seite
bettet den öffentlichen Tagesstundenplan aus dem TAM-Intranet per iFrame ein,
skaliert ihn auf die Auflösung des jeweiligen Displays und aktualisiert die
Panels alle 10 Minuten im Hintergrund.

## Anzeigen

| Standort | Seite | Inhalt |
| --- | --- | --- |
| RG Foyer | [RG_Foyer.html](https://realgymnasium-ramibuhl.github.io/timetables/RG_Foyer.html) | Heute, Morgen, Übermorgen |
| RG Lehrerzimmer | [RG_Lehrerzimmer.html](https://realgymnasium-ramibuhl.github.io/timetables/RG_Lehrerzimmer.html) | Heute, Morgen |
| RG Lehrerzimmer 2025 | [RG_Lehrerzimmer_25.html](https://realgymnasium-ramibuhl.github.io/timetables/RG_Lehrerzimmer_25.html) | Heute, Morgen, Infoboard |
| LG Foyer / Lehrerzimmer | [LG_Foyer_Lehrerzimmer.html](https://realgymnasium-ramibuhl.github.io/timetables/LG_Foyer_Lehrerzimmer.html) | Heute, Morgen, lgr.ch/infoscreen |
| LG Foyer / Lehrerzimmer, Info | [LG_Foyer_Lehrerzimmer_info.html](https://realgymnasium-ramibuhl.github.io/timetables/LG_Foyer_Lehrerzimmer_info.html) | wie oben, zusätzlich `info.png` im Wechsel |
| LG Foyer / Lehrerzimmer, Info 5 min | [LG_Foyer_Lehrerzimmer_info_5min.html](https://realgymnasium-ramibuhl.github.io/timetables/LG_Foyer_Lehrerzimmer_info_5min.html) | wie oben, kürzerer Wechseltakt |
| RG Foyer — Demo | [RG_Foyer_demo.html](https://realgymnasium-ramibuhl.github.io/timetables/RG_Foyer_demo.html) | wie RG Foyer, aber Tausch jede Minute mit Statusanzeige |
| LG Foyer, Info — Demo | [LG_Foyer_Lehrerzimmer_info_demo.html](https://realgymnasium-ramibuhl.github.io/timetables/LG_Foyer_Lehrerzimmer_info_demo.html) | wie LG Info, aber Tausch jede Minute mit Statusanzeige |
| NW Foyer | [NW_Foyer.html](https://realgymnasium-ramibuhl.github.io/timetables/NW_Foyer.html) | Heute für KRR, KRL und KRM nebeneinander |

## Datenquellen

- Stundenplan: `https://intranet.tam.ch/{krr|krl|krm}/public/timetable/daily-class-schedule?dayShort={today|tomorrow|dayAfterTomorrow}`
- Infoboard: `https://intranet.tam.ch/krr/public/info/show/template/1/layout/1`
- LG Infoscreen: `https://www.lgr.ch/infoscreen`

Die Kürzel stehen für die Schulen am Standort: `krr` Realgymnasium,
`krl` Literargymnasium, `krm` Mathematisch-Naturwissenschaftliches Gymnasium.

## Hardware

Ausgelegt auf 3840x2160 (16:9): Prowise 86" in den Foyers, Samsung 68" im
RG-Lehrerzimmer. Die Skalierung ist pro Seite im `<style>`-Block hart
eingestellt, ein neues Display braucht also eine angepasste `transform: scale()`.

## Aktualisierung im Hintergrund

Die Seiten laden sich nicht mehr per `<meta http-equiv="refresh">` komplett neu
— das war auf dem Display als kurzes schwarzes Aufblitzen zu sehen. Stattdessen
lädt [`frame-refresh.js`](frame-refresh.js) pro Panel einen zweiten iFrame
unsichtbar im Hintergrund und blendet ihn erst ein, wenn er fertig geladen und
gezeichnet ist. Der alte Frame wird erst danach entfernt.

Jede Seite konfiguriert das am Ende selbst:

```js
FrameRefresh.start({
  frames: [ { id: 'frame1', height: '1660px' }, { id: 'frame3' } ],
  interval: 600000
});
```

`height` ist die Höhenkorrektur gegen den abgeschnittenen unteren Rand und
unterscheidet sich je nach Display (1660px bzw. 1659px). Panels ohne Angabe
behalten die Höhe aus dem CSS. Weitere Optionen mit ihren Vorgabewerten stehen
oben in `frame-refresh.js`.

Lädt ein Panel nicht (Intranet nicht erreichbar), bleibt die bisherige Anzeige
stehen, statt schwarz zu werden.

## Demo-Seiten

Die beiden `_demo`-Seiten sind zum Zuschauen da, nicht für den Betrieb. Sie
laden jedes Panel jede Minute statt alle 10 Minuten neu und blenden zwei
Beobachtungsfenster ein, die selbst nichts an der Logik ändern:

- unten links der Zustand jedes Panels (lädt / getauscht), die Zahl der Tausche
  und die Zeit bis zum nächsten,
- unten rechts die `postMessage`-Nachrichten der eingebetteten Seiten mit
  Uhrzeit, Origin und Panel. Der Inhalt wird nur als Text gesetzt, nie als
  HTML, und nichts wird beantwortet.

`RG_Foyer_demo.html` zeigt den einfachen Fall: drei gleich gestylte Panels.
`LG_Foyer_Lehrerzimmer_info_demo.html` deckt zusätzlich die beiden Sonderfälle
ab, die nur die LG- und die Lehrerzimmer-25-Seite haben — `frame3` wird über
`#frame3` gestylt statt über den `iframe`-Selektor, und `frame3` kann im Moment
des Tauschs von `info.png` verdeckt sein. Beide Seiten laufen ohne den
nächtlichen Reload.

## Betrieb

Die Dateien werden über GitHub Pages von `main` ausgeliefert. **Achtung:** weil
die Seite sich nicht mehr komplett neu lädt, erreichen Änderungen an den
HTML-Dateien ein laufendes Display erst beim nächtlichen Reload um 03:00 —
oder sofort, wenn das Display von Hand neu geladen wird. Neue Stundenplandaten
kommen davon unabhängig alle 10 Minuten an.

`info.png` wird relativ referenziert und liegt neben den HTML-Dateien. Wird das
Bild ersetzt, den Dateinamen beibehalten.
