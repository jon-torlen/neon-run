/* ============================================
   NEON RUN — script.js
   Interacciones nativas, sin dependencias.
   ============================================ */

(() => {
  "use strict";

  /* ---------- Modal de registro ----------
     <dialog> gestiona de forma nativa el foco,
     la tecla Escape y la devolución del foco
     al elemento que lo abrió. */
  const modal = document.getElementById("modal-acceso");
  const form = modal.querySelector(".modal__form");
  const success = modal.querySelector(".modal__success");
  const emailInput = modal.querySelector("#campo-correo");

  // Abrir desde "Comenzar el viaje" y "Acceso anticipado"
  document.querySelectorAll("[data-modal-open]").forEach((button) => {
    button.addEventListener("click", () => modal.showModal());
  });

  // Cerrar con el botón X
  modal
    .querySelector("[data-modal-close]")
    .addEventListener("click", () => modal.close());

  // Cerrar al hacer clic sobre el fondo
  modal.addEventListener("click", (event) => {
    if (event.target === modal) modal.close();
  });

  // Al cerrar, restaurar el estado para la próxima apertura
  modal.addEventListener("close", () => {
    form.hidden = false;
    success.hidden = true;
    form.reset();
  });

  // Envío local: solo confirmación, sin datos enviados ni guardados
  form.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!emailInput.validity.valid) {
      emailInput.reportValidity();
      return;
    }

    form.hidden = true;
    success.hidden = false;
  });

  /* ---------- Fondo en video ----------
     Si el usuario prefiere menos movimiento, se pausa
     y queda el fotograma estático como fondo. */
  const heroVideo = document.querySelector(".hero__video");
  if (heroVideo) {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const applyMotionPreference = () => {
      if (reduceMotion.matches) {
        heroVideo.pause();
      } else {
        heroVideo.play().catch(() => {
          /* Si el navegador bloquea la reproducción,
             la imagen de respaldo permanece visible. */
        });
      }
    };

    applyMotionPreference();
    if (typeof reduceMotion.addEventListener === "function") {
      reduceMotion.addEventListener("change", applyMotionPreference);
    }

    // Si el video falla, se retira y queda solo la imagen
    heroVideo.addEventListener("error", () => {
      heroVideo.remove();
    });
  }

  /* ---------- Menú móvil ---------- */
  const toggle = document.querySelector(".nav__toggle");
  const menu = document.getElementById("menu-principal");

  const closeMenu = () => {
    menu.classList.remove("is-open");
    toggle.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
  };

  toggle.addEventListener("click", () => {
    const isOpen = menu.classList.toggle("is-open");
    toggle.classList.toggle("is-open", isOpen);
    toggle.setAttribute("aria-expanded", String(isOpen));
  });

  // Cerrar al seleccionar cualquier opción del menú
  menu.addEventListener("click", (event) => {
    if (event.target.closest("a, button")) closeMenu();
  });

  /* ============================================
     Radio ambiente generativa (Web Audio API)
     Loop synthwave sintetizado en el navegador:
     pads, bajo, arpegio con eco, bombo y hi-hat.
     Solo se crea tras un gesto del usuario.
     ============================================ */
  let radio = null; // { ctx, master, bus, delay, noise, ... }

  const PROGRESSION = [
    { root: 110.0, pad: [220.0, 261.63, 329.63] },   // La menor
    { root: 87.31, pad: [174.61, 220.0, 261.63] },   // Fa mayor
    { root: 130.81, pad: [196.0, 261.63, 329.63] },  // Do mayor
    { root: 98.0, pad: [196.0, 246.94, 293.66] },    // Sol mayor
  ];

  function createRadio() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();

    // Ruta maestra: bus -> filtro cálido -> volumen -> salida
    const master = ctx.createGain();
    master.gain.value = 0;

    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 2400;
    tone.Q.value = 0.7;

    const bus = ctx.createGain();
    bus.gain.value = 0.9;

    bus.connect(tone);
    tone.connect(master);
    master.connect(ctx.destination);

    // Eco para el arpegio
    const delay = ctx.createDelay(1.2);
    delay.delayTime.value = 0.34;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.3;
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wet);
    wet.connect(bus);

    // Buffer de ruido para el hi-hat
    const noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.2), ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    return {
      ctx, master, bus, delay, noise,
      timer: null,
      nextTime: 0,
      step: 0,
      TEMPO: 84,                        // BPM
      STEP: 60 / 84 / 4,                // semicorchea
      BAR: 16,                          // pasos por compás
    };
  }

  function playPad(t, freqs, dur) {
    freqs.forEach((f) => {
      const osc = radio.ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = f;
      osc.detune.value = Math.random() * 10 - 5;

      const g = radio.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.032, t + dur * 0.35);
      g.gain.linearRampToValueAtTime(0.022, t + dur * 0.8);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);

      osc.connect(g);
      g.connect(radio.bus);
      osc.start(t);
      osc.stop(t + dur + 0.1);
    });
  }

  function playBass(t, freq, dur) {
    const osc = radio.ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = freq;

    const g = radio.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.17, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.connect(g);
    g.connect(radio.bus);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  function playArp(t, freq) {
    const osc = radio.ctx.createOscillator();
    osc.type = "square";
    osc.frequency.value = freq;

    const g = radio.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.045, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);

    osc.connect(g);
    g.connect(radio.bus);
    g.connect(radio.delay);
    osc.start(t);
    osc.stop(t + 0.25);
  }

  function playKick(t) {
    const osc = radio.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(130, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.12);

    const g = radio.ctx.createGain();
    g.gain.setValueAtTime(0.26, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);

    osc.connect(g);
    g.connect(radio.bus);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  function playHat(t) {
    const src = radio.ctx.createBufferSource();
    src.buffer = radio.noise;

    const hp = radio.ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 7000;

    const g = radio.ctx.createGain();
    g.gain.setValueAtTime(0.045, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);

    src.connect(hp);
    hp.connect(g);
    g.connect(radio.bus);
    src.start(t);
    src.stop(t + 0.08);
  }

  function scheduler() {
    const { ctx, STEP, BAR } = radio;
    const ARP_PATTERN = [0, 1, 2, 1];

    while (radio.nextTime < ctx.currentTime + 0.15) {
      const chord = PROGRESSION[Math.floor(radio.step / BAR) % PROGRESSION.length];
      const s = radio.step % BAR;
      const t = radio.nextTime;

      if (s === 0) playPad(t, chord.pad, BAR * STEP);

      if (s % 2 === 0) {
        const freq = s >= 12 ? chord.root * 2 : chord.root; // salto de octava al cerrar el compás
        playBass(t, freq, STEP * 1.7);
      }

      playArp(t, chord.pad[ARP_PATTERN[radio.step % 4]] * 2);

      if (s === 0 || s === 8) playKick(t);
      if (s % 4 === 2) playHat(t);

      radio.nextTime += STEP;
      radio.step += 1;
    }
  }

  function startRadio() {
    if (!radio) radio = createRadio();

    radio.ctx.resume().then(() => {
      radio.nextTime = radio.ctx.currentTime + 0.1;
      radio.step = 0;
      clearInterval(radio.timer);
      radio.timer = setInterval(scheduler, 40);
      radio.master.gain.cancelScheduledValues(radio.ctx.currentTime);
      radio.master.gain.setTargetAtTime(0.75, radio.ctx.currentTime, 0.5);
    });
  }

  function stopRadio() {
    if (!radio) return;

    clearInterval(radio.timer);
    radio.master.gain.cancelScheduledValues(radio.ctx.currentTime);
    radio.master.gain.setTargetAtTime(0.0001, radio.ctx.currentTime, 0.25);

    // Suspender el contexto cuando termina el fundido
    setTimeout(() => {
      if (radio && radio.master.gain.value < 0.001) radio.ctx.suspend();
    }, 900);
  }

  /* ---------- Controles de sonido ---------- */
  const soundButtons = document.querySelectorAll("[data-sound-toggle]");
  const soundHint = document.querySelector(".panel-item__hint");
  let soundOn = false;

  function setSoundState(on) {
    soundOn = on;
    document.body.classList.toggle("is-playing", on);
    soundButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(on));
    });
    if (soundHint) {
      soundHint.textContent = on ? "Sonando en bucle" : "Pulsa para escuchar";
    }
    const fab = document.getElementById("btn-sonido");
    if (fab) {
      fab.setAttribute(
        "aria-label",
        on ? "Silenciar el sonido ambiente" : "Activar el sonido ambiente"
      );
    }
  }

  soundButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (soundOn) {
        stopRadio();
        setSoundState(false);
      } else {
        startRadio();
        setSoundState(true);
      }
    });
  });

  /* ---------- Volver arriba ---------- */
  const topButton = document.getElementById("btn-subir");
  const hero = document.querySelector(".hero");

  if (topButton && hero) {
    const watcher = new IntersectionObserver(
      ([entry]) => {
        topButton.classList.toggle("is-visible", !entry.isIntersecting);
      },
      { threshold: 0.35 }
    );
    watcher.observe(hero);

    topButton.addEventListener("click", () => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    });
  }
})();
