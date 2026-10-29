// WakeBuddy — сайт: ролик, голоса персонажей, демо «выключи будильник кота», наклон медалей, появление блоков.
// Без библиотек. Звук и видео грузятся только по делу: реплика — по нажатию, ролик — когда он на экране.
(() => {
  const d = document;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const net = navigator.connection || {};
  const frugal = Boolean(net.saveData) || /(^|-)2g$/.test(net.effectiveType || '');
  const watch = (els, cb, options) => {
    if (!('IntersectionObserver' in window)) return els.forEach((el) => cb(el, true));
    const io = new IntersectionObserver((entries) => entries.forEach((e) => cb(e.target, e.isIntersecting, io)), options);
    els.forEach((el) => io.observe(el));
  };

  // Появление блоков
  const reveal = [...d.querySelectorAll('.rv')];
  if (reduce) reveal.forEach((el) => el.classList.add('in'));
  else watch(reveal, (el, seen, io) => { if (seen) { el.classList.add('in'); io && io.unobserve(el); } }, { rootMargin: '0px 0px -8% 0px' });

  // Бесконечные анимации (свечение ролика, звонящий кот, медали) крутятся, только пока блок на экране.
  watch([...d.querySelectorAll('.film, .demo, .medal-row')], (el, seen) => el.classList.toggle('live', seen));
  const hero = d.querySelector('.hero');
  if (hero) watch([hero], (el, seen) => d.documentElement.classList.toggle('sky-live', seen));
  else d.documentElement.classList.add('sky-live');

  // В шапке подчёркнут раздел, который сейчас читают.
  const links = new Map([...d.querySelectorAll('.nav a[href*="#"]')].map((a) => [a.hash.slice(1), a]));
  const sections = [...links.keys()].map((id) => d.getElementById(id)).filter(Boolean);
  watch(sections, (el, seen) => links.get(el.id).classList.toggle('on', seen), { rootMargin: '-45% 0px -54% 0px' });

  // Один плеер на все реплики. Первое касание «разблокирует» его на iOS, чтобы демо могло сказать «принято» прямо при вводе.
  const player = new Audio();
  player.preload = 'none';
  let current = null;
  let unlocked = false;
  const unlock = () => {
    if (unlocked || current || !player.paused) return;
    unlocked = true;
    player.muted = true;
    player.src = 'data:audio/wav;base64,UklGRiwAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQgAAACAgICAgICAgA==';
    player.play().then(() => { player.pause(); player.muted = false; }).catch(() => { player.muted = false; });
  };
  const stopVoice = () => {
    player.pause();
    if (current) { current.classList.remove('on'); current.setAttribute('aria-pressed', 'false'); current = null; }
  };
  player.addEventListener('ended', stopVoice);
  const film = { quiet() {} };
  let playId = 0;
  const say = (src, button) => {
    const id = ++playId;
    unlocked = true;
    stopVoice();
    film.quiet();
    player.muted = false;
    player.src = src;
    if (button) { current = button; button.classList.add('on'); button.setAttribute('aria-pressed', 'true'); }
    player.play().catch(() => { if (id === playId) stopVoice(); });
  };

  // Ролик: без звука играет, пока виден; «Звук» — с начала и со звуком.
  const screen = d.querySelector('.screen');
  if (screen) {
    const video = screen.querySelector('video');
    const sound = screen.querySelector('.sound');
    const start = Number(video.dataset.start) || 0;
    let started = false;
    let visible = false;
    const setSound = (on) => { video.muted = !on; sound.setAttribute('aria-pressed', String(on)); };
    const go = (fromStart) => {
      if (!started) { started = true; video.preload = 'auto'; }
      if (fromStart) video.currentTime = 0;
      else if (!video.dataset.heard && video.currentTime < start) video.currentTime = start;
      video.play().then(() => screen.classList.remove('blocked')).catch(() => screen.classList.add('blocked'));
    };
    video.addEventListener('playing', () => screen.classList.add('playing'));
    video.addEventListener('ended', () => { setSound(false); video.currentTime = start; if (visible) video.play().catch(() => {}); });
    film.quiet = () => { if (!video.muted) setSound(false); };
    watch([screen], (el, seen) => {
      visible = seen;
      if (seen && !frugal && !reduce) go(false);
      else if (seen && !started) screen.classList.add('blocked');
      else if (!seen && !video.paused) video.pause();
    }, { threshold: 0.35 });
    sound.addEventListener('click', () => {
      stopVoice();
      if (video.muted) { const first = !video.dataset.heard; video.dataset.heard = '1'; setSound(true); go(first); }
      else setSound(false);
    });
    screen.querySelector('.big-play').addEventListener('click', () => { stopVoice(); video.dataset.heard = '1'; setSound(true); go(true); });
  }

  // Реплики персонажей
  d.querySelectorAll('[data-voice]').forEach((button) => button.addEventListener('click', () => {
    if (current === button) return stopVoice();
    say(button.dataset.voice, button);
  }));

  // Демо: снуз делает кота злее, правильная фраза выключает будильник.
  const demo = d.querySelector('.demo');
  if (demo) {
    const t = JSON.parse(demo.dataset.t);
    const base = demo.dataset.audio;
    const line = demo.querySelector('.line q');
    const dots = demo.querySelectorAll('.rounds i');
    const roundLabel = demo.querySelector('.rounds-label');
    const clock = demo.querySelector('.ring .clock');
    const input = demo.querySelector('input');
    const done = demo.querySelector('.done');
    let round = 1;
    let snoozes = 0;
    const fold = (s) => s.normalize('NFKD').toLowerCase().replace(/[\p{M}\p{P}\p{S}\s]/gu, '');
    const targets = [t.phrase, ...(t.alts || [])].map(fold);
    const time = (minutes) => { const total = 420 + minutes; return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`; };
    const speak = (key) => { line.textContent = t[key]; say(`${base}demo-${key}.m4a`); };
    const replay = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
    const shake = () => replay(demo, 'shake');
    demo.addEventListener('animationend', (event) => { if (event.animationName === 'wobble') demo.classList.remove('shake'); });
    const setRound = (n) => {
      round = n;
      dots.forEach((dot, i) => dot.classList.toggle('on', i < n));
      roundLabel.textContent = `${t.round} ${n} ${t.of} 3`;
      demo.style.setProperty('--heat', n);
    };
    const distance = (a, b) => {
      const row = Array.from({ length: b.length + 1 }, (_, i) => i);
      for (let i = 1; i <= a.length; i++) {
        let prev = row[0];
        row[0] = i;
        for (let j = 1; j <= b.length; j++) {
          const keep = row[j];
          row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
          prev = keep;
        }
      }
      return row[b.length];
    };
    const ring = demo.querySelector('.ring');
    const again = demo.querySelector('[data-act="again"]');
    const win = () => {
      if (demo.classList.contains('won')) return;
      ring.inert = true;
      done.querySelector('.clock span').textContent = time(snoozes * 5 + 1);
      done.querySelector('strong').textContent = snoozes === 0 ? t.first_try : snoozes === 1 ? t.after_one : t.after.replace('{n}', snoozes);
      demo.classList.add('won');
      again.focus({ preventScroll: true });  // после 'won': пока экран победы скрыт, фокус не встанет
      speak('yes');
    };
    demo.addEventListener('pointerdown', unlock, { passive: true });
    demo.addEventListener('focusin', unlock);
    demo.querySelector('[data-act="listen"]').addEventListener('click', () => speak(`l${round}`));
    demo.querySelector('[data-act="snooze"]').addEventListener('click', () => {
      snoozes += 1;
      setRound(Math.min(3, round + 1));
      clock.textContent = time(snoozes * 5);
      replay(clock, 'tick');
      speak(`l${round}`);
      shake();
    });
    input.addEventListener('input', () => { if (targets.includes(fold(input.value))) win(); });
    demo.querySelector('form').addEventListener('submit', (event) => {
      event.preventDefault();
      const typed = fold(input.value);
      if (typed && targets.some((target) => distance(typed, target) <= Math.max(1, Math.floor(target.length / 8)))) win();
      else { speak('no'); shake(); }
    });
    again.addEventListener('click', (event) => {
      stopVoice();
      ring.inert = false;
      demo.classList.remove('won', 'shake');
      snoozes = 0;
      input.value = '';
      clock.textContent = time(0);
      line.textContent = t.l1;
      setRound(1);
      if (event.detail === 0) input.focus();
    });
  }

  // Медали поворачиваются за курсором (на телефоне — только блик и лёгкое покачивание).
  if (!reduce && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    d.querySelectorAll('.disc').forEach((disc) => {
      let frame = 0;
      disc.addEventListener('pointermove', (event) => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          const box = disc.getBoundingClientRect();
          const x = (event.clientX - box.left) / box.width - 0.5;
          const y = (event.clientY - box.top) / box.height - 0.5;
          disc.style.setProperty('--ry', `${(x * 26).toFixed(1)}deg`);
          disc.style.setProperty('--rx', `${(-y * 26).toFixed(1)}deg`);
        });
      });
      disc.addEventListener('pointerleave', () => { cancelAnimationFrame(frame); disc.style.removeProperty('--rx'); disc.style.removeProperty('--ry'); });
    });
  }

  // Язык закрывается по клику мимо меню, по Escape и когда фокус уходит из меню.
  const lang = d.querySelector('.lang');
  if (lang) {
    d.addEventListener('click', (event) => { if (lang.open && !lang.contains(event.target)) lang.open = false; });
    lang.addEventListener('keydown', (event) => { if (event.key === 'Escape' && lang.open) { lang.open = false; lang.querySelector('summary').focus(); } });
    // relatedTarget пуст, когда Safari не фокусирует ссылку по клику — тогда меню не трогаем, иначе клик не дойдёт.
    lang.addEventListener('focusout', (event) => { if (event.relatedTarget && !lang.contains(event.relatedTarget)) lang.open = false; });
  }
})();
