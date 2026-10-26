// ตั้งค่า (⚙ button · V · ☰ menu on touch screens): player options kept in this browser (localStorage 'settings').
// SET.get(key) anywhere in the game; SET.on(fn) is told about every change (sound.js re-applies its volumes).
// The panel is drawn from SECTIONS, so a new option is one line here plus the code that reads SET.get(it).
(function () {
  const KEY = 'settings';
  const DEFAULTS = {
    graphics: 'auto',
    sound: true,      // false = everything silent
    master: 80,       // 0..100
    music: 45,
    sfx: 80,          // combat, skills, loot, level up
    ui: 60,           // buttons, notices
    others: true,     // hear other players' skills and hits
    bgMute: true,     // silent while the tab / app is in the background
    dmgNums: true,    // damage numbers over heads
    shake: true,      // screen shake on big hits
    reachRing: true,  // the basic attack's reach drawn round the character (main.js drawReachRing)
    lolMouse: true,   // mouse like LoL: right click = walk, left click = attack (false = left click walks / selects)
  };
  const SECTIONS = [
    ['🔊 เสียง', [
      { k: 'sound', type: 'switch', label: 'เปิดเสียงเกม' },
      { k: 'master', type: 'range', label: 'ระดับเสียงรวม' },
      { k: 'music', type: 'range', label: '🎵 เพลงประกอบ', hint: 'เปลี่ยนตามสถานที่: ค่ายพัก · แผนที่ล่ามอน · สนามรบ · ใกล้บอส' },
      { k: 'sfx', type: 'range', label: '⚔ เสียงต่อสู้และสกิล' },
      { k: 'ui', type: 'range', label: '🔔 เสียงปุ่มและแจ้งเตือน' },
      { k: 'others', type: 'check', label: 'ได้ยินเสียงสกิลของผู้เล่นอื่น' },
      { k: 'bgMute', type: 'check', label: 'เงียบเมื่อสลับไปแท็บหรือแอปอื่น' },
    ]],
    ['🖥 การแสดงผล', [
      { k:'graphics', type:'select', label:'คุณภาพกราฟิก', choices:[['auto','อัตโนมัติ — ปรับตามความลื่น'],['high','สวยเต็มที่'],['smooth','เน้นลื่น — ลดออร่าและประกาย']] },
      { k: 'dmgNums', type: 'check', label: 'แสดงตัวเลขความเสียหาย' },
      { k: 'shake', type: 'check', label: 'สั่นหน้าจอเมื่อโจมตีแรง' },
      { k: 'reachRing', type: 'check', label: 'แสดงวงระยะโจมตีรอบตัวละคร' },
    ]],
    ['🖱 การควบคุม', [
      { k: 'lolMouse', type: 'check', label: 'เมาส์แบบ LoL: คลิกขวา = เดิน · คลิกซ้าย = โจมตี' },
    ]],
  ];

  let vals = { ...DEFAULTS };
  try { Object.assign(vals, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { /* storage optional */ }
  const subs = [];
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(vals)); } catch (e) { /* storage optional */ } };
  const SET = (window.SET = {
    get: (k) => vals[k],
    set(k, v) { if (vals[k] === v) return; vals[k] = v; save(); subs.forEach((f) => f(k, v)); },
    on: (fn) => subs.push(fn),
    reset() { vals = { ...DEFAULTS }; save(); subs.forEach((f) => f()); render(); },
  });

  // ------------------------------------------------------------ panel
  const $ = (id) => document.getElementById(id);
  const panel = $('setPanel'), body = $('setBody');
  function row(o) {
    const v = vals[o.k];
    if(o.type==='select')return `<label class="set-row set-select"><span>${o.label}</span><select data-k="${o.k}" aria-label="${o.label}">${o.choices.map(([key,label])=>`<option value="${key}"${v===key?' selected':''}>${label}</option>`).join('')}</select></label>`;
    if (o.type === 'range') return `<label class="set-row set-range"><span>${o.label}</span><b data-out="${o.k}">${v}%</b>
      <input type="range" min="0" max="100" step="5" value="${v}" data-k="${o.k}">${o.hint ? `<small>${o.hint}</small>` : ''}</label>`;
    const sw = o.type === 'switch' ? ' set-switch' : '';
    return `<label class="set-row set-check${sw}"><input type="checkbox" data-k="${o.k}"${v ? ' checked' : ''}><span>${o.label}</span></label>`;
  }
  function render() {
    body.innerHTML = SECTIONS.map(([title, rows]) => `<section><h4>${title}</h4>${rows.map(row).join('')}</section>`).join('') +
      '<div class="set-foot"><button type="button" data-act="test">▶ ทดสอบเสียง</button><button type="button" data-act="reset" class="ghost">คืนค่าเริ่มต้น</button></div>' +
      `<p class="set-note">ค่าที่ตั้งจำไว้ในเบราว์เซอร์เครื่องนี้${document.body.classList.contains('touch') ? ' · iPhone: เปิดโหมดเงียบ (สวิตช์ข้างเครื่อง) อยู่จะไม่มีเสียงเกม' : ''}</p>`;
    sync();
  }
  // the sliders dim while the sound is off
  const sync = () => body.classList.toggle('muted', !vals.sound);
  body.addEventListener('input', (e) => {
    const k = e.target.dataset.k;
    if (!k) return;
    if (e.target.type === 'range') { SET.set(k, +e.target.value); body.querySelector(`[data-out="${k}"]`).textContent = `${e.target.value}%`; }
    else SET.set(k, e.target.tagName==='SELECT'?e.target.value:e.target.checked);
    sync();
  });
  body.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    if (b.dataset.act === 'reset') SET.reset();
    else if (window.SFX) SFX.test();
  });
  SET.open = false;
  SET.toggle = function (force) {
    SET.open = force !== undefined ? !!force : !SET.open;
    if (SET.open) render();
    panel.classList.toggle('hidden', !SET.open);
  };
  panel.querySelector('.close').addEventListener('click', () => SET.toggle(false));
  $('setBtn').addEventListener('click', () => SET.toggle());
})();
