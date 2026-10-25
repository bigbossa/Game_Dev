// หน้าโหลด (#loading): the bar, the step text, tips, embers and the fade into the login screen.
// Loaded before every other script, so the bar already moves while the game's scripts download (each script that
// finishes nudges it up to ~1/3); after that main.js boot() reports its steps: LOADER.step(0..1, text).
// The bar never stands still while a step works (it creeps a little toward the next step) and never goes back.
// LOADER.fail(message) shows the error with a ลองใหม่ (reload) button.
(function () {
  const $ = (id) => document.getElementById(id);
  const root = $('loading'), fill = $('ldFill'), pct = $('ldPct'), text = $('ldText'), bar = root.querySelector('.ld-bar');
  const TIPS = [
    'กด K เปิดคัมภีร์วิชา ได้สกิลใหม่หรือพัฒนาสกิลเดิมทุก 10 เลเวล',
    'หมู่บ้านเซียนน้อยมีแรงช่วยฝึกสำหรับ Lv.1–20: ตีแรงขึ้น รับความเสียหายน้อยลง และได้ EXP เพิ่ม',
    'ศิลาเคลื่อนย้ายในค่ายพัก วาร์ปไปแผนที่ใดก็ได้ที่เลเวลถึง',
    'ระดมทุนครบ 10,000,000 ทอง ทั้งเซิร์ฟได้ EXP ×2 และดรอป ×2 นาน 1 ชั่วโมง',
    'ปาร์ตี้ได้สูงสุด 8 คน สมาชิกที่อยู่ใกล้กันแบ่ง EXP และได้โบนัสเพิ่ม',
    'กล่องบอท 🤖 ล่ามอนสเตอร์ในรัศมีที่ตั้ง และเติมยาเลือด/ยามานาให้อัตโนมัติ',
    'แผนที่ใหญ่ (M) บอกมอนสเตอร์ที่เหมาะกับเลเวล แตะชื่อเพื่อเดินไปเอง',
    'มอนสเตอร์ที่เลเวลต่ำกว่าเรามากให้ EXP ลดลง เลือกล่าตัวที่ใกล้เลเวล',
    'สนามรบธรรมะ-อธรรม (Lv.10+) ปราบราชันมารโลหิตกลางแผนที่ได้ +10 คะแนน',
    'Lv.120 และ 130 ปลดล็อกมหาวิชาหมู่ ร่ายนานแต่แรงมหาศาล',
    'ทุกเลเวลได้ 3 แต้มสถานะ กด C แจกตามแนวทางอาชีพ หรือเปิดอัปอัตโนมัติ',
    'ปรับเสียงเพลงและเสียงต่อสู้ได้ที่ ⚙ ตั้งค่า (V)',
  ];

  // ---- the bar: shown eases toward goal; goal = the last reported step plus a slow creep toward the next one
  let step = 0, goal = 0, shown = 0, stepAt = performance.now(), finished = false, raf = 0;
  function frame(now) {
    const creep = finished ? 0 : Math.min(0.07, (1 - step) * 0.5) * (1 - Math.exp(-(now - stepAt) / 4000));
    goal = Math.max(goal, Math.min(1, step + creep));
    shown += (goal - shown) * 0.12;
    if (goal - shown < 0.001) shown = goal;
    const p = Math.round(shown * 100);
    fill.style.width = `${shown * 100}%`;
    if (pct.textContent !== `${p}%`) { pct.textContent = `${p}%`; bar.setAttribute('aria-valuenow', p); }
    raf = shown < 1 ? requestAnimationFrame(frame) : 0;
  }
  raf = requestAnimationFrame(frame);
  function setText(t) {
    if (!t || text.textContent === t) return;
    text.classList.remove('in'); void text.offsetWidth;
    text.textContent = t; text.classList.add('in');
  }
  const LOADER = (window.LOADER = {
    step(p, t) {
      if (p > step) { step = p; stepAt = performance.now(); }
      setText(t);
      if (!raf) raf = requestAnimationFrame(frame);
    },
    // all loaded: fill the bar, then fade into the login screen
    done() {
      finished = true;
      LOADER.step(1, 'พร้อมเข้าสู่ยุทธภพ');
      setTimeout(() => {
        root.classList.add('done');
        setTimeout(() => { root.classList.add('hidden'); clearInterval(tipTimer); embers.textContent = ''; }, 700);
      }, 450);
    },
    // the browser's own words ("Failed to fetch", "Load failed" ...) become a Thai sentence; the detail stays in the console
    fail(msg) {
      finished = true;
      root.classList.add('failed');
      setText('โหลดเกมไม่สำเร็จ');
      const net = /fetch|network|load failed|load|timeout/i.test(msg || '');
      $('ldFailMsg').textContent = net ? 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง'
        : 'ไฟล์เกมโหลดไม่ครบ ลองใหม่อีกครั้ง ถ้ายังไม่ได้ให้ล้างแคชของเบราว์เซอร์';
      $('ldFail').classList.remove('hidden');
    },
  });
  $('ldRetry').addEventListener('click', () => location.reload());

  // ---- the game's own scripts arriving (load events do not bubble, a capturing listener still sees them)
  let scripts = 0;
  const onScript = (e) => {
    if (e.target.tagName !== 'SCRIPT' || step >= 0.34) return;
    scripts++;
    LOADER.step(0.32 * (1 - Math.exp(-scripts / 18)), 'กำลังโหลดไฟล์เกม');
  };
  document.addEventListener('load', onScript, true);
  document.addEventListener('DOMContentLoaded', () => document.removeEventListener('load', onScript, true));

  // ---- tips, one every few seconds (a random start so a reload shows another one)
  const tip = $('ldTip');
  let ti = Math.floor(Math.random() * TIPS.length);
  const nextTip = () => { tip.classList.remove('in'); void tip.offsetWidth; tip.textContent = TIPS[ti++ % TIPS.length]; tip.classList.add('in'); };
  nextTip();
  const tipTimer = setInterval(nextTip, 4500);

  // ---- embers rising through the mist: blue (ธรรมะ) on the left, red (อธรรม) on the right, gold anywhere
  const embers = root.querySelector('.ld-embers');
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  for (let i = 0; i < (calm ? 0 : 26); i++) {
    const e = document.createElement('i'), x = Math.random();
    const col = Math.random() < 0.3 ? '#ffd76a' : x < 0.5 ? '#7ccfff' : '#ff6a5a';
    e.style.cssText = `left:${(x * 100).toFixed(1)}%;--s:${(2 + Math.random() * 3).toFixed(1)}px;--c:${col};` +
      `--d:${(7 + Math.random() * 8).toFixed(1)}s;--w:${(Math.random() * 60 - 30).toFixed(0)}px;animation-delay:-${(Math.random() * 15).toFixed(1)}s`;
    embers.appendChild(e);
  }
})();
