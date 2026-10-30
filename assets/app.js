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
    const id = playId;
    // Пока беззвучная «разблокировка» грузится, могла уже заиграть реплика — её не трогаем (иначе сбросится «Mute»).
    const done = () => { if (id === playId) { player.pause(); player.muted = false; } };
    player.play().then(done, done);
  };
  const stopVoice = () => {
    player.pause();
    if (current) { current.classList.remove('on'); current.setAttribute('aria-pressed', 'false'); current = null; }
  };
  player.addEventListener('ended', stopVoice);
  let playId = 0;
  const film = { quiet() {}, loud: () => false, onLoud() {}, onQuiet() {} };
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
    const setSound = (on) => { video.muted = !on; sound.setAttribute('aria-pressed', String(on)); if (!on) film.onQuiet(); };
    const go = (fromStart) => {
      if (!started) { started = true; video.preload = 'auto'; }
      if (fromStart) video.currentTime = 0;
      else if (!video.dataset.heard && video.currentTime < start) video.currentTime = start;
      video.play().then(() => screen.classList.remove('blocked')).catch(() => screen.classList.add('blocked'));
    };
    video.addEventListener('playing', () => screen.classList.add('playing'));
    video.addEventListener('pause', () => film.onQuiet());
    video.addEventListener('ended', () => { setSound(false); video.currentTime = start; if (visible) video.play().catch(() => {}); });
    film.quiet = () => { if (!video.muted) setSound(false); };
    film.loud = () => !video.muted && !video.paused;
    watch([screen], (el, seen) => {
      visible = seen;
      if (seen && !frugal && !reduce) go(false);
      else if (seen && !started) screen.classList.add('blocked');
      else if (!seen && !video.paused) video.pause();
    }, { threshold: 0.35 });
    sound.addEventListener('click', () => {
      if (video.muted) film.onLoud();
      stopVoice();
      if (video.muted) { const first = !video.dataset.heard; video.dataset.heard = '1'; setSound(true); go(first); }
      else setSound(false);
    });
    screen.querySelector('.big-play').addEventListener('click', () => { film.onLoud(); stopVoice(); video.dataset.heard = '1'; setSound(true); go(true); });
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

  // Утро с котом (английская страница): 6:59 → звонок → снуз → звонок злее → … → «стоп» → фраза → «Good morning».
  // Голоса — настоящие звонки из приложения, субтитры идут по времени слов. Звук — только после «Start the morning»,
  // и только пока блок на экране: ушёл — кот замолкает и потом продолжает с того же места.
  const morning = d.querySelector('.morning');
  if (morning) {
    const m = JSON.parse(morning.dataset.m);
    const base = morning.dataset.audio;
    const $ = (selector) => morning.querySelector(selector);
    const scene = $('.m-scene');
    const hint = $('.m-hint');
    const big = $('.m-big');
    const capBox = $('.m-cap');
    const cap = $('.m-cap q');
    const level = $('.m-level');
    const title = $('.m-title');
    const nameLine = $('.m-name');
    const alarm = $('.m-alarm');
    const live = $('.m-live');
    const count = $('.m-count');
    const again = $('.m-again');
    const state = $('.m-state');
    const lineText = $('.m-line q');
    const form = $('.m-form');
    const input = form.querySelector('input');
    const slide = $('.m-slide');
    const knob = $('.m-knob');
    const snoozeButton = $('.m-snooze');
    const orb = $('.m-orb');
    const mute = $('[data-act="mute"]');
    const heading = $('.m-gm');
    const steps = [...morning.querySelectorAll('.m-steps li')];
    const stepTime = steps.map((li) => li.querySelector('.m-t'));
    const stepDefault = stepTime.map((el) => el.textContent);
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let round = 0;
    let snoozes = 0;
    let clip = '';         // файл блока, который сейчас в плеере
    let lastTime = 0;
    let pending = null;    // { file, t } — продолжить, когда блок снова на экране
    let lineFile = '';
    let cues = [];
    let cue = -1;
    let frame = 0;
    let timers = [];
    let listening = null;
    let muted = false;
    let seen = false;
    let armedAt = 0;
    let empty = 0;

    // Завтрашняя дата того, кто смотрит сайт.
    const tomorrow = new Date(Date.now() + 864e5);
    $('.m-date').textContent = tomorrow.toLocaleDateString(m.locale, { weekday: 'long', month: 'long', day: 'numeric' });
    $('.m-short').textContent = tomorrow.toLocaleDateString(m.locale, { weekday: 'short', month: 'short', day: 'numeric' });

    const clock = (minutes) => { const total = 420 + minutes; return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`; };
    const replay = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
    const later = (fn, ms) => timers.push(setTimeout(fn, ms));
    // Новые кнопки появляются под пальцем (Start → «slide to stop», ручка → «5 more min»): 0,6 с после смены экрана
    // повторный тап не считается. Клавиатура (event.detail === 0) — без задержки.
    const armed = (event) => (event && event.type === 'click' && event.detail === 0) || performance.now() >= armedAt;
    const setState = (name) => { morning.dataset.state = name; armedAt = performance.now() + 600; };
    const setScene = (key, time = '') => {
      const [heading, text] = m.scenes[key];
      scene.innerHTML = heading.replace('{time}', time);  // заголовки сцен собраны и экранированы сборщиком
      hint.textContent = text;
    };
    const setTime = (text) => {
      if (big.textContent === text) return;
      big.textContent = text;
      if (!reduce) replay(big, 'tick');
    };
    const setHeat = (n) => { morning.dataset.heat = n; morning.style.setProperty('--heat', n); };
    const mark = (classes) => steps.forEach((li, n) => {
      li.className = classes[n] || '';
      if (classes[n] === 'on') li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
      li.querySelector('i').style.setProperty('--p', classes[n] === 'past' ? 1 : 0);
    });
    const ours = () => Boolean(clip) && player.src.endsWith(clip);

    // Звук блока. Не на экране — не играем, а запоминаем, с какого места продолжить.
    const voice = (file, at = 0) => {
      if (!seen) { pending = { file, t: at }; return; }
      pending = null;
      clip = base + file;
      lastTime = at;
      say(clip);
      player.muted = muted;
      if (at > 0) {
        const seek = () => { if (ours()) player.currentTime = at; };
        if (player.readyState >= 1) seek(); else player.addEventListener('loadedmetadata', seek, { once: true });
      }
    };
    const silence = () => { pending = null; if (clip) { clip = ''; stopVoice(); } };
    const resume = () => {
      if (!pending || !seen || film.loud() || (!player.paused && !ours())) return;  // звучит ролик или другая реплика — кот подождёт
      const { file, t } = pending;
      voice(file, t);
    };
    // Субтитры и полоска текущей ступени идут за звуком.
    const follow = () => {
      cancelAnimationFrame(frame);
      const tick = () => {
        if (!ours()) return;
        const at = player.currentTime;
        lastTime = at;
        let index = 0;
        while (index + 1 < cues.length && cues[index + 1][0] <= at) index += 1;
        if (cues.length && index !== cue) {
          cue = index;
          cap.textContent = cues[index][1];
          replay(cap, 'swap');
        }
        const on = steps.find((li) => li.classList.contains('on'));
        if (on && player.duration) on.querySelector('i').style.setProperty('--p', Math.min(1, at / player.duration));
        if (!player.paused) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };
    player.addEventListener('playing', () => {
      if (!ours()) return;
      player.muted = muted;
      if (morning.dataset.state.startsWith('ring')) follow();
    });
    player.addEventListener('timeupdate', () => { if (ours()) lastTime = player.currentTime; });
    // Плеер забрала другая реплика (карточка персонажа, ролик) — запоминаем, где остановился кот.
    player.addEventListener('play', () => {
      if (clip && !player.src.endsWith(clip)) { pending = { file: clip.slice(base.length), t: lastTime }; clip = ''; }
    });
    player.addEventListener('ended', () => {
      if (!ours()) return;
      clip = '';
      const on = steps.find((li) => li.classList.contains('on'));
      if (on && morning.dataset.state.startsWith('ring')) on.querySelector('i').style.setProperty('--p', 1);
    });
    const prefetch = (file) => { if (!frugal && file) fetch(base + file).catch(() => {}); };

    const cancelListening = () => {
      if (!listening) return;
      listening.drop();
      listening = null;
      morning.classList.remove('listening');
      orb.setAttribute('aria-pressed', 'false');
    };
    const stopAll = () => {
      timers.forEach(clearTimeout);
      timers = [];
      cancelAnimationFrame(frame);
      cancelListening();
      silence();
    };

    const roundClip = (n) => m.rounds[n <= m.rounds.length ? n - 1 : 2 + ((n - 3) % (m.rounds.length - 2))];
    const ring = (n) => {
      round = n;
      const key = `ring${Math.min(n, 4)}`;
      const time = clock((n - 1) * 5);
      const current = Math.min(n, 3) - 1;
      const sound = roundClip(n);
      const focusBack = morning.contains(d.activeElement) || d.activeElement === d.body;
      setState(key);
      setHeat(current);
      setScene(key, time);
      setTime(time);
      // Как в приложении: первый звонок — «Evil Kitty / Stop, then say your phrase», дальше — «Snooze is over / Level 2 of 3 · tougher now».
      nameLine.textContent = n === 1 ? m.cat : m.name2;
      title.textContent = n === 1 ? m.title1 : m.sub2.replace('{n}', current + 1);
      level.textContent = m.level.replace('{n}', current + 1);
      knob.style.setProperty('--x', '0px');
      slide.style.setProperty('--k', 0);
      morning.classList.remove('dragging');
      alarm.classList.remove('shake');
      if (n > 1 && !reduce) replay(alarm, 'shake');
      if (n >= 4) stepTime[2].textContent = time;
      mark(steps.map((_, i) => (i < current ? 'past' : i === current ? 'on' : '')));
      cues = sound.cues;
      cue = 0;
      cap.textContent = cues[0][1];
      replay(cap, 'swap');
      voice(sound.file);
      prefetch(roundClip(n + 1).file);
      if (focusBack) snoozeButton.focus({ preventScroll: true });
    };

    const snooze = (event) => {
      const from = morning.dataset.state;
      if ((!from.startsWith('ring') && from !== 'task') || !armed(event)) return;
      const focusBack = morning.contains(d.activeElement);
      stopAll();
      morning.classList.remove('typing', 'missed');
      form.hidden = true;
      snoozes += 1;
      setState('snooze');
      setScene('snooze');
      const current = Math.min(round, 3) - 1;
      const next = Math.min(round + 1, 3) - 1;
      mark(steps.map((_, i) => (i < current ? 'past' : i === current ? (next === current ? 'on' : 'past') : i === next ? 'on' : '')));
      again.textContent = m.again.replace('{n}', next + 1);
      stepTime[3].textContent = stepDefault[3];
      if (focusBack) live.focus({ preventScroll: true });
      // Пять минут — за 2,6 секунды: отсчёт вниз, часы вперёд. Без анимации (reduced motion) — четыре шага.
      const start = (round - 1) * 5;
      const began = performance.now();
      count.textContent = '5:00';
      const tick = (stamp) => {
        const k = Math.min(1, (stamp - began) / 2600);
        const eased = reduce ? Math.floor(k * 4) / 4 : k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
        const left = Math.ceil(300 * (1 - eased));
        const shown = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
        if (count.textContent !== shown) count.textContent = shown;
        setTime(clock(start + Math.min(5, Math.floor(eased * 5))));
        if (k < 1) frame = requestAnimationFrame(tick);
        else later(() => ring(round + 1), 350);
      };
      frame = requestAnimationFrame(tick);
    };

    const stop = () => {
      if (!morning.dataset.state.startsWith('ring')) return;
      stopAll();
      const reached = Math.min(round, 3);
      setState('task');
      setScene(Recognition ? 'task' : 'task_type');
      stepTime[3].textContent = clock((round - 1) * 5 + 1);
      mark(steps.map((_, i) => (i === 3 ? 'on' : i < reached ? 'past' : 'skipped')));
      morning.classList.remove('missed');
      morning.classList.toggle('typing', !Recognition);
      form.hidden = Boolean(Recognition);
      empty = 0;
      state.textContent = Recognition ? m.mic : '';
      const line = m.lines[reached - 1];
      lineText.textContent = line.text;
      lineFile = line.file;
      later(() => voice(line.file), 450);
      (Recognition ? orb : input).focus({ preventScroll: true });
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
    // Safari на iPhone иногда распознаёт на языке Siri, а не страницы: «Мерси ивел кити» вместо «Mercy evil kitty».
    // Поэтому кириллицу переводим в латиницу и сравниваем по звучанию (c → k/s, y → i, без двойных букв).
    const CYR = 'а:a б:b в:v г:g д:d е:e ё:e ж:zh з:z и:i й:i к:k л:l м:m н:n о:o п:p р:r с:s т:t у:u ф:f х:h ц:ts ч:ch ш:sh щ:sch ъ: ы:i ь: э:e ю:yu я:ya';
    const cyr = Object.fromEntries(CYR.split(' ').map((pair) => pair.split(':')));
    const sound = (w) => w.replace(/[а-яё]/g, (ch) => cyr[ch]).replace(/c(?=[eiy])/g, 's').replace(/c/g, 'k').replace(/y/g, 'i').replace(/(.)\1+/g, '$1');
    const words = (s) => s.toLowerCase().replace(/ё/g, 'е').normalize('NFKD').replace(/[\p{M}]/gu, '').split(/[^\p{L}\p{N}]+/u).filter(Boolean).map(sound);
    const goals = [m.phrase, ...(m.alts || [])].map(words);  // японскую фразу распознавание пишет то каной, то кандзи
    const likeness = (a, b) => (a || b ? 1 - distance(a, b) / Math.max(a.length, b.length) : 0);
    // Как PhraseMatcher в приложении: лучшее окно из n−1…n+1 подряд идущих слов (лишнее «um» и обрывки не мешают).
    const spoken = (text) => {
      const said = words(text);
      let best = 0;
      for (const goal of goals) {
        for (let size = Math.max(1, goal.length - 1); size <= goal.length + 1; size++) {
          for (let i = 0; i + size <= Math.max(said.length, size); i++) {
            best = Math.max(best, likeness(said.slice(i, i + size).join(''), goal.join('')));
          }
        }
      }
      return Math.max(best, ...goals.map((goal) => hits(said, goal)));
    };
    // Распознавание в браузере часто путает одно слово («Mercy evil city», «Percy evil kitty») — для демо хватает,
    // чтобы узнавалось большинство слов фразы: доля слов фразы, у которых в услышанном есть похожее.
    const hits = (said, goal) => {
      if (goal.length < 3) return 0;  // из двух слов одно — это ещё не фраза
      return goal.filter((g) => said.some((w) => likeness(w, g) >= .5)).length / goal.length;
    };
    const typed = (text) => Math.max(...goals.map((goal) => likeness(words(text).join(''), goal.join(''))));
    const close = (text) => typed(text) >= .9;
    // Почти угадал — «Close. But close does not fill the bowl.»; совсем не то — «What was that? Speak up, servant.»
    const react = (text, nearly, shown = '') => {
      morning.classList.add('missed');
      // при промахе оставить видным, что расслышал микрофон, — иначе непонятно, что пошло не так
      state.textContent = nearly ? m.miss : m.huh;
      if (shown) state.textContent += ` ${m.marks[0]}${shown}${m.marks[1]}`;
      lineText.textContent = nearly ? m.no : m.huh_line;
      lineFile = nearly ? 'demo-no.m4a' : 'demo-huh.m4a';
      voice(lineFile);
    };
    const miss = (text, score = typed(text), shown = '') => react(text, score >= .4, shown);
    const typeInstead = (key) => {
      cancelListening();
      morning.classList.add('typing');
      morning.classList.remove('missed');
      form.hidden = false;
      setScene(key);
      state.textContent = '';
      input.focus();
    };

    const win = () => {
      if (morning.dataset.state !== 'task') return;
      stopAll();
      const time = clock((round - 1) * 5 + 1);
      setState('done');
      setScene('done', time);
      stepTime[3].textContent = time;
      mark(steps.map((li, i) => (i === 3 || li.classList.contains('past') ? 'past' : 'skipped')));
      setTime(time);
      $('.m-card-time span').textContent = time;
      $('.m-card-h').textContent = snoozes === 0 ? m.first_try : snoozes === 1 ? m.after_one : m.after.replace('{n}', snoozes);
      $('.m-card-q').textContent = `${m.marks[0]}${m.yes}${m.marks[1]}`;
      voice('demo-yes.m4a');
      heading.focus({ preventScroll: true });  // не на кнопку: Enter из поля фразы «нажал» бы её
    };

    // Списки результатов — по индексу: перебор через ... есть не во всех браузерах.
    const list = (items) => Array.from({ length: items.length }, (_, i) => items[i]);
    // Safari на iPhone сам обрывает запись на первой паузе («Mercy,» — и всё), поэтому слушаем непрерывно и
    // заканчиваем сами: через 1,6 с тишины после слов, через 5 с, если слов нет, и через 10 с в любом случае.
    const listen = (event) => {
      if (!armed(event)) return;
      if (!Recognition) return typeInstead('task_type');
      if (listening) { listening.halt(); return; }  // второй тап — «я всё сказал»
      timers.forEach(clearTimeout);
      timers = [];
      silence();
      const rec = new Recognition();
      rec.lang = m.speech;
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 3;
      let heard = '';
      let shown = '';
      let best = 0;
      let settled = false;
      let ended = false;
      let quiet = 0;
      let grace = 0;
      const stopTimers = () => { clearTimeout(quiet); clearTimeout(limit); clearTimeout(grace); };
      // Конец попытки: оценить услышанное (если ещё не выиграли и не ушли на ввод текстом).
      const end = () => {
        if (ended) return;
        ended = true;
        stopTimers();
        rec.onresult = rec.onerror = rec.onend = null;
        if (listening === rec) listening = null;
        morning.classList.remove('listening');
        orb.setAttribute('aria-pressed', 'false');
        if (settled || morning.dataset.state !== 'task') return;
        if (heard.trim()) { empty = 0; miss(heard, best, shown); return; }
        empty += 1;
        if (empty >= 2) typeInstead('task_type'); else react('', false);
      };
      // Попросить распознавание закончить; если оно так и не пришлёт onend (бывает в Safari) — закончить самим.
      rec.halt = () => {
        if (ended) return;
        try { rec.stop(); } catch (error) { /* уже остановлено */ }
        clearTimeout(grace);
        grace = setTimeout(() => { try { rec.abort(); } catch (error) { /* уже остановлено */ } end(); }, 1500);
      };
      rec.drop = () => {
        ended = true;
        stopTimers();
        rec.onresult = rec.onerror = rec.onend = null;
        try { rec.abort(); } catch (error) { /* уже остановлено */ }
        morning.classList.remove('listening');
        orb.setAttribute('aria-pressed', 'false');
      };
      const hush = (ms) => { clearTimeout(quiet); quiet = setTimeout(rec.halt, ms); };
      const limit = setTimeout(rec.halt, 10000);
      rec.onresult = (evt) => {
        const results = list(evt.results);
        const texts = results.flatMap((result) => list(result).map((alt) => alt.transcript));
        const said = results.map((result) => result[0].transcript).join(' ').replace(/\s+/g, ' ').trim();
        texts.push(said);  // фраза, разбитая на куски
        heard = texts.join(' ');
        best = Math.max(best, ...texts.map(spoken));
        if (said) { shown = said; state.textContent = `${m.marks[0]}${said}${m.marks[1]}`; }  // видно, что микрофон слышит
        if (best >= .6) { settled = true; cancelListening(); win(); return; }
        hush(1600);
      };
      rec.onerror = (evt) => {
        if (evt.error === 'not-allowed') { settled = true; end(); typeInstead('task_denied'); }
        else if (['service-not-allowed', 'network', 'audio-capture', 'language-not-supported', 'bad-grammar'].includes(evt.error)) {
          settled = true;
          end();
          typeInstead('task_type');
        } else rec.halt();  // no-speech, aborted — оценить то, что успели услышать
      };
      rec.onend = end;
      listening = rec;
      morning.classList.add('listening');
      morning.classList.remove('missed');
      orb.setAttribute('aria-pressed', 'true');
      state.textContent = m.listening;
      try { rec.start(); } catch (error) { settled = true; end(); typeInstead('task_type'); return; }
      hush(5000);
    };

    const reset = () => {
      stopAll();
      round = 0;
      snoozes = 0;
      setState('idle');
      setScene('idle');
      setHeat(0);
      setTime('6:59');
      stepTime.forEach((el, i) => { el.textContent = stepDefault[i]; });
      mark([]);
      alarm.classList.remove('shake');
      knob.style.setProperty('--x', '0px');
      slide.style.setProperty('--k', 0);
      morning.classList.remove('typing', 'missed', 'listening', 'dragging');
      form.hidden = true;
      input.value = '';
      cap.textContent = '';
    };

    // «slide to stop»: тянуть ручку вправо, или нажать на ручку / дорожку — доедет сама; с клавиатуры — Enter/Пробел.
    const maxX = () => slide.clientWidth - knob.offsetWidth - 2 * knob.offsetLeft;
    const finish = () => { knob.style.setProperty('--x', `${maxX()}px`); slide.style.setProperty('--k', 1); morning.classList.add('dragging'); later(stop, 260); };
    let drag = null;
    knob.addEventListener('pointerdown', (event) => {
      if (!morning.dataset.state.startsWith('ring') || !armed(event)) return;
      drag = { x: event.clientX, moved: false };
      knob.setPointerCapture(event.pointerId);
      knob.classList.add('drag');
      morning.classList.add('dragging');
    });
    knob.addEventListener('pointermove', (event) => {
      if (!drag) return;
      const dx = Math.max(0, Math.min(maxX(), event.clientX - drag.x));
      if (dx > 6) drag.moved = true;
      knob.style.setProperty('--x', `${dx}px`);
      slide.style.setProperty('--k', (dx / maxX()).toFixed(3));  // надпись гаснет, пока тянешь
    });
    const release = (event) => {
      if (!drag) return;
      const { moved } = drag;
      drag = null;
      knob.classList.remove('drag');
      morning.classList.remove('dragging');
      const dx = parseFloat(knob.style.getPropertyValue('--x')) || 0;
      if (event.type !== 'pointercancel' && (!moved || dx > maxX() * .66)) return finish();
      knob.style.setProperty('--x', '0px');
      slide.style.setProperty('--k', 0);
    };
    knob.addEventListener('pointerup', release);
    knob.addEventListener('pointercancel', release);
    knob.addEventListener('click', (event) => { if (event.detail === 0) finish(); });
    slide.addEventListener('click', (event) => {
      if (knob.contains(event.target) || !morning.dataset.state.startsWith('ring') || !armed(event)) return;
      finish();
    });

    morning.addEventListener('pointerdown', unlock, { passive: true });
    $('[data-act="start"]').addEventListener('click', () => { reset(); ring(1); });
    snoozeButton.addEventListener('click', snooze);
    $('[data-act="more"]').addEventListener('click', snooze);
    orb.addEventListener('click', listen);
    $('[data-act="type"]').addEventListener('click', (event) => { if (armed(event)) typeInstead(Recognition ? 'task' : 'task_type'); });
    $('[data-act="line"]').addEventListener('click', () => {
      if (listening) { cancelListening(); state.textContent = m.mic; }
      if (lineFile) voice(lineFile);
    });
    input.addEventListener('input', () => { if (typed(input.value) === 1) win(); });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!input.value.trim()) { input.focus(); return; }
      if (close(input.value)) win(); else { miss(input.value); input.select(); }
    });
    $('[data-act="replay"]').addEventListener('click', () => { reset(); $('[data-act="start"]').focus({ preventScroll: true }); });
    mute.addEventListener('click', () => {
      muted = !muted;
      mute.setAttribute('aria-pressed', String(muted));
      capBox.setAttribute('aria-live', muted ? 'polite' : 'off');  // без звука субтитры читает скринридер
      if (ours()) player.muted = muted;
    });
    film.onLoud = () => { if (ours() && !player.paused) { pending = { file: clip.slice(base.length), t: player.currentTime }; clip = ''; } };
    film.onQuiet = () => setTimeout(resume, 300);
    player.addEventListener('ended', () => { if (!clip && pending) setTimeout(resume, 400); });  // карточка договорила — кот продолжает
    watch([morning], (el, isSeen) => morning.classList.toggle('live', isSeen));
    watch([$('.m-phone')], (el, isSeen) => {
      seen = isSeen;
      if (!isSeen && ours() && !player.paused) {
        pending = { file: clip.slice(base.length), t: player.currentTime };
        clip = '';
        player.pause();
      } else if (isSeen) resume();
    }, { rootMargin: '-64px 0px 0px 0px' });
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
