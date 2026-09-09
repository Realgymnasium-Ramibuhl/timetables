/*
 * frame-refresh.js — Hintergrund-Aktualisierung der iFrames (Doppelpufferung)
 *
 * Statt die ganze Seite per <meta http-equiv="refresh"> neu zu laden, wird
 * pro Panel ein zweiter iFrame unsichtbar geladen und erst nach dem
 * load-Event eingeblendet. Auf dem Display ist der Wechsel nicht zu sehen.
 *
 * Zwei Punkte, an denen die naive Lösung scheitert:
 *
 *  1. visibility:hidden verhindert das Rastern. Der Buffer würde erst beim
 *     Einblenden gezeichnet und dabei kurz schwarz aufblitzen. Deshalb
 *     opacity:0 — so bleibt der Frame im Compositor und wird gezeichnet.
 *  2. Der alte Frame wird erst entfernt, wenn der neue vollständig deckend
 *     darüber liegt. Dadurch ist nie der schwarze Hintergrund zu sehen.
 *
 * Verwendung:
 *
 *   FrameRefresh.start({
 *     frames: [ { id: 'frame1', height: '1660px' }, { id: 'frame3' } ],
 *     interval: 600000
 *   });
 *
 * In den Minuten :05-:09 und :35-:39 wird nicht getauscht, siehe blackout
 * unten. Mit blackout: [] lässt sich das abschalten.
 */
(function (global) {
  'use strict';

  var defaults = {
    interval: 600000,        // Abstand zwischen zwei Aktualisierungen
    stagger: 5000,           // Versatz, damit nie alle Panels gleichzeitig laden
    loadTimeout: 60000,      // Buffer verwerfen, wenn er nicht lädt
    paintDelay: 800,         // Zeit zum Zeichnen, bevor eingeblendet wird
    fadeMs: 400,             // Dauer der Überblendung
    cacheBuster: true,       // _ts-Parameter anhängen
    nightlyReloadHour: 3,    // Sicherheitsnetz; null schaltet es ab

    // Sperrminuten: In diesen Minuten wird nicht getauscht.
    //
    // Das Intranet liefert regelmässig kurz nach der vollen und der halben
    // Stunde eine 502-Fehlerseite — gemessen zwischen +5:58 und +9:07, meist
    // um +6:30. Die Störung dauert nur Sekunden, die Anzeige würde die
    // Fehlerseite aber bis zur nächsten Aktualisierung stehen lassen, also
    // bis zu zehn Minuten. Wer in diesen Minuten gar nicht erst tauscht,
    // kann die Fehlerseite auch nicht erwischen.
    //
    // Angegeben als Minutenbereiche [von, bis], jeweils einschliesslich.
    // Leeres Array schaltet die Sperre ab.
    blackout: [[5, 9], [35, 39]]
  };

  // 0, wenn gerade getauscht werden darf; sonst die Millisekunden bis zum
  // Ende der Sperre.
  function blackoutRest(cfg, now) {
    var bereiche = cfg.blackout || [];
    now = now || new Date();
    var m = now.getMinutes();
    for (var i = 0; i < bereiche.length; i++) {
      if (m >= bereiche[i][0] && m <= bereiche[i][1]) {
        var ende = new Date(now.getTime());
        ende.setMinutes(bereiche[i][1] + 1, 0, 0);   // rollt korrekt über die Stunde
        return ende - now;
      }
    }
    return 0;
  }

  // Die Überblendung gilt nur für den Buffer, nicht dauerhaft für jeden
  // iFrame: sonst würde sie auch Umschaltlogik der Info-Seiten verzögern.
  function injectStyle(fadeMs) {
    if (document.getElementById('fr-style')) return;
    var style = document.createElement('style');
    style.id = 'fr-style';
    style.textContent = '.fr-fading { transition: opacity ' + fadeMs + 'ms linear; }';
    document.head.appendChild(style);
  }

  function bust(url, enabled) {
    if (!enabled) return url;
    return url + (url.indexOf('?') === -1 ? '?' : '&') + '_ts=' + Date.now();
  }

  // requestAnimationFrame pausiert in Hintergrund-Tabs. Ohne Fallback bliebe
  // der Tausch dort stehen und die Buffer würden sich ansammeln.
  function afterPaint(cfg, callback) {
    var done = false;
    function run() {
      if (done) return;
      done = true;
      callback();
    }
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { setTimeout(run, cfg.paintDelay); });
    });
    setTimeout(run, cfg.paintDelay + 2000);
  }

  // Mehrere Seiten stylen die Panels über #frame1/#frame3 statt über den
  // iframe-Selektor. Der Buffer trägt die id aber erst nach dem Tausch und
  // bekommt diese Regeln daher nicht – er stünde sichtbar in falscher Größe
  // da. Deshalb die aufgelöste Geometrie inline mitgeben und wieder
  // entfernen, sobald die id gesetzt ist.
  var GEOMETRY = ['width', 'height', 'transform', 'transform-origin', 'background-color'];

  function copyGeometry(from, to) {
    var computed = getComputedStyle(from);
    var added = [];
    GEOMETRY.forEach(function (prop) {
      if (from.style.getPropertyValue(prop)) return;   // steht inline, wird ohnehin geklont
      to.style.setProperty(prop, computed.getPropertyValue(prop));
      added.push(prop);
    });
    return added;
  }

  function dropGeometry(el, props) {
    props.forEach(function (prop) { el.style.removeProperty(prop); });
  }

  function applyHeight(frame, spec) {
    if (spec.height) frame.style.height = spec.height;
  }

  function refresh(spec, cfg) {
    var current = document.getElementById(spec.id);
    if (!current || current.dataset.swapping === '1') return;

    // In den Sperrminuten nicht tauschen, sondern kurz danach nachholen. Der
    // Zufallsanteil verteilt die nachgeholten Tausche, damit nicht alle
    // Panels im selben Moment laden.
    var rest = blackoutRest(cfg);
    if (rest > 0) {
      if (current.dataset.deferred === '1') return;   // schon eingeplant
      current.dataset.deferred = '1';
      setTimeout(function () {
        var el = document.getElementById(spec.id);
        if (el) el.dataset.deferred = '0';
        refresh(spec, cfg);
      }, rest + Math.floor(Math.random() * 20000));
      return;
    }

    // Erst klonen, dann die Flagge setzen: sonst erbt der Buffer
    // data-swapping="1" und der nächste Durchlauf bricht sofort ab.
    var next = current.cloneNode(false);
    next.removeAttribute('id');
    next.removeAttribute('data-swapping');
    next.removeAttribute('data-deferred');   // sonst erbt der Buffer die Sperrmarke
    next.classList.add('fr-fading');
    next.style.opacity = '0';
    next.style.visibility = 'visible';   // muss gezeichnet werden
    next.src = bust(spec.url, cfg.cacheBuster);

    var addedGeometry = copyGeometry(current, next);

    current.dataset.swapping = '1';

    var settled = false;

    var timer = setTimeout(function () {
      if (settled) return;
      settled = true;
      if (next.parentNode) next.parentNode.removeChild(next);
      current.dataset.swapping = '0';   // alte Anzeige bleibt einfach stehen
    }, cfg.loadTimeout);

    next.addEventListener('load', function () {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      applyHeight(next, spec);

      afterPaint(cfg, function () {
        // Sichtbarkeit des alten Frames erst hier auslesen: die Info-Seiten
        // blenden frame3 gegen info.png um, der Zustand kann sich seit dem
        // Start des Tauschs geändert haben.
        var wasHidden = current.style.opacity === '0';
        next.style.opacity = wasHidden ? '0' : '1';

        setTimeout(function () {
          next.style.visibility = current.style.visibility;
          next.style.opacity = current.style.opacity;
          if (current.parentNode) current.parentNode.removeChild(current);
          next.id = spec.id;
          next.classList.remove('fr-fading');
          dropGeometry(next, addedGeometry);   // ab jetzt greifen die id-Regeln
          applyHeight(next, spec);             // Höhenkorrektur danach erneut setzen
        }, cfg.fadeMs + 100);
      });
    });

    // direkt hinter dem aktuellen Frame einfügen statt ans Ende: sonst
    // ändert sich die Stapelreihenfolge gegenüber #image auf den Info-Seiten.
    current.parentNode.insertBefore(next, current.nextSibling);
  }

  function scheduleNightlyReload(hour) {
    if (hour === null || hour === undefined) return;
    var now = new Date();
    var next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    setTimeout(function () { location.reload(); }, next - now);
  }

  function start(options) {
    var cfg = {};
    Object.keys(defaults).forEach(function (k) {
      cfg[k] = (options && options[k] !== undefined) ? options[k] : defaults[k];
    });

    injectStyle(cfg.fadeMs);

    (options.frames || []).forEach(function (spec, i) {
      var frame = document.getElementById(spec.id);
      if (!frame) return;

      spec.url = frame.getAttribute('src');
      frame.addEventListener('load', function () { applyHeight(frame, spec); });

      setTimeout(function () {
        setInterval(function () { refresh(spec, cfg); }, cfg.interval);
      }, i * cfg.stagger);
    });

    scheduleNightlyReload(cfg.nightlyReloadHour);
  }

  // blackoutRest wird für Tests mit herausgegeben.
  global.FrameRefresh = { start: start, blackoutRest: blackoutRest };
})(window);
