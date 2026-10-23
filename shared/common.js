// Shared game rules: used by the Node server (require) and the browser (window.C).
(function (root, factory) {
  const C = factory();
  if (typeof module === 'object' && module.exports) module.exports = C;
  else root.C = C;
})(typeof self !== 'undefined' ? self : this, function () {
  const TILE = 48;
  const MAP_W = 160;
  const MAP_H = 120;

  // PLAZA = camp / town stone floor, CLIFF = rock wall (solid), ICE = frozen lake (walkable) on the hunting maps
  const T = { GRASS: 0, PATH: 1, WATER: 2, HOLY: 3, DARK: 4, BRIDGE: 5, SAND: 6, FIELD: 7, PLAZA: 8, CLIFF: 9, ICE: 10 };

  const FACTIONS = {
    dharma: {
      id: 'dharma', name: 'ธรรมะ', title: 'ผู้พิทักษ์แสงสว่าง',
      color: '#6cc4ff', deep: '#1d5fa8', fx: ['#ffffff', '#9edbff', '#3a8dff'],
    },
    adharma: {
      id: 'adharma', name: 'อธรรม', title: 'ผู้ครองรัตติกาล',
      color: '#ff4d4d', deep: '#7a0d12', fx: ['#ffd6d6', '#ff3b3b', '#4a0006'],
    },
  };
  const enemyOf = (f) => (f === 'dharma' ? 'adharma' : 'dharma');

  // Bases (tile rects, inclusive; walls are on the perimeter)
  const BASES = {
    dharma: { x0: 4, y0: 44, x1: 27, y1: 76, spawn: { tx: 18, ty: 60 }, name: 'วิหารธรรมะ' },
    adharma: { x0: 132, y0: 44, x1: 155, y1: 76, spawn: { tx: 141, ty: 60 }, name: 'ป้อมปราการอธรรม' },
  };
  const CENTER = { tx: 79.5, ty: 60, r: 12.5 };
  // Blacksmith stall (weapon shop) inside each base: 2x1 tiles, x/y = front centre in pixels
  const SMITH = {
    dharma: { tx: 21, ty: 67 },
    adharma: { tx: MAP_W - 1 - 22, ty: 67 },
  };
  for (const f of Object.keys(SMITH)) { SMITH[f].x = (SMITH[f].tx + 1) * TILE; SMITH[f].y = (SMITH[f].ty + 1) * TILE - 4; }
  // ร้านขายยา: a second shop building (same look as the smith's), a few tiles south of it in each base
  const APOTHECARY = { dharma: { tx: 21, ty: 71 }, adharma: { tx: MAP_W - 1 - 22, ty: 71 } };
  for (const f of Object.keys(APOTHECARY)) { APOTHECARY[f].x = (APOTHECARY[f].tx + 1) * TILE; APOTHECARY[f].y = (APOTHECARY[f].ty + 1) * TILE - 4; }
  // Teleport stone inside each base (warp to the hunting maps); x/y = tile centre
  const STONES = {
    dharma: { tx: 8, ty: 64 },
    adharma: { tx: MAP_W - 1 - 8, ty: 64 },
  };
  for (const f of Object.keys(STONES)) { STONES[f].x = STONES[f].tx * TILE + TILE / 2; STONES[f].y = STONES[f].ty * TILE + TILE / 2; }

  // ---------------- classes & skills ----------------
  const CLASSES = {
    dualblade: {
      id: 'dualblade', name: 'ดาบคู่',
      desc: 'นักดาบผู้ใช้ดาบสองเล่ม โจมตีรวดเร็ว คล่องแคล่ว เชี่ยวชาญการบุกประชิด',
      hp: 145, hpG: 22, mp: 80, mpG: 10, atk: 15, atkG: 4.2, def: 3, defG: 1,
      speed: 230, crit: 0.14,
      // evo = evolutions: at that level the skill changes name, pose and effects and hits harder (C.skillRank)
      // every skill fights at arm's length: single-target combos, spins round the body, a blink behind the target,
      // a slam and a charge. Nothing is cast at range.
      skills: [
        { id: 'fang', name: 'เขี้ยวคู่พยัคฆ์', key: '1', lvl: 1, mp: 0, cd: 420,
          desc: 'กด 1 (หรือ Space) เดินเข้าไปฟันเป้าที่เลือกไว้ด้วยดาบสองเล่ม (คลิกศัตรู = เลือกเป้า · ไม่มีเป้า = ตัวที่ใกล้ที่สุด) โดนทีละ 1 ตัว',
          evo: [{ lvl: 20, name: 'เขี้ยวคู่พยัคฆ์คลั่ง', desc: 'ระยะฟันไกลขึ้น ทุกการฟันครั้งที่ 3 ไขว้ดาบตัดหนัก 150% และแรงตัดกระเด็นโดนศัตรูรอบเป้า 60%' }] },
        { id: 'lotus', name: 'ระบำบัวเหล็ก', key: '2', lvl: 1, mp: 14, cd: 5000,
          desc: 'หมุนตัวกางดาบเป็นกลีบบัว ฟันศัตรูทุกตัวรอบกาย 3 รอบ (รัศมี 135)',
          evo: [{ lvl: 40, name: 'บัวเหล็กพันกลีบ', desc: 'หมุน 4 รอบ รัศมีกว้างขึ้น ดูดมอนสเตอร์เข้าหาตัว รอบสุดท้ายแรงขึ้น' }] },
        { id: 'shadowstep', name: 'ก้าวเงาสังหาร', key: '3', lvl: 2, mp: 12, cd: 6000,
          desc: 'วาบไปโผล่ด้านหลังเป้าที่เลือก (ไกลสุด 280) แทงสวนหลังแรง 170% และทำให้ช้าลง 1 วินาที · ไม่มีเป้า = พุ่งไปทางเมาส์ฟันทุกตัวที่ขวาง',
          evo: [{ lvl: 60, name: 'เงาสังหารสามภพ', desc: 'หลังวาบถึงเป้าฟันซ้ำอีก 2 ครั้ง แล้วระเบิดเงารอบตัว' }] },
        { id: 'rend', name: 'ฉีกเกราะกากบาท', key: '4', lvl: 4, mp: 20, cd: 8000,
          desc: 'ไขว้ดาบฟันเป็นกากบาทตรงหน้า ศัตรูเลือดไหล 4 วินาที และเกราะแตก (ป้องกัน −25%) 5 วินาที',
          evo: [{ lvl: 80, name: 'กากบาทดาราทลายเกราะ', desc: 'ฟันสองชั้นเป็นดาว 8 แฉก ระยะไกลขึ้น เกราะแตก −35%' }] },
        { id: 'tempest', name: 'พายุพันคม', key: '5', lvl: 7, mp: 45, cd: 24000,
          desc: 'ปลดดาบวิญญาณนับร้อยหมุนรอบกายนาน 2.6 วินาที ฟันทุกสิ่งรอบตัว 8 ครั้ง (รัศมี 170) เดินไล่ฟันได้',
          evo: [{ lvl: 90, name: 'พายุพันคมสะท้านฟ้า', desc: 'ฟัน 10 ครั้ง วงกว้างขึ้น ปิดท้ายด้วยดาบทั้งหมดระเบิดออกรอบตัว' },
            { lvl: 130, name: 'เทพพายุพันคม', desc: 'ฟัน 12 ครั้ง วงกว้างที่สุด ระเบิดดาบเทพปิดท้ายแรงมาก' }] },
        { id: 'crescent', name: 'จันทร์เสี้ยวผ่าปฐพี', key: '6', lvl: 10, mp: 16, cd: 4000,
          desc: 'ฟันกวาดเป็นจันทร์เสี้ยวกว้างตรงหน้า (ระยะ 190 · มุม 130°) โดนทุกตัวในแนวฟัน',
          evo: [{ lvl: 100, name: 'จันทร์คู่ผ่าปฐพี', desc: 'ฟันกวาดสองจันทร์ไปกลับ ระยะไกลขึ้น ศัตรูที่โดนช้าลง 1 วินาที' }] },
        { id: 'skyfall', name: 'พยัคฆ์ร่วงฟ้า', key: '7', lvl: 30, mp: 24, cd: 9000,
          desc: 'กระโดดขึ้นฟ้าแล้วทิ้งดิ่งฟาดดาบคู่ลงจุดเป้าหมาย (ไกลสุด 280) กระแทกรอบด้าน มอนสเตอร์มึน 0.5 วินาที',
          evo: [{ lvl: 110, name: 'อุกกาบาตพยัคฆ์ทมิฬ', desc: 'วงกว้างขึ้น ทิ้งวงเพลิงเผา 4 วินาที และคลื่นกระแทกชั้นที่สอง' }] },
        { id: 'thousand', name: 'พันคมไร้เงา', key: '8', lvl: 50, mp: 32, cd: 14000,
          desc: 'ล็อกเป้าประชิด (ระยะ 150) ฟันรัวเร็วจนมองไม่เห็นเงา 8 ครั้งใส่เป้าเดียว',
          evo: [{ lvl: 120, name: 'พันคมเทพอสูร', desc: 'ฟันรัว 12 ครั้ง ปิดท้ายระเบิดคมดาบรอบเป้า' }] },
        { id: 'twindragon', name: 'มังกรคู่ผ่าสวรรค์', key: '9', lvl: 70, mp: 50, cd: 18000,
          desc: 'พุ่งไปข้างหน้า 220 พร้อมมังกรดาบคู่ ฟันทุกตัวที่ขวาง แล้วมังกรผงาดระเบิดรอบจุดที่ลงพื้น',
          evo: [{ lvl: 130, name: 'มังกรเทพคู่พิฆาตสวรรค์', desc: 'มังกรระเบิดสามระลอกขยายวงออก และเผาศัตรู 4 วินาที' }] },
      ],
    },
    // นักพรต: spells from range (basic attack 1 = a jade talisman thrown at the target), heals and buffs the party
    // (class-art/taoist/PROMPTS.md). reach = how close the basic attack walks to its target.
    taoist: {
      id: 'taoist', name: 'นักพรต', weapon: 'แส้', sheet: 'taoist',
      desc: 'ผู้บำเพ็ญเต๋า ใช้แส้ปัดฝุ่นและยันต์ โจมตีด้วยเวทระยะไกล ฮีลหมู่ และบัพเกราะ/พลังโจมตีให้ตัวเองและปาร์ตี้',
      hp: 160, hpG: 25, mp: 140, mpG: 17, atk: 12, atkG: 3.6, def: 4, defG: 1.3,
      speed: 205, crit: 0.06, reach: 330,
      // spells from range, party heals and party buffs (aegis = damage taken down, might = damage dealt up)
      skills: [
        { id: 'jade', name: 'ยันต์หยกพิฆาต', key: '1', lvl: 1, mp: 0, cd: 650,
          desc: 'กด 1 (หรือ Space) ซัดยันต์หยกใส่เป้าที่เลือกไว้จากระยะไกล (ไกลสุด 380) โดนทีละ 1 ตัว',
          evo: [{ lvl: 20, name: 'ยันต์หยกสามดารา', desc: 'ซัดยันต์ 3 แผ่น แผ่นกลางใส่เป้า อีกสองแผ่นหาศัตรูใกล้เคียง (60%)' }] },
        { id: 'skybolt', name: 'อสนีเมฆา', key: '2', lvl: 1, mp: 16, cd: 5000,
          desc: 'เรียกเมฆอสนีผ่าลงจุดเป้าหมาย (ไกลสุด 380) ดาเมจรอบจุดตก',
          evo: [{ lvl: 40, name: 'อสนีเก้าชั้นฟ้า', desc: 'ฟ้าผ่า 3 ระลอกวงกว้างขึ้น ศัตรูที่โดนชาขยับไม่ได้ 0.6 วินาที' }] },
        { id: 'mercy', name: 'น้ำทิพย์ชโลมชีวา', key: '3', lvl: 2, mp: 26, cd: 15000,
          desc: 'ฮีลหมู่ทันที: โปรยน้ำทิพย์ฟื้นพลังชีวิตเล็กน้อยให้ตัวเองและสมาชิกปาร์ตี้รอบตัว (รัศมี 480) ครั้งเดียวเมื่อกดใช้ · พาสซีฟเมื่อเรียนแล้ว: ทุก 5 วินาที ตัวเองและสมาชิกปาร์ตี้รัศมี 480 ฟื้น 2–6% ของ HP สูงสุดตามเลเวลสกิล (PvP ได้ครึ่งเดียว ไม่ซ้อนจากนักพรตหลายคน)',
          evo: [{ lvl: 60, name: 'บัวทิพย์ฟื้นชีวา', desc: 'บัวทิพย์บานใต้เท้าทุกคนครู่หนึ่ง ฮีลทันทีมากขึ้น 35% · พาสซีฟฟื้นเพิ่มอีก 1% ของ HP สูงสุด' }] },
        { id: 'aegis', name: 'ยันต์เกราะห้าธาตุ', key: '4', lvl: 4, mp: 24, cd: 16000,
          desc: 'บัพตัวเองและปาร์ตี้: เกราะยันต์ห้าธาตุลดความเสียหายที่ได้รับ นาน 8 วินาที',
          evo: [{ lvl: 80, name: 'กระดองเต่าเทพพิทักษ์', desc: 'กระดองเต่าทองลดความเสียหายมากขึ้น นาน 10 วินาที' }] },
        { id: 'heavens', name: 'ค่ายกลสวรรค์', key: '5', lvl: 7, mp: 45, cd: 24000,
          desc: 'วางค่ายกลสวรรค์ระยะไกล (ไกลสุด 380) ศัตรูในวงโดนดาเมจต่อเนื่องและช้าลง พวกเดียวกันในวงได้ฟื้นพลังทุกจังหวะ',
          evo: [{ lvl: 90, name: 'ค่ายกลแปดทิศสวรรค์', desc: 'วงกว้างขึ้น 9 จังหวะ ปิดท้ายด้วยระเบิดแสงกลางค่ายกล' },
            { lvl: 130, name: 'ไท่จี๋พลิกฟ้า', desc: 'วงหยินหยางยักษ์ 11 จังหวะ ระเบิดหยินหยางปิดท้ายแรงมาก' }] },
        { id: 'spiritsword', name: 'กระบี่วิญญาณเหิน', key: '6', lvl: 10, mp: 18, cd: 4000,
          desc: 'ส่งกระบี่วิญญาณพุ่งทะลุศัตรูเป็นแนวยาว 520',
          evo: [{ lvl: 100, name: 'กระบี่วิญญาณพันเล่ม', desc: 'กระบี่ 5 เล่มแผ่เป็นพัด ไกลขึ้น' }] },
        { id: 'might', name: 'ยันต์ปลุกเทพยุทธ์', key: '7', lvl: 30, mp: 30, cd: 20000,
          desc: 'บัพตัวเองและปาร์ตี้: ปลุกพลังเทพยุทธ์ เพิ่มความแรงโจมตี 15% นาน 12 วินาที (รัศมี 480)',
          evo: [{ lvl: 110, name: 'เทพยุทธ์ประทับร่าง', desc: 'เพิ่มความแรงโจมตี 25% และคริติคอล +8% นาน 15 วินาที' }] },
        { id: 'meteor', name: 'ดาวตกเพลิงฟ้า', key: '8', lvl: 50, mp: 38, cd: 16000,
          desc: 'เรียกดาวตก 5 ลูกร่วงลงรอบจุดเป้าหมาย (ไกลสุด 400) ระเบิดเป็นวง',
          evo: [{ lvl: 120, name: 'ฝนดาวตกล้างปฐพี', desc: 'ดาวตก 8 ลูก เผาศัตรู 4 วินาที ปิดท้ายด้วยดาวยักษ์กลางวง' }] },
        { id: 'nirvana', name: 'พรสวรรค์ชุบชีวา', key: '9', lvl: 70, mp: 55, cd: 45000,
          desc: 'ฮีลหมู่ขั้นสูง: ฟื้นพลังชีวิตมหาศาล และล้างสตัน/ตรึง/ช้าให้ตัวเองและปาร์ตี้ คืนปราณ 15% ให้สมาชิกปาร์ตี้ (รัศมี 520)',
          evo: [{ lvl: 130, name: 'พรสวรรค์ไท่จี๋', desc: 'เพิ่มเกราะลดความเสียหาย 40% นาน 4 วินาที และฟื้นพลังต่อเนื่องอีก 5 วินาที' }] },
      ],
    },
    // นักธนู: shoots from range (basic attack 1 = one arrow at the target), crit / attack-speed self buffs, volleys and a phoenix shot
    // (sprites: modelนักธนู/, npm run archer). sheet = the class has its own drawn sprite sheets (assets/<sheet>-*.png).
    archer: {
      id: 'archer', name: 'นักธนู', weapon: 'ธนู', sheet: 'archer',
      desc: 'นักแม่นธนูผู้ว่องไว ยิงจากระยะไกล บัพคริติคอลและความเร็วโจมตีให้ตัวเอง ระดมศรใส่ศัตรูทีละหลายตัว',
      hp: 135, hpG: 20, mp: 100, mpG: 13, atk: 14, atkG: 4.0, def: 2, defG: 0.85,
      speed: 220, crit: 0.14, reach: 360,
      // ranged shots, self buffs (hawkeye = crit, gale = attack speed) and a few area volleys
      skills: [
        { id: 'hawkshot', name: 'ศรเหยี่ยว', key: '1', lvl: 1, mp: 0, cd: 560,
          desc: 'กด 1 (หรือ Space) ยิงลูกศรใส่เป้าที่เลือกไว้จากระยะไกล (ไกลสุด 400) โดนทีละ 1 ตัว',
          evo: [{ lvl: 20, name: 'ศรเหยี่ยวคู่', desc: 'ยิงศรสองดอกติดกัน ดอกที่สองแรง 60% · ทุกดอกที่ 3 ทะลุไปโดนศัตรูข้างหลังอีก 1 ตัว' }] },
        { id: 'scatter', name: 'ศรพิรุณกระจาย', key: '2', lvl: 1, mp: 14, cd: 5000,
          desc: 'ยิงศร 5 ดอกแผ่เป็นพัดไปข้างหน้า ศัตรูแต่ละตัวโดนได้ดอกเดียว',
          evo: [{ lvl: 40, name: 'พายุศรพิรุณ', desc: 'ยิงสองระลอก ระลอกละ 7 ดอก กว้างและไกลขึ้น' }] },
        { id: 'hawkeye', name: 'เนตรเหยี่ยว', key: '3', lvl: 2, mp: 18, cd: 20000,
          desc: 'บัพคริ: เพ่งสมาธิ คริติคอล +15% และแรงคริติคอล +30% นาน 10 วินาที',
          evo: [{ lvl: 60, name: 'เนตรอินทรีสวรรค์', desc: 'คริติคอล +25% แรงคริติคอล +50% นาน 12 วินาที และแบ่งพลังครึ่งหนึ่งให้ปาร์ตี้รอบตัว' }] },
        { id: 'gale', name: 'ลมกรดเร่งศร', key: '4', lvl: 4, mp: 20, cd: 20000,
          desc: 'บัพตีไว: ลมกรดหมุนรอบกาย ความเร็วโจมตี +35% นาน 8 วินาที',
          evo: [{ lvl: 80, name: 'พายุเร่งพันศร', desc: 'ความเร็วโจมตี +50% นาน 10 วินาที และทุกการยิงปกติแตกศรเงาไปโดนศัตรูใกล้เป้าอีก 1 ตัว (45%)' }] },
        { id: 'skyrain', name: 'ฝนศรพันดอก', key: '5', lvl: 7, mp: 45, cd: 24000,
          desc: 'ยิงศรขึ้นฟ้าให้ร่วงลงเป็นห่าฝนใส่พื้นที่เป้าหมาย (ไกลสุด 340) หลายระลอก',
          evo: [{ lvl: 90, name: 'ฝนศรสวรรค์', desc: 'วงกว้างขึ้น 9 ระลอก ปิดท้ายด้วยศรสวรรค์ยักษ์ปักกลางวง' },
            { lvl: 130, name: 'มหาฝนศรล้างโลก', desc: 'ห่าฝนศร 11 ระลอก ศรเทพระเบิดแสงปิดท้าย' }] },
        { id: 'deadeye', name: 'ศรเจาะหัวใจ', key: '6', lvl: 10, mp: 16, cd: 4500,
          desc: 'เล็งยิงศรเจาะเกราะใส่เป้าเดียวจากระยะไกลมาก (ไกลสุด 520) แรงมาก · ขณะมีบัพเนตรเหยี่ยวติดคริติคอลแน่นอน',
          evo: [{ lvl: 100, name: 'ศรเจาะหัวใจเหนือเมฆ', desc: 'แรงขึ้นอีก และศรแตกกระจายไปโดนศัตรูใกล้เป้าอีก 2 ตัว' }] },
        { id: 'rollshot', name: 'ม้วนเงาลม', key: '7', lvl: 30, mp: 22, cd: 8000,
          desc: 'ม้วนตัวถอยหลัง 220 แล้วยิงศร 3 ดอกใส่ศัตรูข้างหน้า ได้ความเร็วโจมตี +20% นาน 3 วินาที',
          evo: [{ lvl: 110, name: 'เงาวายุพันศร', desc: 'ยิง 5 ดอก และทิ้งระเบิดลมไว้ที่จุดเดิม ศัตรูที่โดนช้าลง' }] },
        { id: 'blast', name: 'ศรระเบิดอัคนี', key: '8', lvl: 50, mp: 35, cd: 14000,
          desc: 'ยิงศรอัคนีโค้งลงจุดเป้าหมาย (ไกลสุด 420) ระเบิดเป็นวงและเผาศัตรู 4 วินาที',
          evo: [{ lvl: 120, name: 'ศรอัคนีสามดารา', desc: 'ศรแตกเป็นสามดอก ระเบิดสามจุดเป็นสามเหลี่ยม' }] },
        { id: 'stormphoenix', name: 'หงส์อสนีทะลวงฟ้า', key: '9', lvl: 70, mp: 50, cd: 18000,
          desc: 'ปลดปล่อยศรหงส์อสนียักษ์พุ่งไปข้างหน้า 680 ทะลวงทุกสิ่งที่ขวาง ศัตรูที่โดนช้าลง',
          evo: [{ lvl: 130, name: 'คู่หงส์อสนีสวรรค์', desc: 'หงส์อสนีคู่บินพันเกลียว ระเบิดสายฟ้าที่ปลายทาง' }] },
      ],
    },
  };
  // Append new classes: existing snapshot class indexes must stay stable.
  CLASSES.spearman = {
    id: 'spearman', name: 'ทวน', weapon: 'ทวน', sheet: 'spearman',
    desc: 'ทวนคอมโบหลายจังหวะ เปิดท่า–ต่อเนื่อง–ปิดท่าหนัก ล่าบอสด้วยท่าเป้าเดียว และกวาดหมู่ด้วยบดศิลา สะบั้นหัวใจ และทะลวงสวรรค์',
    hp: 185, hpG: 27, mp: 130, mpG: 16, atk: 19, atkG: 4.9, def: 1, defG: 0.65,
    speed: 205, crit: 0.04, reach: 112,
    skills: [
      { id: 'spearThrust', name: 'ทวนทะลวง', key: '1', lvl: 1, mp: 0, cd: 760,
        desc: 'แทงเป้าเดียว 150% ระยะประชิด 130 · กด 1 หรือ Space เพื่อเดินเข้าหาเป้า',
        spear: { damage: 1.5, range: 130, windup: 160 },
        evo: [{ lvl: 20, name: 'ทวนทะลวงเหล็ก', desc: 'แทงเป้าเดิมหนักขึ้น 30% ไม่มีดาเมจกระจาย' }] },
      { id: 'spearCrush', name: 'ทวนบดศิลา', key: '2', lvl: 1, mp: 18, cd: 4400,
        desc: 'งัดทวน 90% → กระแทก 210% ระยะ 145 · จังหวะท้ายกระจาย 65% ของจังหวะนั้นรอบเป้ารัศมี 100 สูงสุด 4 ตัวเพิ่ม', spear: { damage: 3, range: 145, windup: 220 },
        evo: [{ lvl: 40, name: 'ทวนบดภูผา', desc: 'คอมโบ 2 จังหวะแรงขึ้น 30% กระแทกหมู่รัศมี 100 สูงสุด 4 ตัวเพิ่ม เป้าหลักช้า 1 วินาที' }] },
      { id: 'spearChain', name: 'ทวนสามประสาน', key: '3', lvl: 2, mp: 24, cd: 6800,
        desc: 'แทงซ้าย 80% → แทงขวา 80% → ทะลวง 185% ใส่เป้าเดิม ระยะ 140 · เป้าตายหรือพ้นระยะหยุดคอมโบ',
        spear: { damage: 1.15, range: 140, windup: 120, hits: 3, gap: 180 },
        evo: [{ lvl: 60, name: 'ทวนห้าประสาน', desc: 'คอมโบเป้าเดียว 5 จังหวะ จังหวะสุดท้ายหนักที่สุด ดาเมจพื้นฐานรวม 575% และแรงขึ้น 30%' }] },
      { id: 'spearBreak', name: 'ทวนเจาะเกราะ', key: '4', lvl: 4, mp: 26, cd: 8000,
        desc: 'เคาะเกราะ 65% → แทงเจาะ 195% ระยะ 145 · จังหวะท้ายลดป้องกันเป้าเดียว 25% นาน 5 วินาที',
        spear: { damage: 2.6, range: 145, windup: 200 },
        evo: [{ lvl: 80, name: 'ทวนทลายเกราะมังกร', desc: 'แรงขึ้น 30% ลดป้องกันเป้าเดิม 35% นาน 5 วินาที ไม่ซ้อนเกราะแตก' }] },
      { id: 'spearExecution', name: 'ทวนปลิดชีพ', key: '5', lvl: 7, mp: 48, cd: 19200,
        desc: 'แทงเปิด 97.5% → แทงย้ำ 97.5% → ปลิดชีพ 455% ระยะ 150 · แต่ละจังหวะแรงขึ้น 25% เมื่อ HP เป้าไม่เกิน 30%',
        spear: { damage: 6.5, range: 150, windup: 400 },
        evo: [{ lvl: 90, name: 'ทวนพิพากษาชีวิต', desc: 'แรงขึ้น 30% และได้โบนัสปลิดชีพเมื่อ HP เป้าไม่เกิน 40%' },
          { lvl: 130, name: 'เทพทวนพิพากษา', desc: 'แรงขึ้นรวม 60% โบนัสปลิดชีพ 40% เมื่อ HP เป้าไม่เกิน 40% ยังคงเป้าเดียว' }] },
      { id: 'spearHeart', name: 'ทวนสะบั้นหัวใจ', key: '6', lvl: 10, mp: 22, cd: 5200,
        desc: 'แทง 70% → หมุน 70% → กวาด 140% ระยะ 140 · ท้ายกวาดกรวยหน้า 140° ระยะ 170 กระจาย 65% สูงสุด 5 ตัวเพิ่ม เลือดไหลเฉพาะเป้าหลัก',
        spear: { damage: 2.8, range: 140, windup: 180 },
        evo: [{ lvl: 100, name: 'ทวนสะบั้นวิญญาณ', desc: 'คอมโบกวาดหมู่ 3 จังหวะแรงขึ้น 30% เป้าหลักช้า 1.5 วินาทีและเลือดไหล ผลสถานะไม่กระจาย' }] },
      { id: 'spearPin', name: 'ทวนตรึงพยัคฆ์', key: '7', lvl: 30, mp: 30, cd: 9600,
        desc: 'ปัดขา 80% → แทงตรึง 240% ระยะ 150 · จังหวะท้ายทำให้เป้าเดียวช้า 1.5 วินาที',
        spear: { damage: 3.2, range: 150, windup: 200 },
        evo: [{ lvl: 110, name: 'ทวนสยบพยัคฆ์', desc: 'แรงขึ้น 30% และทำให้เป้าช้าลง 2.5 วินาที' }] },
      { id: 'spearBoss', name: 'ทวนล่ามังกร', key: '8', lvl: 50, mp: 40, cd: 12800,
        desc: 'แทงเปิด 96% → แทงสวน 96% → ทะลวงมังกร 288% ระยะ 155 · ทุกจังหวะแรงขึ้น 35% ต่อบอส',
        spear: { damage: 4.8, range: 155, windup: 400 },
        evo: [{ lvl: 120, name: 'ทวนพิฆาตราชันมังกร', desc: 'แรงขึ้น 30% และโบนัสต่อบอสเพิ่มเป็น 50% ไม่มีดาเมจรอบตัว' }] },
      { id: 'spearHeaven', name: 'ทวนทะลวงสวรรค์', key: '9', lvl: 70, mp: 60, cd: 17600,
        desc: 'แทงยก 120% → ทะลวง 180% → ทิ้งทวน 500% ระยะ 155 · ท้ายระเบิดรอบเป้ารัศมี 150 กระจาย 55% สูงสุด 5 ตัวเพิ่ม',
        spear: { damage: 8, range: 155, windup: 400 },
        evo: [{ lvl: 130, name: 'มหาเทพทวนไร้พ่าย', desc: 'คอมโบ 3 จังหวะรวมพื้นฐาน 1600% และแรงขึ้น 30% จังหวะท้ายระเบิดหมู่รัศมี 150 เป้าหลักตายหรือพ้นระยะหยุดคอมโบ' }] },
    ],
  };
  // Append only: the first four class indexes are already stored in snapshots.
  // Shared impact timeline: damage, body poses and VFX use the same authored beats.
  const SPEAR_COMBOS = {
    spearThrust: [[160,1,'thrust']],
    spearCrush: [[220,.3,'rise'],[500,.7,'slam']],
    spearBreak: [[200,.25,'jab'],[480,.75,'drill']],
    spearExecution: [[400,.15,'jab'],[620,.15,'cross'],[940,.7,'finish']],
    spearHeart: [[180,.25,'jab'],[380,.25,'spin'],[660,.5,'sweep']],
    spearPin: [[200,.25,'low'],[500,.75,'pin']],
    spearBoss: [[400,.2,'jab'],[620,.2,'cross'],[900,.6,'dragon']],
    spearHeaven: [[400,.15,'rise'],[700,.225,'thrust'],[1100,.625,'dive']],
  };
  const SPEAR_AREAS = {
    spearCrush:{shape:'circle',radius:100,scale:.65,cap:4},
    spearHeart:{shape:'cone',radius:170,half:70*Math.PI/180,scale:.65,cap:5},
    spearHeaven:{shape:'circle',radius:150,scale:.55,cap:5},
  };
  function spearSequence(sk,rank=0){
    const chain=sk.id==='spearChain',count=chain?(rank?5:3):sk.id==='spearHeaven'&&rank?2:1;
    const beats=chain?(rank?[[120,.75,'jab'],[290,.75,'cross'],[460,.9,'jab'],[630,.9,'cross'],[870,2.45,'finish']]:[[120,.8,'jab'],[300,.8,'cross'],[560,1.85,'finish']]):SPEAR_COMBOS[sk.id];
    if(!beats)return [];
    return beats.map(([at,weight,move],i)=>({at,move,power:chain?weight:sk.spear.damage*count*weight,
      defK:chain?weight/1.15:count*weight,area:i===beats.length-1?SPEAR_AREAS[sk.id]||null:null}));
  }
  // Geometry intentionally tests the enemy's ground centre, matching the visible footprint exactly.
  function spearAreaContains(area,cx,cy,angle,x,y){
    const dx=x-cx,dy=y-cy;if(Math.hypot(dx,dy)>area.radius)return false;
    return area.shape!=='cone'||Math.abs(Math.atan2(Math.sin(Math.atan2(dy,dx)-angle),Math.cos(Math.atan2(dy,dx)-angle)))<=area.half;
  }
  CLASSES.warrior = {
    id: 'warrior', name: 'นักรบแนวหน้า', weapon: 'ดาบและโล่',
    desc: 'ถือดาบกับโล่ รับความเสียหายและคุ้มกันปาร์ตี้ HP/เกราะสูง โจมตีช้า ไม่มีฮีลตนเอง ยั่วยุได้เฉพาะมอนสเตอร์',
    hp: 205, hpG: 30, mp: 85, mpG: 10, atk: 12, atkG: 3.2, def: 6, defG: 1.5,
    speed: 195, crit: 0.05, reach: 105,
    skills: [
      { id: 'guardSlash', name: 'ดาบพิทักษ์', key: '1', lvl: 1, mp: 0, cd: 700,
        frontline: { damage: 1.2, range: 125, windup: 180 },
        desc: 'ฟันดาบเป้าเดียว 120% ระยะ 125', evo: [{ lvl: 20, name: 'ดาบพิทักษ์เหล็กกล้า', desc: 'พลังสกิลเพิ่ม 30% ยังคงโจมตีเป้าเดียว' }] },
      { id: 'shieldBash', name: 'โล่กระแทก', key: '2', lvl: 1, mp: 18, cd: 9000,
        frontline: { damage: 1.4, range: 135, windup: 240, stun: 500 },
        desc: 'กระแทกเป้าเดียว 140% สตัน 0.5 วินาที บอสได้รับสถานะช้าแทน', evo: [{ lvl: 40, name: 'โล่สะท้านศิลา', desc: 'พลังเพิ่ม 30% สตัน 0.7 วินาที ยังติดกฎป้องกันสตันซ้ำ' }] },
      { id: 'ironGuard', name: 'ตั้งโล่เหล็ก', key: '3', lvl: 2, mp: 24, cd: 18000,
        frontline: { ward: 0.25, duration: 5000 },
        desc: 'ลดความเสียหายตนเอง 25% นาน 5 วินาที ใช้ค่าป้องกันที่แรงกว่าบัพเกราะอื่น ไม่บวกซ้อน · พาสซีฟโล่หนามเมื่อเรียนแล้ว: สะท้อนดาเมจที่รับ 8% กลับใส่ผู้โจมตี ระหว่างตั้งโล่ 25% (PvP ครึ่งเดียว ต่อครั้งไม่เกิน 2 เท่าพลังโจมตี)', evo: [{ lvl: 60, name: 'ตั้งโล่เหล็กกล้า', desc: 'ลดความเสียหาย 30% นาน 6 วินาที' }] },
      { id: 'shieldSweep', name: 'ดาบกวาดแนวหน้า', key: '4', lvl: 4, mp: 22, cd: 6500,
        frontline: { damage: 1.7, range: 155, windup: 280, area: true },
        desc: 'กวาดดาบด้านหน้า 170% รัศมี 155', evo: [{ lvl: 80, name: 'ดาบกวาดปราการ', desc: 'พลังเพิ่ม 30% ทำให้ช้า 1 วินาที' }] },
      { id: 'battleCry', name: 'คำรามท้าศึก', key: '5', lvl: 7, mp: 28, cd: 16000,
        frontline: { taunt: true, range: 220 },
        desc: 'ยั่วยุมอนสเตอร์ในระยะ 220 ให้เปลี่ยนเป้ามาหาตน 2.5 วินาที บอส 1.5 วินาที ไม่มีผลบังคับผู้เล่น', evo: [{ lvl: 90, name: 'คำรามขุนพล', desc: 'ระยะเพิ่มเป็น 260' }, { lvl: 130, name: 'คำรามมหาขุนพล', desc: 'ระยะเพิ่มเป็น 280 ไม่เพิ่มระยะเวลายั่วยุ' }] },
      { id: 'sunderStrike', name: 'ดาบผ่าเกราะ', key: '6', lvl: 10, mp: 22, cd: 8500,
        frontline: { damage: 2, range: 140, windup: 300, armorBreak: 0.2 },
        desc: 'ฟันเป้าเดียว 200% ลดเกราะเป้า 20% นาน 5 วินาที ไม่ซ้อนเกราะแตก', evo: [{ lvl: 100, name: 'ดาบผ่าเกราะขุนพล', desc: 'พลังเพิ่ม 30% ลดเกราะ 25%' }] },
      { id: 'rallyGuard', name: 'แนวโล่คุ้มกัน', key: '7', lvl: 30, mp: 34, cd: 24000,
        frontline: { ward: 0.12, duration: 6000, party: true, range: 280 },
        desc: 'คุ้มกันตนเองและปาร์ตี้ระยะ 280 ลดความเสียหาย 12% นาน 6 วินาที ไม่บวกซ้อนเกราะนักพรต', evo: [{ lvl: 110, name: 'แนวโล่ขุนพล', desc: 'ลดความเสียหาย 16% ระยะเวลาเท่าเดิม' }] },
      { id: 'earthShatter', name: 'โล่สะเทือนปฐพี', key: '8', lvl: 50, mp: 36, cd: 16000,
        frontline: { damage: 2.3, range: 175, windup: 450, area: true, slow: 1500 },
        desc: 'กระแทกรอบตัว 230% ทำให้ช้า 1.5 วินาที', evo: [{ lvl: 120, name: 'โล่สะเทือนภูผา', desc: 'พลังเพิ่ม 30% รัศมีเพิ่มเป็น 200' }] },
      { id: 'lastBastion', name: 'ปราการสุดท้ายแห่งขุนพล', key: '9', lvl: 70, mp: 50, cd: 40000,
        frontline: { ward: 0.35, duration: 4000 },
        desc: 'ลดความเสียหายตนเอง 35% นาน 4 วินาที ไม่มีอมตะ ไม่มีฮีล ไม่บวกซ้อนเกราะอื่น', evo: [{ lvl: 130, name: 'ปราการมหาขุนพล', desc: 'ลดความเสียหาย 40% นาน 4 วินาที' }] },
      { id: 'guardianOath', name: 'สัตย์พิทักษ์', key: '0', lvl: 120, mp: 100, cd: 45000,
        frontline: { ward: 0.2, duration: 7000, party: true, range: 300 },
        desc: 'ตนเองและปาร์ตี้ระยะ 300 ลดความเสียหาย 20% นาน 7 วินาที ไม่บวกซ้อนเกราะอื่น', evo: [] },
      { id: 'citadelStrike', name: 'ดาบมหาปราการ', key: '-', lvl: 130, mp: 100, cd: 70000,
        frontline: { damage: 5, range: 210, windup: 900, area: true, slow: 1800 },
        desc: 'ตั้งท่า 0.9 วินาที ฟันรอบตัว 500% ระยะ 210 ทำให้ช้า 1.8 วินาที ถูกสตัน/ตรึงระหว่างท่าจะยกเลิก', evo: [] },
    ],
  };
  // Two learned endgame arts per class (keys 0 / -). No long channel: a short wind-up, then the body really travels
  // to the aimed spot and the damage lands over the move (server: World.castSkill; route: ascended-skills.js S.route).
  //   [id, name, damage (×ATK, the whole move), radius, range (how far the aimed spot may be)]
  const ASCENDED_ARTS = {
    dualblade: [['bladeFirmament','หมื่นคมพิพากษา',10,210,180],['bladeGenesis','จักรพรรดิคู่ผ่าสามภพ',16,260,220]],
    archer: [['arrowFirmament','ฝนศรกลุ่มดาว',9,200,460],['arrowGenesis','หงส์จักรวาลล้างภพ',14,250,500]],
    taoist: [['taoFirmament','ค่ายกลเก้าสวรรค์',8,220,400],['taoGenesis','มหามณฑลเทพมาร',13,280,440]],
    spearman: [['spearFirmament','ทวนมังกรถล่มปฐพี',11,200,190],['spearGenesis','ทวนมหาเทพดับพิภพ',17,250,220]],
  };
  // Each class has its own pair of moves (times in ms from the cast; cast = the finishing blow, then `recovery`).
  // The hits land at first + i × gap and share `share` of the damage; the finishing blow deals the rest.
  // The client draws the route of each move (ascended-skills.js ROUTES) and its effects from the same numbers.
  const ASCENDED_MOVES = {
    // ดาบคู่: dash a five-pointed star through the spot / soar, 8 afterimages strike in, meteor dive
    dualblade: [{ move: 'star', windup: 150, hits: 5, gap: 110, cast: 760, share: 0.55 },
      { move: 'ascend', windup: 150, first: 470, hits: 8, gap: 45, cast: 1000, share: 0.4 }],
    // ธนู: back-flip into the air and rain 6 volleys into a constellation / run an arc round the foes shooting in,
    // then leap and loose a phoenix arrow straight down
    archer: [{ move: 'volley', windup: 150, first: 420, hits: 6, gap: 70, cast: 900, share: 0.55 },
      { move: 'phoenix', windup: 120, first: 240, hits: 7, gap: 70, cast: 1000, share: 0.45 }],
    // นักพรต: blink to the 3 corners of a triangle planting talismans, rise over its heart and seal /
    // levitate in place while a giant spirit avatar rises over the spot, 8 bagua gates light up, its palm slams down
    taoist: [{ move: 'array', windup: 120, first: 200, hits: 3, gap: 180, cast: 920, share: 0.5 },
      { move: 'mandala', windup: 150, first: 300, hits: 8, gap: 70, cast: 1050, share: 0.45 }],
    // ทวน: charge in, pole-vault high over the spot spinning, crash the spear down / run a rising dragon spiral round
    // the spot with 4 thrusts, then hurl the spear down from the top like a javelin
    spearman: [{ move: 'vault', windup: 140, first: 330, hits: 3, gap: 140, cast: 800, share: 0.45 },
      { move: 'spiral', windup: 140, first: 300, hits: 4, gap: 130, cast: 980, share: 0.45 }],
  };
  const MOVE_TEXT = {
    star: 'พุ่งเข้าจุดเป้าหมายแล้วลากเส้นดาวห้าแฉกผ่านกลางวง ฟัน 5 ครั้ง แล้วกระโดดลงกลางดาวระเบิดปิดท้าย',
    ascend: 'ทะยานขึ้นฟ้าเหนือจุดเป้าหมาย เงาร่าง 8 ร่างพุ่งเข้าใส่จากรอบวงทีละร่าง แล้วดิ่งลงกลางวงดั่งดาวตก',
    volley: 'ตีลังกากระโดดถอยขึ้นกลางอากาศ ยิงศร 6 ระลอกลงเป็นกลุ่มดาว แล้วกลุ่มดาวระเบิดปิดท้าย',
    phoenix: 'วิ่งโค้งรอบวงศัตรูพร้อมยิงศร 7 ดอก แล้วกระโดดสูงยิงศรหงส์เพลิงดิ่งลงกลางวง',
    array: 'วาร์ปไปปักยันต์ 3 มุมเป็นสามเหลี่ยมรอบวง แล้วลอยขึ้นกลางค่ายกลผนึกกดลง',
    mandala: 'ลอยตัวร่ายมณฑล ร่างเทพยักษ์ปรากฏเหนือวง ประตูปากัว 8 บานสว่างทีละบาน แล้วฝ่ามือเทพตบลง',
    vault: 'วิ่งพุ่งชาร์จเข้าหา ค้ำทวนกระโดดข้ามสูงพร้อมหมุนตัว แล้วกระแทกทวนลงกลางวงแผ่นดินแยก',
    spiral: 'วิ่งวนเป็นเกลียวมังกรรอบเป้า แทง 4 ครั้ง แล้วพุ่งทวนจากที่สูงลงกลางวงดั่งหอกเทพ',
  };
  for(const [cls,arts]of Object.entries(ASCENDED_ARTS))arts.forEach(([id,name,damage,radius,range],i)=>{
    const mv=ASCENDED_MOVES[cls][i];
    CLASSES[cls].skills.push({id,name,key:i?'-':'0',lvl:i?130:120,mp:i?180:120,cd:i?70000:45000,evo:[],
      ritual:{...mv,damage,radius,range,recovery:650},
      desc:`${MOVE_TEXT[mv.move]} รวม ${damage*100}% รัศมี ${radius} · ไม่ต้องยืนร่าย (ท่าทั้งหมด ${(mv.cast/1000).toFixed(2)} วินาที) · ถูกควบคุม/ตาย/ย้ายแผนที่ระหว่างท่าจะหยุดทันที`});
  });
  // skill cooldowns ×SKILL_CD_MUL (rounded to 0.5 s); not the ascended arts. The basic attack (key 1) starts
  // BASIC_CD_MUL slower: attack speed now comes mostly from stat points (STAT_POINTS.aspd), not from the class.
  const SKILL_CD_MUL = 1.3, BASIC_CD_MUL = 1.5;
  for (const c of Object.values(CLASSES)) for (const s of c.skills) {
    if (s.key === '1') s.cd = Math.round((s.cd * BASIC_CD_MUL) / 10) * 10;
    else if (!s.ritual && !['0', '-'].includes(s.key)) s.cd = Math.round((s.cd * SKILL_CD_MUL) / 500) * 500;
  }
  const CLASS_IDS = Object.keys(CLASSES);          // snapshot index of a class
  // Fractions, not percentages. Both factions use the same combat rules.
  const CLASS_ROLES = {
    warrior: { evasion: 0.02, evasionG: 0.01, accuracy: 0.04, resistance: 0.15, aspd: 0, attackMove: 0.6, critPower: 1.5, manaRegen: 0.022 },
    spearman: { evasion: 0.01, evasionG: 0.01, accuracy: 0.04, resistance: 0, aspd: 0, attackMove: 0.55, critPower: 1.5, manaRegen: 0.022 },
    dualblade: { evasion: 0.12, evasionG: 0.08, accuracy: 0.03, resistance: 0, aspd: 0.12, attackMove: 0.8, critPower: 1.75, manaRegen: 0.02 },
    archer: { evasion: 0.04, evasionG: 0.04, accuracy: 0.12, resistance: 0, aspd: 0, attackMove: 0.9, critPower: 1.6, manaRegen: 0.02 },
    taoist: { evasion: 0.02, evasionG: 0.02, accuracy: 0.05, resistance: 0.3, aspd: 0, attackMove: 0.65, critPower: 1.6, manaRegen: 0.025 },
  };
  const roleOf = (cls) => CLASS_ROLES[cls] || CLASS_ROLES.dualblade;
  // Expiry times use the caller's clock (server Date.now / client performance.now).
  function combatMoveScale(cls, attacking, control = {}, now = 0) {
    if (now < (control.stunUntil || 0) || now < (control.rootUntil || 0)) return 0;
    return (attacking ? roleOf(cls).attackMove : 1) * (now < (control.slowUntil || 0) ? 0.65 : 1);
  }
  CLASSES.dualblade.desc = 'สายประชิด ทุกสกิลฟันระยะใกล้ คอมโบเร็ว ตีหมู่รอบตัวได้ คริติคอลแรง หลบหลีกสูง แต่ HP และเกราะต่ำ';
  CLASSES.archer.desc = 'ยิงไกลต่อเนื่อง บัพคริติคอลและตีไวให้ตัวเอง ยิงหมู่ได้บางสกิล เคลื่อนที่ขณะยิงได้ 90% แต่ HP และเกราะต่ำที่สุด';
  CLASSES.taoist.desc = 'เวทระยะไกล ฮีลหมู่ บัพเกราะและพลังโจมตีให้ปาร์ตี้ ลดระยะเวลาสถานะควบคุม 30% แต่โจมตีเบากว่าสายดาเมจ';
  for (const c of Object.values(CLASSES)) c.reach = c.reach || 92;
  // every skill of every class by id (ids are unique across classes)
  const ALL_SKILLS = {};
  for (const c of Object.values(CLASSES)) for (const s of c.skills) { s.cls = c.id; ALL_SKILLS[s.id] = s; }
  const SKILL_ROLE_NOTES = {
    mercy: 'ฮีลสมาชิกปาร์ตี้แรงกว่าฮีลตนเอง 20% และล้างสถานะช้า/ตรึงในครั้งแรก',
    aegis: 'ลดความเสียหาย 25–30% ตามแต้มสกิล; ขั้นวิวัฒนาการ 35–40% · เกราะที่อ่อนกว่าไม่ทับเกราะที่แรงกว่า',
    might: 'แต้มสกิลหลังแต้มแรกเพิ่มอีก 0.5% ต่อแต้ม (สูงสุด +5%)',
    hawkeye: 'แต้มสกิลหลังแต้มแรกเพิ่มคริติคอลอีก 0.5% ต่อแต้ม (สูงสุด +5%) · คริติคอลรวมไม่เกิน 85%',
    gale: 'ความเร็วโจมตีมีผลกับการโจมตีปกติ (ปุ่ม 1) · แต้มสกิลหลังแต้มแรกเพิ่มอีก 1% ต่อแต้ม',
    rend: 'เกราะแตกไม่ซ้อนกัน ใช้ค่าที่แรงที่สุด',
  };
  // timed buffs a skill leaves on the caster / party (HUD buff row; values are applied on the server)
  const BUFF_SKILLS = ['aegis', 'might', 'hawkeye', 'gale', 'rollshot', 'nirvana', 'ironGuard', 'rallyGuard', 'lastBastion', 'guardianOath'];
  // skills that move the caster: a root blocks them (server and client)
  const MOVE_SKILLS = ['shadowstep', 'skyfall', 'twindragon', 'rollshot'];
  // where ดาวตกเพลิงฟ้า's meteors land round the aim (golden-angle ring), shared so every client draws the real spots
  const meteorPoints = (x, y, n) => Array.from({ length: n }, (_, i) => {
    const a = i * 2.39996, r = i ? 40 + (i % 3) * 30 : 0;
    return [Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r * 0.7)];
  });
  // ศรระเบิดอัคนี: one blast on the aim, or (ศรอัคนีสามดารา) three in a triangle round it facing the shot
  const blastPoints = (x, y, a, rank) => (rank
    ? [0, 1, 2].map((i) => [Math.round(x + Math.cos(a + i * 2.0944) * 85), Math.round(y + Math.sin(a + i * 2.0944) * 60)])
    : [[x, y]]);
  for (const [id, note] of Object.entries(SKILL_ROLE_NOTES)) {
    ALL_SKILLS[id].desc += ` · ${note}`;
    for (const evo of ALL_SKILLS[id].evo || []) evo.desc += ` · ${note}`;
  }
  const MAX_LVL = 130;
  // shared cooldown between skills 1-8 (the basic attack is not affected), on top of each skill's own cooldown
  const GCD_MS = 700;
  // ---------------- EXP rate (Yulgang style: the first levels go fast, the high ones are a long grind) ----------------
  // EXP to the next level = the old curve × EXP_CURVE, which rises with the level and steps up at the Lv.60 and
  // Lv.100 milestones. Solo at the own level (~6 s a kill): Lv.10 ≈ 0.3 h · Lv.30 ≈ 3 h · Lv.50 ≈ 13 h ·
  // Lv.70 ≈ 37 h · Lv.100 ≈ 120 h · Lv.130 ≈ 300 h in all (a party or the bot is much faster). Monster EXP,
  // drops and gold per kill are unchanged; only the bar to fill grows.
  const EXP_CURVE = (lvl) => (1.3 + 0.42 * Math.pow(lvl / 10, 1.55)) * (lvl >= 60 ? 1.12 : 1) * (lvl >= 100 ? 1.1 : 1);
  const expToNext = (lvl) => Math.floor(60 * Math.pow(lvl, 1.65) * EXP_CURVE(lvl));
  // EXP_RATE = server rate like Yulgang's "Exp x1"; on top of it monster EXP shrinks as the monster level rises
  const EXP_RATE = 1;
  const monsterExpMul = (lvl) => EXP_RATE / (1 + lvl / 8);
  // EXP from monsters × this by the PLAYER's level: the first levels go fast, the top ones slow down
  // (×3 up to Lv.10 → ×1 at Lv.50 · ×1 to Lv.80 → ×0.7 at Lv.129). Solo at the own level (~6 s a kill):
  // Lv.10 ≈ 0.1 h · Lv.30 ≈ 1.4 h · Lv.50 ≈ 9 h · Lv.70 ≈ 33 h · Lv.100 ≈ 117 h · Lv.130 ≈ 295 h in all.
  // [from level, to level, multiplier at "from", multiplier at "to"]
  const EXP_LEVEL = { early: [10, 50, 3, 1], late: [80, 129, 1, 0.7] };
  const ramp = (l, [a, b, x, y]) => (l <= a ? x : l >= b ? y : x + ((y - x) * (l - a)) / (b - a));
  const levelExpMul = (lvl) => ramp(lvl, lvl < EXP_LEVEL.late[0] ? EXP_LEVEL.early : EXP_LEVEL.late);
  // monsters far below the player give little EXP; monsters ABOVE the player give more, per level above
  // (EXP_ABOVE.per each, capped at EXP_ABOVE.cap). Base monster EXP only rises ~1-2% a level while a higher monster
  // takes far longer to kill (LVL_GAP), so without this a +10 monster paid ~0.6× the EXP per second of an even one.
  // With it: +3 ≈ +30% EXP/kill, +5 ≈ +50%, +10 ≈ ×2 — roughly +10-20% EXP per second for the extra risk.
  // Regular kills only (shareExp); boss EXP is split by damage share separately. Also drives the world-map colours.
  const EXP_ABOVE = { per: 0.1, cap: 1 };
  const expPenalty = (plvl, mlvl) => {
    const d = plvl - mlvl;
    if (d < 0) return 1 + Math.min(EXP_ABOVE.cap, EXP_ABOVE.per * -d);
    return d > 10 ? 0.05 : d > 6 ? 0.2 : d > 3 ? 0.6 : 1;
  };
  // party: up to 8 players of either faction; the kill EXP is pooled (+25% per extra member in range) and split by level
  // (Yulgang style: every member gets less per kill, but the party kills much faster, so grouping levels faster)
  const PARTY_MAX = 8;
  // party EXP bonus: +25% as soon as two play together, then +2% for every further member (3 → 27% … 8 → 37%)
  const PARTY_BONUS = 0.25, PARTY_BONUS_STEP = 0.02;
  const PARTY_LVL_GAP = 10;          // a player joins only within ±10 levels of every member
  const partyExpBonus = (n) => { n = Math.min(PARTY_MAX, n); return n < 2 ? 0 : PARTY_BONUS + PARTY_BONUS_STEP * (n - 2); };
  // members nearby from a shown bonus % (the party EXP chip)
  const partyCountOf = (pct) => (pct < PARTY_BONUS * 100 ? 1 : 2 + Math.round((pct - PARTY_BONUS * 100) / (PARTY_BONUS_STEP * 100)));
  const PARTY_RANGE = 1400;
  const PARTY_INVITE_MS = 30000;           // how long an invite waits for the accept / decline popup
  // party rules set by the leader (แบบ Ragnarok): how EXP and loot of a kill are shared by the members near it
  const PARTY_EXP_MODES = {
    share: { name: 'แบ่งเท่ากัน', desc: 'รวม EXP + โบนัสปาร์ตี้ แล้วแบ่งตามสัดส่วนเลเวลให้สมาชิกที่อยู่ใกล้' },
    each: { name: 'ต่างคนต่างได้', desc: 'ได้ตามดาเมจที่ตีมอนตัวนั้น ไม่มีโบนัสปาร์ตี้' },
  };
  const PARTY_ITEM_MODES = {
    party: { name: 'แบ่งในปาร์ตี้', desc: 'ไอเทมสุ่มให้สมาชิกที่อยู่ใกล้ 1 คน · ทองหารเท่ากัน' },
    each: { name: 'ต่างคนต่างเก็บ', desc: 'ทองและไอเทมเป็นของคนที่ปราบ' },
  };
  const PARTY_DEFAULT = { exp: 'share', item: 'party' };
  // ---------------- field PvP (ปุ่มเปิดสถานะ PvP) and evil points (แต้มชั่วร้าย) ----------------
  // On the hunting maps a player who switches PvP on may attack the other faction outside the camps (both Lv.minLvl+,
  // never a party mate). The one attacked may hit back for defendMs without PvP on. Killing a player outside the PvP
  // battlefield costs evilPerKill evil points (red name, value after the name), unless it was self-defence or the
  // victim was already evil. Evil points go back up by evilStep every evilEveryMs (real time, offline too) to 0.
  // PvP cannot be switched off within combatMs of the last player fight.
  // ---------------- level gap and minimum damage (monsters) ----------------
  // a monster above the player (after `grace` levels): the player deals `dealt` less per level (down to minDealt)
  // and takes `taken` more per level (up to maxTaken), so out-levelling a map with gear alone stops paying
  const LVL_GAP = { grace: 2, dealt: 0.04, minDealt: 0.35, taken: 0.05, maxTaken: 2.2 };
  const levelGapMul = (plvl, mlvl) => {
    const g = Math.max(0, mlvl - plvl - LVL_GAP.grace);
    return { dealt: Math.max(LVL_GAP.minDealt, 1 - LVL_GAP.dealt * g), taken: Math.min(LVL_GAP.maxTaken, 1 + LVL_GAP.taken * g) };
  };
  // every blow deals at least this share of its raw damage (ATK × power): armour can never make anyone immune
  const DMG_FLOOR = 0.15;
  // ทวน: single-target spear skills hit this much harder against monsters only (never PvP) — boss-killer identity
  const SPEAR_PVE_MULT = 1.25;
  // นักพรต: self-heal passive on mercy/nirvana — the caster's own share of the heal, same spot allies get 1.2
  const TAOIST_SELF_HEAL_MULT = 1.15;
  // นักพรต farming alone (no party member within PARTY_RANGE): hits monsters harder and takes less from them.
  // Monsters only — never PvP — and it switches off the moment a party member is near (the healer role stays).
  const TAOIST_SOLO = { dealt: 1.4, taken: 0.85 };
  // นักพรต passive from น้ำทิพย์ชโลมชีวา (skill 3, once learned): every `everyMs` the caster and party members within
  // `range` heal a share of their own max HP: `min` at skill level 1 up to `max` at SKILL_MAX, +`evo` once evolved.
  // A player on the PvP map or with field PvP on gets `pvp` of it. Several นักพรต do not stack on one player.
  const TAOIST_MERCY_AURA = { everyMs: 5000, min: 0.02, max: 0.06, evo: 0.01, pvp: 0.5, range: 480 };
  // นักรบแนวหน้า farming alone (no party member within PARTY_RANGE): hits monsters harder. Monsters only, never PvP.
  const WARRIOR_SOLO = { dealt: 1.2 };
  // นักรบแนวหน้า passive โล่หนาม from ตั้งโล่เหล็ก (skill 3, once learned): a blow taken sends `base` of its damage back
  // to the attacker, `guard` while ตั้งโล่เหล็ก is up; `pvp` of that against players; at most `capAtk` × the warrior's
  // ATK per blow. DoTs and reflected damage are never reflected; the reflection skips dodge, crits and damage bonuses.
  const WARRIOR_THORNS = { base: 0.08, guard: 0.25, pvp: 0.5, capAtk: 2 };
  // ทวน: heavy spear skills (wind-up >= minWindup) take `reduce` less damage while the spear is locked in its strike;
  // it ends early when a stun / root breaks the strike. Adds into the player's damage reduction (capped 70%).
  const SPEAR_WINDUP_GUARD = { minWindup: 400, reduce: 0.15 };
  const PK = { minLvl: 20, defendMs: 30000, combatMs: 10000, evilPerKill: 10, evilStep: 10, evilEveryMs: 3600000 };
  // ---------------- skill stages: something new every 10 levels ----------------
  // rank = how many evolutions of the skill the level has reached; each rank hits 30% harder
  const skillRank = (sk, lvl) => (sk.evo || []).filter((e) => lvl >= e.lvl).length;
  const skillMult = (sk, lvl) => 1 + 0.3 * skillRank(sk, lvl);
  // current name / description of a skill at a level
  const skillInfo = (sk, lvl) => { const r = skillRank(sk, lvl); const e = r ? sk.evo[r - 1] : null; return { name: e ? e.name : sk.name, desc: e ? e.desc : sk.desc, rank: r }; };
  // martial stage 0..13 (Lv.10 = 1 ... Lv.130 = 13): drives the stance aura and how grand every effect is
  const stageOf = (lvl) => Math.max(0, Math.min(13, Math.floor((lvl || 1) / 10)));
  // the Lv.10..130 milestones of a class: a new skill or an evolution (Lv.130 evolves two)
  const stagesOf = (cls) => {
    const out = [];
    for (const sk of (CLASSES[cls] || CLASSES.dualblade).skills) {
      if (sk.lvl >= 10) out.push({ lvl: sk.lvl, id: sk.id, kind: 'new', name: sk.name, desc: sk.desc, key: sk.key });
      for (const e of sk.evo || []) out.push({ lvl: e.lvl, id: sk.id, kind: 'evo', name: e.name, desc: e.desc, from: sk.name, key: sk.key });
    }
    return out.sort((a, b) => a.lvl - b.lvl);
  };
  const SKILL_STAGES = stagesOf('dualblade');
  // stance (ท่าประจำขั้น) shown around the character, one per stage
  const STANCES = ['', 'ลมปราณก่อตัว', 'วงปราณใต้เท้า', 'ลมปราณเข้มข้น', 'ลมปราณไหลเวียน', 'ปราณกายาบริสุทธิ์', 'วงเวทใต้ร่าง',
    'ปราณวิญญาณ', 'ปราณเพลิงใต้เท้า', 'วงเวทซ้อนสองชั้น', 'ปราณทะลุฟ้า', 'ปราณเทพไหลเวียน', 'ปราณเทพสว่าง', 'ร่างเทพยุทธ์'];
  function statsFor(cls, lvl) {
    const c = CLASSES[cls];
    const l = lvl - 1;
    return {
      maxHp: Math.round(c.hp + c.hpG * l),
      maxMp: Math.round(c.mp + c.mpG * l),
      atk: Math.round(c.atk + c.atkG * l),
      def: Math.round(c.def + c.defG * l),
      speed: c.speed,
      crit: c.crit,
      evasion: roleOf(cls).evasion + roleOf(cls).evasionG * Math.max(0, Math.min(1, (lvl - 1) / 129)),
      accuracy: roleOf(cls).accuracy,
      resistance: roleOf(cls).resistance,
      aspd: roleOf(cls).aspd,
    };
  }
  // ---------------- skill points (แต้มสกิล): the player learns, stacks and evolves the class's skills ----------------
  // 1 point per character level (Lv.1 = the basic attack). A skill is learned once the character reaches sk.lvl, then
  // stacks to SKILL_MAX (+SKILL_STEP power per level); how far it can stack follows the character level (skillCap).
  // Evolutions (sk.evo) are unlocked by hand: character level >= evo.lvl, skill level >= EVO_NEED[i], EVO_COST points.
  const SKILL_MAX = 12;
  const SKILL_STEP = 0.05;
  const SKILL_LVL_GAP = 4;                 // one more skill level every 4 character levels after the unlock level
  const EVO_NEED = [5, 10];
  const EVO_COST = 2;
  const BAR_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-'];
  // skill paths: the tree is split by the level a skill unlocks at
  const SKILL_PATHS = [
    { name: 'วิชาขั้นต้น', from: 1, to: 9 },
    { name: 'วิชาขั้นกลาง', from: 10, to: 49 },
    { name: 'วิชาขั้นสูง', from: 50, to: 69 },
    { name: 'วิชาปรมาจารย์', from: 70, to: MAX_LVL },
  ];
  const skillPtsTotal = (lvl) => Math.max(1, lvl);
  const skillCap = (sk, lvl) => (lvl < sk.lvl ? 0 : Math.min(SKILL_MAX, 1 + Math.floor((lvl - sk.lvl) / SKILL_LVL_GAP)));
  const basicOf = (cls) => (CLASSES[cls] || CLASSES.dualblade).skills.find((s) => s.key === '1');
  const skillPtsUsed = (d) => Object.values((d && d.sk) || {}).reduce((t, n) => t + n, 0) +
    Object.values((d && d.ev) || {}).reduce((t, n) => t + n * EVO_COST, 0);
  const skillPtsFree = (d, lvl) => skillPtsTotal(lvl) - skillPtsUsed(d);
  // can evolution i of a skill be unlocked now? (returns '' or the reason it cannot)
  function evoBlock(sk, d, lvl, i) {
    const e = sk.evo && sk.evo[i];
    if (!e) return 'ไม่มีขั้นถัดไป';
    if (((d.ev && d.ev[sk.id]) || 0) !== i) return i < ((d.ev && d.ev[sk.id]) || 0) ? 'อัพขั้นนี้แล้ว' : 'ต้องอัพขั้นก่อนหน้าก่อน';
    if (lvl < e.lvl) return `ต้องการเลเวลตัวละคร ${e.lvl}`;
    if (((d.sk && d.sk[sk.id]) || 0) < EVO_NEED[i]) return `ต้องการสเต็กสกิล ${EVO_NEED[i]}`;
    if (skillPtsFree(d, lvl) < EVO_COST) return `ต้องใช้ ${EVO_COST} แต้ม`;
    return '';
  }
  // spend free points the way the old automatic system worked: learn everything, evolve when allowed, then stack evenly
  function autoSkills(cls, d, lvl) {
    const list = (CLASSES[cls] || CLASSES.dualblade).skills;
    const free = () => skillPtsFree(d, lvl);
    for (const sk of list) if (free() > 0 && !d.sk[sk.id] && skillCap(sk, lvl) > 0) d.sk[sk.id] = 1;
    for (const sk of list) {
      for (let i = (d.ev[sk.id] || 0); sk.evo && i < sk.evo.length && lvl >= sk.evo[i].lvl; i++) {
        while (d.sk[sk.id] < EVO_NEED[i] && d.sk[sk.id] < skillCap(sk, lvl) && free() > EVO_COST) d.sk[sk.id]++;
        if (evoBlock(sk, d, lvl, i)) break;
        d.ev[sk.id] = i + 1;
      }
    }
    for (let more = true; more && free() > 0;) {
      more = false;
      for (const sk of list) if (free() > 0 && d.sk[sk.id] && d.sk[sk.id] < skillCap(sk, lvl)) { d.sk[sk.id]++; more = true; }
    }
    return d;
  }
  // SKILL_VER goes up when the skill sets are redesigned: older saves get every point back (auto-allocated) and the
  // default bar, since their skill ids no longer exist
  const SKILL_VER = 2;
  // a saved skill state cleaned up for the class / level; saves from before skill points are auto-allocated
  function cleanSkills(cls, saved, lvl) {
    const list = (CLASSES[cls] || CLASSES.dualblade).skills, basic = basicOf(cls);
    const d = { v: SKILL_VER, sk: {}, ev: {}, bar: [], auto: !!(saved && saved.auto) };
    if (saved && saved.v !== SKILL_VER) saved = { auto: saved.auto };
    const old = !saved || !saved.sk;
    for (const sk of list) {
      const n = Math.max(0, Math.min(skillCap(sk, lvl), Math.floor(Number(saved && saved.sk && saved.sk[sk.id]) || 0)));
      if (n) d.sk[sk.id] = n;
      let e = Math.max(0, Math.min((sk.evo || []).length, Math.floor(Number(saved && saved.ev && saved.ev[sk.id]) || 0)));
      while (e > 0 && (lvl < sk.evo[e - 1].lvl || n < EVO_NEED[e - 1])) e--;
      if (e) d.ev[sk.id] = e;
    }
    if (!d.sk[basic.id]) d.sk[basic.id] = 1;
    if (skillPtsFree(d, lvl) < 0) { d.sk = { [basic.id]: 1 }; d.ev = {}; }
    if (old) autoSkills(cls, d, lvl);
    // skill bar: keys 1-9 hold any skill of the class (or nothing); default = each skill on its own key
    const ids = new Set(list.map((s) => s.id)), used = new Set();
    const bar = saved && Array.isArray(saved.bar) ? saved.bar : list.map((s) => s.id);
    for (let i = 0; i < BAR_KEYS.length; i++) {
      const id = i>=9 && i>=bar.length ? list.find(s=>s.key===BAR_KEYS[i])?.id : bar[i];
      d.bar[i] = ids.has(id) && !used.has(id) ? id : null;
      if (d.bar[i]) used.add(id);
    }
    return d;
  }
  // evolutions unlocked and power multiplier of a skill for a skill state
  const skillRankOf = (d, id) => (d && d.ev && d.ev[id]) || 0;
  const skillPower = (sl, rank) => (1 + SKILL_STEP * Math.max(0, (sl || 1) - 1)) * (1 + 0.3 * (rank || 0));
  const skillInfoAt = (sk, rank) => { const e = rank ? sk.evo[rank - 1] : null; return { name: e ? e.name : sk.name, desc: e ? e.desc : sk.desc, rank }; };

  // ---------------- stat points (แต้มสถานะ): STAT_PTS per level after Lv.1, the player picks where they go ----------------
  //   per   bonus per point    max  most points one stat can take (attack speed / crit are capped)
  const STAT_PTS = 3;
  const STAT_POINTS = {
    atk: { th: 'พลังโจมตี', per: 1.5, fmt: (v) => `+${v < 10 ? +v.toFixed(1) : Math.round(v)}` },   // +1.5 per point, totals rounded
    def: { th: 'ป้องกัน', per: 1, fmt: (v) => `+${Math.round(v)}` },
    hp: { th: 'พลังชีวิต', per: 14, fmt: (v) => `+${Math.round(v)}` },
    mp: { th: 'ปราณ', per: 7, fmt: (v) => `+${Math.round(v)}` },
    aspd: { th: 'ตีเร็ว', per: 0.015, max: 80, fmt: (v) => `+${+(v * 100).toFixed(1)}%` },
    crit: { th: 'คริติคอล', per: 0.004, max: 75, fmt: (v) => `+${(v * 100).toFixed(1)}%` },
  };
  const PT_KEYS = Object.keys(STAT_POINTS);
  const statPtsTotal = (lvl) => Math.max(0, (lvl - 1) * STAT_PTS);
  // ---- build guide per class (stat panel radar + "แจกตามแนวทาง" + auto mode 'guide'):
  //   share  target part of all the level's points per stat (a capped stat stops at its max, the rest flows on)
  //   tip    why, shown in the stat panel
  const STAT_GUIDE_KEY = 'guide';
  const STAT_GUIDES = {
    warrior: { share: { atk: 0.25, hp: 0.35, def: 0.2, mp: 0.1, aspd: 0.1 },
      tip: 'แนวหน้าดาบและโล่: เน้น HP และป้องกัน เสริมโจมตี/ปราณเพื่อยืนคุ้มกันทีม ไม่ใช่สายดาเมจหรือฮีล' },
    dualblade: { share: { atk: 0.4, aspd: 0.2, crit: 0.2, hp: 0.15, def: 0.05 },
      tip: 'สายฟันรัวคริติคอล: พลังโจมตีเป็นหลัก ตีเร็วและคริติคอลให้ถึงเพดาน (ตัวคูณคริติคอลสูงสุด ×1.75) เสริมพลังชีวิตเพราะต้องเข้าประชิดทั้งที่เลือดและเกราะต่ำ' },
    archer: { share: { atk: 0.4, crit: 0.2, aspd: 0.2, hp: 0.15, mp: 0.05 },
      tip: 'สายยิงต่อเนื่อง: พลังโจมตี คริติคอล (ศรเจาะหัวใจ + เนตรเหยี่ยว) และตีเร็ว (ซ้อนกับลมกรดเร่งศร) เสริมพลังชีวิตเพราะเลือดน้อยที่สุด' },
    taoist: { share: { atk: 0.35, hp: 0.25, mp: 0.2, def: 0.15, aspd: 0.05 },
      tip: 'สายฮีล/ซัพพอร์ต: ฮีลและเวทแรงตามพลังโจมตี ปราณสำคัญเพราะสกิลใช้ปราณมาก เสริมพลังชีวิตและป้องกันเพื่อยืนฮีลปาร์ตี้ได้นาน' },
    spearman: { share: { atk: 0.45, hp: 0.2, aspd: 0.15, def: 0.1, mp: 0.1 },
      tip: 'สายทวนคอมโบ: เน้นพลังโจมตีสำหรับจังหวะปิดท่าและล่าบอส มีท่ากวาดหมู่บางสกิล เสริมชีวิต/ป้องกันเพราะเกราะต่ำ และปราณสำหรับคอมโบ' },
  };
  const statGuide = (cls) => STAT_GUIDES[cls] || STAT_GUIDES.dualblade;
  // total crit chance is capped (playerStats); points past it do nothing
  const CRIT_CAP = 0.75;
  // the most points worth putting in a stat with this gear: { crit: n } (crit stops where gear + class + points
  // reach CRIT_CAP). The build guide never spends past it; the server sends it to the stat panel (statState.lim).
  function statLimits(cls, lvl, eq, alloc) {
    const s = playerStats(cls, lvl, eq, { ...alloc, crit: 0 });
    const room = Math.ceil(Math.round(((CRIT_CAP - s.crit) / STAT_POINTS.crit.per) * 1000) / 1000);
    return { crit: Math.max(0, Math.min(STAT_POINTS.crit.max, room)) };
  }
  const statCap = (k, lim) => Math.min(STAT_POINTS[k].max || Infinity, lim && lim[k] !== undefined ? lim[k] : Infinity);
  // up to n of the free points spread toward the guide: { atk: 3, crit: 1, ... } (only what can be spent).
  // lim = statLimits(): a stat that is already full with this gear passes its share on to the others
  function guidePoints(cls, alloc, lvl, n, lim) {
    const sh = statGuide(cls).share, tot = statPtsTotal(lvl), a = { ...alloc }, add = {};
    let left = Math.min(n, statPtsFree(alloc, lvl));
    while (left > 0) {
      let best = null, gap = -Infinity;
      for (const k of PT_KEYS) {
        if (!sh[k] || (a[k] || 0) >= statCap(k, lim)) continue;
        const g = sh[k] * tot - (a[k] || 0);
        if (g > gap) { gap = g; best = k; }
      }
      if (!best) break;                 // every guided stat is at its cap
      a[best] = (a[best] || 0) + 1; add[best] = (add[best] || 0) + 1; left--;
    }
    return add;
  }
  // the guide's points per stat for the whole level (caps and gear limits respected, the rest passed on)
  const guideTarget = (cls, lvl, lim) => {
    const add = guidePoints(cls, {}, lvl, Infinity, lim);
    return Object.fromEntries(PT_KEYS.map((k) => [k, add[k] || 0]));
  };
  // a saved allocation cleaned up: whole numbers, per-stat caps, never more than the level allows (else everything is refunded)
  function cleanAlloc(a, lvl) {
    const out = {};
    let used = 0;
    for (const k of PT_KEYS) {
      const n = Math.max(0, Math.min(STAT_POINTS[k].max || Infinity, Math.floor(Number(a && a[k]) || 0)));
      out[k] = n; used += n;
    }
    if (used > statPtsTotal(lvl)) for (const k of PT_KEYS) out[k] = 0;
    return out;
  }
  const statPtsFree = (a, lvl) => statPtsTotal(lvl) - PT_KEYS.reduce((t, k) => t + ((a && a[k]) || 0), 0);
  // the basic attack's cooldown after attack speed (ตีเร็ว)
  const basicCd = (sk, aspd) => Math.round(sk.cd / (1 + (aspd || 0)));
  // MP cost of a skill at a character level: the listed sk.mp, or sk.mp × MP_COST_PCT of the class's own MP at that
  // level (at most MP_COST_CAP) when that is more, so skills stay costly as MP and its regen grow with the level.
  // MP from gear / stat points is not counted, so it still makes the pool last longer. The basic attack stays free.
  const MP_COST_PCT = 0.0035, MP_COST_CAP = 0.45;
  const skillMp = (sk, lvl) => {
    if (!sk || !sk.mp) return 0;
    const c = CLASSES[sk.cls] || CLASSES.dualblade, base = c.mp + c.mpG * (Math.max(1, lvl || 1) - 1);
    return Math.max(sk.mp, Math.round(base * Math.min(MP_COST_CAP, sk.mp * MP_COST_PCT)));
  };
  // consumables: bag items (1 slot each, no stacking), bought at the ร้านขายยา corner of the blacksmith.
  // kind 'hp'/'mp' heal that % of the max stat instantly; kind 'warp' sends the user back to their own base
  // (refused in combat / inside the PvP map — no escaping a fight with a scroll).
  const CONSUMABLES = [
    { id: 'potHpS', name: 'ยาฟื้นพลัง (เล็ก)', desc: 'ฟื้นพลังชีวิตทันที 20% ของพลังชีวิตสูงสุด', price: 80, kind: 'hp', pct: 0.2 },
    { id: 'potHpM', name: 'ยาฟื้นพลัง (กลาง)', desc: 'ฟื้นพลังชีวิตทันที 35% ของพลังชีวิตสูงสุด', price: 220, kind: 'hp', pct: 0.35 },
    { id: 'potHpL', name: 'ยาฟื้นพลัง (ใหญ่)', desc: 'ฟื้นพลังชีวิตทันที 55% ของพลังชีวิตสูงสุด', price: 500, kind: 'hp', pct: 0.55 },
    { id: 'potMpS', name: 'ยามานา (เล็ก)', desc: 'ฟื้นปราณทันที 20% ของปราณสูงสุด', price: 80, kind: 'mp', pct: 0.2 },
    { id: 'potMpM', name: 'ยามานา (กลาง)', desc: 'ฟื้นปราณทันที 35% ของปราณสูงสุด', price: 220, kind: 'mp', pct: 0.35 },
    { id: 'potMpL', name: 'ยามานา (ใหญ่)', desc: 'ฟื้นปราณทันที 55% ของปราณสูงสุด', price: 500, kind: 'mp', pct: 0.55 },
    { id: 'scrollTown', name: 'ใบวาร์ปกลับเมือง', desc: 'วาร์ปกลับฐานของฝ่ายตัวเองทันที (ใช้ไม่ได้ขณะต่อสู้หรืออยู่ในสนามรบ)', price: 50, kind: 'warp' },
  ];
  // ดีเลย์ระหว่างใช้ขวดยา (แยกคูลดาวน์ hp/mp — ยาฟื้นพลังไม่กันยามานาและกลับกัน) กันสแปมกดรัว ไม่ใช้กับใบวาร์ป
  const ITEM_USE_CD = 3000;

  // ---------------- items ----------------
  const BAG_SIZE = 60;           // 6 columns × 10 rows (the bag scrolls)
  const STORAGE_SIZE = 120;      // คลังเก็บของ of each character (at the blacksmith / teleport stone of any camp)
  // Item grades. Every item level comes in all six; the grade belongs to the dropped copy, not the item type.
  //   mult    multiplier on the item's own stats      affix  [min, max] random bonus stats, aff = their strength
  //   opt     strength of the special option (Unique+) passive  strength of the passive skill (Legendary+)
  //   weight  drop chance of a normal monster (Unique+ scaled by HIGH_BANDS; bosses use BOSS_GRADES)
  //   price   buy/sell value multiplier
  const GRADES = [
    { name: 'Normal', th: 'ธรรมดา', color: '#c8c8c8', mult: 1, affix: [0, 0], aff: 0, weight: 62, price: 1,
      desc: 'ไอเทมพื้นฐาน ไม่มีออฟชั่นพิเศษ' },
    { name: 'Rare', th: 'หายาก', color: '#4aa8ff', mult: 1.06, affix: [1, 2], aff: 0.7, weight: 28, price: 1.6,
      desc: 'มีค่าสถานะเสริม 1-2 อย่าง' },
    { name: 'Epic', th: 'มหากาพย์', color: '#b67bff', mult: 1.18, affix: [2, 3], aff: 0.78, weight: 7, price: 2.6,
      desc: 'ค่าสถานะสูงกว่าสีฟ้า ตีบวกได้คุ้มค่า' },
    { name: 'Unique', th: 'ยูนีค', color: '#ffd23a', mult: 1.32, affix: [2, 3], aff: 0.85, opt: 1, weight: 2.2, price: 4,
      desc: 'ไอเทมมีชื่อเฉพาะ พร้อมออฟชั่นพิเศษเฉพาะตัว' },
    { name: 'Legendary', th: 'ตำนาน', color: '#ff7a1a', mult: 1.5, affix: [3, 3], aff: 0.92, opt: 1.25, passive: 1, proc: 0.3, weight: 0.65, price: 7,
      desc: 'ไอเทมในตำนาน มีสกิลติดตัว (Passive) ที่เปลี่ยนรูปแบบการเล่น' },
    { name: 'Mythic', th: 'มิธิค', color: '#ff2a55', mult: 1.75, affix: [4, 4], aff: 1, opt: 1.5, passive: 1.5, proc: 0.45, weight: 0.15, price: 12,
      desc: 'ระดับสูงสุดของเกม ค่าสถานะสูงสุด และออร่ารอบตัว' },
  ];
  const RARITY = GRADES; // older name, still used for colours
  // Item labels keep GRADES colours. Unique+ body light follows faction tones.
  // a = strength of the glow (aura around the piece + sheen on the cloth)
  const GRADE_LIGHT = {
    dharma: [null, '#77caff', '#bd99ff', '#effaff', '#79efb8', '#74cfff'],
    adharma: [null, '#65b5ef', '#bb83ed', '#ff91c7', '#b77cff', '#ff4f66'],
    a: [0, 0.45, 0.6, 0.75, 0.9, 1],
  };
  const gradeLight = (faction, grade) => GRADE_LIGHT[faction === 'adharma' ? 'adharma' : 'dharma'][grade || 0];
  const EPIC = 2;
  // Epic and above only drop from monsters 0..9 levels above the item (Lv.80-89 monsters → Lv.80 items).
  const DROP_LVL_RANGE = 9;
  // the top items (Lv.100) also roll Epic+ from every monster above them (Lv.100-130 maps)
  const TOP_ITEM_LVL = 100;
  // (bosses are not limited: their one guaranteed item is always Unique or better, see BOSS_GRADES)
  const canDropHigh = (monLvl, itemLvl) => monLvl >= itemLvl && (monLvl - itemLvl <= DROP_LVL_RANGE || itemLvl >= TOP_ITEM_LVL);
  // Unique / Legendary / Mythic weight by the monster's level [from level, multiplier]: generous in the early game,
  // a little stingier in the end game. Normal / Rare / Epic keep their weight.
  const HIGH_BANDS = [[70, 0.75], [61, 1], [10, 2.5], [1, 1]];
  const highMul = (monLvl) => (HIGH_BANDS.find(([from]) => monLvl >= from) || [0, 1])[1];
  const UNIQUE = 3;
  // bosses: every kill drops one item (World.rollLoot, pickOne) and it is always Unique or better
  const BOSS_GRADES = [0, 0, 0, 70, 24, 6];
  const gradeWeight = (i, monLvl, boss) => (boss ? BOSS_GRADES[i] : GRADES[i].weight * (i >= UNIQUE ? highMul(monLvl) : 1));
  // highest grade the drop can roll: bosses any item; monsters Epic+ only on items near their level (C.canDropHigh)
  const topGrade = (monLvl, itemLvl, boss) => (boss || canDropHigh(monLvl, itemLvl) ? GRADES.length - 1 : EPIC - 1);
  // chance of each grade for one drop (the same weights rollGrade uses)
  function gradeChances(monLvl, itemLvl, boss) {
    const top = topGrade(monLvl, itemLvl, boss);
    const w = GRADES.map((g, i) => (i <= top ? gradeWeight(i, monLvl, boss) : 0)), sum = w.reduce((a, b) => a + b, 0);
    return w.map((v) => v / sum);
  }
  // HIGH_BANDS as rows for the drop guide and the README table: { from, to (null = and above), mul, chances }
  const gradeBands = () => [...HIGH_BANDS].sort((a, b) => a[0] - b[0]).map(([from, mul], i, s) =>
    ({ from, to: s[i + 1] ? s[i + 1][0] - 1 : null, mul, chances: gradeChances(from, Math.min(from, TOP_ITEM_LVL), false) }));
  function rollGrade(monLvl, itemLvl, boss, rand = Math.random) {
    const top = topGrade(monLvl, itemLvl, boss);
    const w = GRADES.slice(0, top + 1).map((g, i) => gradeWeight(i, monLvl, boss));
    let r = rand() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return i; }
    return 0;
  }
  const pctTxt = (v) => `${Math.round(v * 1000) / 10}%`;
  // random bonus stats; base value at item level L (rolled 60-100%, times the grade's aff)
  const AFFIXES = {
    atk: { th: 'พลังโจมตี', v: (L) => 2 + L * 0.5 },
    def: { th: 'ป้องกัน', v: (L) => 1 + L * 0.3 },
    hp: { th: 'พลังชีวิต', v: (L) => 12 + L * 4 },
    mp: { th: 'ปราณ', v: (L) => 6 + L * 1.6 },
    crit: { th: 'คริติคอล', v: (L) => 0.008 + L * 0.0002, pct: true },
    speed: { th: 'ความเร็ว', v: (L) => 4 + L * 0.06 },
  };
  // Unique+ special option; `title` names the item ("ดาบคู่มังกรทอง «ทะลวงเกราะ»"). cap = limit when stacked.
  // One item rolls v × grade opt × 75-100%. The seed picks the option by its place in this list: pierce took the slot
  // of the old life steal (removed), so every saved life-steal item became an armour-piercing one.
  const OPTIONS = {
    pierce: { title: 'ทะลวงเกราะ', v: 0.06, cap: 0.25, desc: (v) => `เจาะเกราะ: ไม่สนป้องกันของเป้าหมาย ${pctTxt(v)}` },
    mana: { title: 'ธารปราณ', v: 0.002, cap: 0.006, desc: (v) => `โจมตีโดนฟื้นปราณ ${pctTxt(v)} ของปราณสูงสุด` },
    critDmg: { title: 'คมพิฆาต', v: 0.15, cap: 0.6, desc: (v) => `ความแรงคริติคอล +${pctTxt(v)}` },
    pve: { title: 'ปราบอสูร', v: 0.08, cap: 0.3, desc: (v) => `ความเสียหายต่อมอนสเตอร์ +${pctTxt(v)}` },
    pvp: { title: 'สังหารศัตรู', v: 0.05, cap: 0.2, desc: (v) => `ความเสียหายต่อผู้เล่นฝ่ายตรงข้าม +${pctTxt(v)}` },
    guard: { title: 'กายาเหล็ก', v: 0.04, cap: 0.15, desc: (v) => `ลดความเสียหายที่ได้รับ ${pctTxt(v)}` },
    exp: { title: 'ปัญญาญาณ', v: 0.1, cap: 0.5, desc: (v) => `EXP จากมอนสเตอร์ +${pctTxt(v)}` },
    gold: { title: 'โชคลาภ', v: 0.15, cap: 0.75, desc: (v) => `ทองจากมอนสเตอร์ +${pctTxt(v)}` },
  };
  // Legendary+ passive skill. They fire at random, not every time: each passive works with the proc chance of the
  // best grade that carries it (GRADES[].proc: Legendary 30% · Mythic 45%, gearProcs), except อสนีพิโรธ whose
  // value already is its chance. REAPER_CD_MS: วิญญาณยมทูต heals at most once per that time (a multi-kill heals once).
  const REAPER_CD_MS = 3000;
  const PASSIVES = {
    thunder: { name: 'อสนีพิโรธ', v: 0.12, cap: 0.35, own: true, desc: (v) => `โจมตีโดนมีโอกาส ${pctTxt(v)} เรียกสายฟ้าฟาดซ้ำ 120% ของพลังโจมตี` },
    reaper: { name: 'วิญญาณยมทูต', v: 0.015, cap: 0.05, desc: (v) => `สังหารศัตรูฟื้นพลังชีวิต ${pctTxt(v)} ของพลังชีวิตสูงสุด (ไม่เกิน 1 ครั้งต่อ ${REAPER_CD_MS / 1000} วินาที)` },
    swift: { name: 'วายุเร่งรุด', v: 0.08, cap: 0.2, desc: (v) => `ใช้สกิลแล้วคูลดาวน์สกิลนั้นลดลง ${pctTxt(v)}` },
    bulwark: { name: 'ปราการสุดท้าย', v: 0.3, cap: 0.6, desc: (v) => `พลังชีวิตต่ำกว่า 35% โดนโจมตีแล้วลดความเสียหาย ${pctTxt(v)}` },
  };
  // chance text for a passive carried by an item of this grade ("โอกาสทำงาน 45%"), '' for อสนีพิโรธ
  const passiveChance = (k, grade) => (PASSIVES[k] && !PASSIVES[k].own && GRADES[grade] && GRADES[grade].proc ? GRADES[grade].proc : 0);
  // Twin-blade weapons from item.png (tier = index). `look` drives how the blades are drawn:
  //   tint  multiply colour for the blade pixels (null = original steel)
  //   glow  additive halo colour around the blades, glowA its strength
  //   aura  0 none | 1 sparks | 2 lightning | 3 spirit spiral | 4 dragon flames
  //   fx    [light, mid, deep] colours for slash effects (null = faction colours)
  const W = (id, name, lvl, atk, crit, price, desc, d, a, glowA, aura) =>
    ({ id, slot: 'weapon', name, lvl, atk, crit, price, desc, look: { dharma: d, adharma: a, glowA, aura } });
  const WEAPONS = [
    W('w0', 'ดาบคู่ฝึกหัด', 1, 0, 0, 20, 'ดาบคู่เหล็กธรรมดาสำหรับศิษย์ฝึกหัด',
      { tint: null, glow: null, fx: null }, { tint: null, glow: null, fx: null }, 0, 0),
    W('w1', 'ดาบคู่เหล็กกล้า', 10, 10, 0, 300, 'ดาบเหล็กกล้าตีขึ้นรูปอย่างดี คมกริบและทนทาน',
      { tint: '#eef3fa', glow: null, fx: null }, { tint: '#f4eaea', glow: null, fx: null }, 0, 0),
    W('w2', 'ดาบคู่จันทร์เสี้ยว', 20, 22, 0.01, 900, 'ใบดาบโค้งดั่งจันทร์เสี้ยว ฟันได้ลื่นไหล',
      { tint: '#dfeaff', glow: '#9fd0ff', fx: null }, { tint: '#ffe2e2', glow: '#ff9a9a', fx: null }, 0.25, 0),
    W('w3', 'ดาบคู่วายุคราม', 30, 36, 0.02, 2200, 'ร่องดาบสลักลายวายุ เร่งจังหวะการฟัน',
      { tint: '#8ab8ff', glow: '#4a8cff', fx: ['#ffffff', '#7fb8ff', '#2a6ae0'] },
      { tint: '#ff9a9a', glow: '#ff4a4a', fx: ['#ffe6e6', '#ff6a6a', '#9a1020'] }, 0.35, 0),
    W('w4', 'ดาบคู่ประกายฟ้า', 40, 52, 0.03, 5000, 'ใบดาบเรืองแสงดั่งท้องฟ้ายามรุ่งอรุณ',
      { tint: '#62b8ff', glow: '#3aa8ff', fx: ['#e8fbff', '#5ac8ff', '#1a70e0'] },
      { tint: '#ff7060', glow: '#ff3a3a', fx: ['#fff0e8', '#ff5040', '#8a0a10'] }, 0.5, 1),
    W('w5', 'ดาบคู่หยกทองคำ', 50, 70, 0.04, 10000, 'ฝังหยกวิเศษบนกระบังทองคำ เสริมพลังลมปราณ',
      { tint: '#ffd56a', glow: '#ffcf5a', fx: ['#fff6d0', '#ffd34a', '#3a7aff'] },
      { tint: '#ffd56a', glow: '#ffb040', fx: ['#fff6d0', '#ffc040', '#c3262c'] }, 0.5, 1),
    W('w6', 'ดาบคู่อสนีบาต', 60, 90, 0.05, 18000, 'กักเก็บพลังสายฟ้าไว้ในใบดาบ ทุกการฟันมีประกายอสนี',
      { tint: '#4a7cf0', glow: '#5ac8ff', fx: ['#ffffff', '#6ad8ff', '#1a3ab0'] },
      { tint: '#c8303e', glow: '#ff4a5a', fx: ['#ffffff', '#ff5a6a', '#6a0010'] }, 0.7, 2),
    W('w7', 'ดาบคู่มังกรทอง', 70, 112, 0.06, 30000, 'กระบังดาบรูปมังกรทอง ผู้ถือได้รับพลังแห่งราชันย์',
      { tint: '#f2c452', glow: '#ffd860', fx: ['#fff0b0', '#ffc93a', '#2a5ad0'] },
      { tint: '#f2c452', glow: '#ff9a3a', fx: ['#fff0b0', '#ffb030', '#a01018'] }, 0.65, 1),
    W('w8', 'ดาบคู่วิญญาณธารา', 80, 136, 0.07, 48000, 'วิญญาณแห่งสายน้ำวนรอบใบดาบ ปกป้องผู้ถือ',
      { tint: '#d2e8ff', glow: '#7ac8ff', fx: ['#ffffff', '#8fdcff', '#3a6aff'] },
      { tint: '#ffd8d8', glow: '#ff6a6a', fx: ['#ffffff', '#ff8a8a', '#a0102a'] }, 0.8, 3),
    W('w9', 'ดาบคู่ราชันย์อัคนีวิญญาณ', 90, 162, 0.08, 75000, 'อัญมณีแห่งราชันย์ ปลดปล่อยไฟวิญญาณ',
      { tint: '#f2c462', glow: '#4a9aff', fx: ['#eaf6ff', '#7ab8ff', '#1a4ad0'] },
      { tint: '#f2c462', glow: '#ff3a8a', fx: ['#ffe6f0', '#ff4a9a', '#7a0030'] }, 0.85, 3),
    W('w10', 'ดาบคู่เทพมังกรสวรรค์', 100, 190, 0.1, 120000, 'อาวุธในตำนาน วิญญาณมังกรสวรรค์สถิตอยู่ในใบดาบ',
      { tint: '#ffe08a', glow: '#2a7aff', fx: ['#ffffff', '#8ac8ff', '#0a3ee0'] },
      { tint: '#ffe08a', glow: '#ff2a5a', fx: ['#ffffff', '#ff6a8a', '#8a0020'] }, 1, 4),
  ];
  for(const [i,lvl]of [120,130].entries()){
    const light={tint:i?'#fff4c6':'#b2f4ff',glow:i?'#f5d37c':'#72dfe8',fx:['#fff9db',i?'#f5d37c':'#72dfe8','#4561a8']};
    const dark={tint:i?'#39142d':'#57346d',glow:i?'#ff365b':'#b973ed',fx:['#ffe0c0',i?'#ff365b':'#b973ed','#230e27']};
    WEAPONS.push(W('w'+(11+i),'ดาบคู่'+(i?'ปฐมเทพสามภพ':'จักรพรรดิเก้าสวรรค์'),lvl,i?280:235,i?.13:.115,i?280000:190000,
      i?'คมปฐมเทพสลักตราสามภพ สง่างามดั่งราชันเทพเซียนและเทพมาร':'คมจักรพรรดิประดับผลึกและอักขระเก้าสวรรค์',light,dark,1,i?6:5));
  }
  // Equipment slots. Armour slots may be empty; the weapon slot falls back to the training blades.
  WEAPONS.push(W('w13', 'ดาบคู่สุริยันจันทรา', 110, 212, 0.108, 155000,
    'คมดาบสุริยันจันทรา แกนผลึกทรงข้าวหลามตัดและกระบังวงโคจรคู่',
    { tint: '#d9fff1', glow: '#55e6b4', fx: ['#f0fff7', '#55e6b4', '#286e85'] },
    { tint: '#f5c5df', glow: '#ef79b5', fx: ['#fff0f6', '#ef79b5', '#60274e'] }, 0.9, 4));
  const SLOTS = ['weapon', 'body', 'legs', 'arms', 'shoulder'];
  const SLOT_NAMES = { weapon: 'อาวุธ', body: 'เสื้อ', legs: 'กางเกง', arms: 'ปลอกแขน', shoulder: 'หัวไหล่' };
  const ARMOR_SLOTS = ['body', 'legs', 'arms', 'shoulder'];
  // Stable set tiers/IDs for saved items; level order is separate from artwork order.
  //   look.<faction>: cloth colour on the character: ธรรมะ stays white-blue, อธรรม black-red (higher sets whiter / blacker)
  const ARMOR_SETS = [
    { name: 'ผ้าป่าน', lvl: 10, price: 120, desc: 'ผ้าป่านทอมือ เบาสบาย เหมาะกับผู้เริ่มฝึกยุทธ์',
      look: { dharma: { color: '#a9bdd6' }, adharma: { color: '#4a3a40' } } },
    { name: 'หนังพยัคฆ์', lvl: 20, price: 700, desc: 'หนังเสือฟอกอย่างดี ทนทานต่อคมเขี้ยว',
      look: { dharma: { color: '#6f98c8' }, adharma: { color: '#7a2a2e' } } },
    { name: 'เกล็ดเหล็กนิล', lvl: 30, price: 2500, desc: 'เกล็ดเหล็กเรียงซ้อน ปัดป้องคมดาบได้ดี',
      look: { dharma: { color: '#3a7ad8' }, adharma: { color: '#2e2428' } } },
    { name: 'ไหมวายุ', lvl: 40, price: 6500, desc: 'ไหมวิเศษทอด้วยลมปราณ ทำให้ร่างกายเบาดุจขนนก',
      look: { dharma: { color: '#5ab4ec' }, adharma: { color: '#b0202c' } } },
    { name: 'หยกมรกต', lvl: 60, price: 14000, desc: 'ประดับหยกมรกตปลุกเสก เรืองแสงอ่อนยามต่อสู้',
      look: { dharma: { color: '#2a5ac8', glow: '#8ad0ff' }, adharma: { color: '#1e1418', glow: '#ff4a5a' } } },
    { name: 'มังกรทอง', lvl: 80, price: 32000, desc: 'ลายมังกรทองปักด้วยดิ้นทองคำ ผู้สวมใส่ดั่งราชันย์',
      look: { dharma: { color: '#dce8fa', glow: '#bfe6ff' }, adharma: { color: '#c01a24', glow: '#ff5a4a' } } },
    { name: 'เทพสวรรค์', lvl: 100, price: 70000, desc: 'อาภรณ์ทิพย์จากสรวงสวรรค์ แสงทิพย์ไหลเวียนไม่ขาดสาย',
      look: { dharma: { color: '#f6faff', glow: '#cfeaff' }, adharma: { color: '#140c10', glow: '#ff2a3a' } } },
  ];
  ARMOR_SETS.push(
    {name:'จักรพรรดิเก้าสวรรค์',lvl:120,price:140000,desc:'เกราะจักรพรรดิประดับผลึกและอักขระเทพเซียน / เทพมาร',look:{dharma:{color:'#bde9ed',glow:'#a7f4ff'},adharma:{color:'#392245',glow:'#c185f4'}}},
    {name:'ปฐมเทพสามภพ',lvl:130,price:230000,desc:'อาภรณ์ปฐมเทพลายทองซ้อนชั้น ประดับอัญมณีแห่งสามภพ',look:{dharma:{color:'#fff0ce',glow:'#ffe6a6'},adharma:{color:'#250f22',glow:'#ff3e62'}}}
  );
  // per-slot stat curves, index = tier - 1
  const ARMOR_STATS = {
    body: { prefix: 'เสื้อ', id: 'sh', price: 1, def: [4, 10, 20, 34, 50, 72, 100], hp: [30, 80, 160, 280, 420, 620, 900] },
    legs: { prefix: 'กางเกง', id: 'pa', price: 0.85, def: [2, 6, 12, 20, 30, 44, 60], hp: [15, 40, 80, 140, 210, 310, 450],
      speed: [0, 4, 8, 12, 16, 22, 30] },
    arms: { prefix: 'ปลอกแขน', id: 'br', price: 0.9, def: [1, 3, 6, 10, 15, 22, 30], atk: [3, 8, 16, 28, 42, 60, 85],
      crit: [0, 0.01, 0.01, 0.02, 0.03, 0.04, 0.05] },
    shoulder: { prefix: 'เกราะไหล่', id: 'sd', price: 0.8, def: [2, 5, 10, 17, 26, 38, 52], hp: [10, 25, 50, 90, 140, 200, 280],
      mp: [10, 25, 45, 70, 100, 140, 190] },
  };
  const ARMORS = [];
  const ASCENDED_STATS={body:{def:[132,170],hp:[1200,1550]},legs:{def:[80,104],hp:[600,780],speed:[34,38]},
    arms:{def:[40,52],atk:[112,145],crit:[.06,.07]},shoulder:{def:[70,90],hp:[380,500],mp:[250,330]}};
  for(const [slot,values]of Object.entries(ASCENDED_STATS))for(const [stat,extra]of Object.entries(values))ARMOR_STATS[slot][stat].push(...extra);
  // Fill each ten-level step without renumbering sh1..9 / pa1..9 / br1..9 / sd1..9.
  // Intermediate sets reuse the lower set's art and interpolate its base stats/price.
  for (const [lvl, name, lower, upper] of [
    [50, 'ไหมหยกวายุ', 4, 5], [70, 'หยกมังกร', 5, 6],
    [90, 'มังกรสวรรค์', 6, 7], [110, 'เทพจักรพรรดิ', 7, 8],
  ]) {
    const lo = ARMOR_SETS[lower - 1], hi = ARMOR_SETS[upper - 1];
    const mix = (a, b) => a + (b - a) * (lvl - lo.lvl) / (hi.lvl - lo.lvl);
    ARMOR_SETS.push({ name, lvl, price: Math.round(mix(lo.price, hi.price)),
      desc: `อาภรณ์${name}สำหรับผู้ฝึกยุทธ์ระดับ ${lvl}`, look: lo.look, lookTier: lower });
    for (const S of Object.values(ARMOR_STATS)) for (const [stat, values] of Object.entries(S)) {
      if (Array.isArray(values)) {
        const value = mix(values[lower - 1], values[upper - 1]);
        values.push(stat === 'crit' ? Math.round(value * 1000) / 1000 : Math.round(value));
      }
    }
  }
  const armorLookTier = (tier) => ARMOR_SETS[tier - 1]?.lookTier || tier;
  ARMOR_SETS[9].look = { dharma: { color: '#39b8a0', glow: '#a3ffe0' }, adharma: { color: '#86365e', glow: '#f8a5d2' } };
  for (const slot of ARMOR_SLOTS) {
    const S = ARMOR_STATS[slot];
    ARMOR_SETS.forEach((set, i) => {
      const lookTier = armorLookTier(i + 1);
      const prefix = slot === 'body' && lookTier >= 3 && lookTier !== 4 ? 'เสื้อเกราะ' : S.prefix; // silk stays a shirt
      ARMORS.push({
        id: S.id + (i + 1), slot, tier: i + 1, name: prefix + set.name, lvl: set.lvl,
        price: Math.round(set.price * S.price / 10) * 10, desc: set.desc, look: set.look,
        def: S.def[i], hp: S.hp ? S.hp[i] : 0, speed: S.speed ? S.speed[i] : 0,
        atk: S.atk ? S.atk[i] : 0, crit: S.crit ? S.crit[i] : 0, mp: S.mp ? S.mp[i] : 0,
      });
    });
  }
  ARMORS.sort((a, b) => a.lvl - b.lvl);
  const STAT_KEYS = ['atk', 'crit', 'def', 'hp', 'mp', 'speed'];
  const coreStats = (it) => { const o = {}; for (const k of STAT_KEYS) o[k] = it[k] || 0; return o; };
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const BASE_ITEMS = {};
  WEAPONS.forEach((w, i) => { w.tier = i; BASE_ITEMS[w.id] = w; });
  // Saved/art tiers stay stable; progression, shops and loot use ascending levels.
  const WEAPON_BY_TIER = Object.fromEntries(WEAPONS.map(w => [w.tier, w]));
  WEAPONS.sort((a, b) => a.lvl - b.lvl);
  for (const a of ARMORS) BASE_ITEMS[a.id] = a;
  for (const c of CONSUMABLES) { c.lvl = 1; BASE_ITEMS[c.id] = c; }
  // base items are the Normal grade; `core` = the item's own stats, without affixes
  for (const it of Object.values(BASE_ITEMS)) Object.assign(it, { grade: 0, rarity: 0, core: coreStats(it), affixes: [] });

  // ---------------- item keys ----------------
  // "<base>[#<grade>.<seed>][+<plus>]": "w7" (Normal), "sh5#4.1203" (Legendary), "w9#5.88+10" (Mythic +10).
  // The seed fixes the rolled affixes/option/passive, so the key alone describes the item.
  const MAX_PLUS = 10;
  // ~<aSeed> and ^<pSeed> are optional: a reroll stone (หินสุ่มออฟชั่น / หินสุ่มสกิลติดตัว) re-seeds just the
  // affixes (green font) or just the passive/option, independently of the item's own seed — see gradedItem.
  const KEY_RE = /^([a-z]+\d+)(?:#(\d)\.(\d{1,6})(?:~(\d{1,6}))?(?:\^(\d{1,6}))?)?(?:\+(\d{1,2}))?$/;
  const parseId = (s) => {
    const m = typeof s === 'string' && KEY_RE.exec(s);
    return m ? { id: m[1], grade: +(m[2] || 0), seed: +(m[3] || 0), aSeed: +(m[4] || 0), pSeed: +(m[5] || 0), plus: Math.min(MAX_PLUS, +(m[6] || 0)) }
      : { id: s, grade: 0, seed: 0, aSeed: 0, pSeed: 0, plus: 0 };
  };
  const makeKey = (id, grade, seed, plus, aSeed = 0, pSeed = 0) =>
    id + (grade > 0 ? `#${grade}.${seed}${aSeed ? `~${aSeed}` : ''}${pSeed ? `^${pSeed}` : ''}` : '') + (plus > 0 ? `+${plus}` : '');
  const newSeed = () => 1 + Math.floor(Math.random() * 999998);
  // a fresh copy of base item `id` in `grade` (random seed unless given)
  const gradeId = (id, grade, seed) => makeKey(parseId(id).id, grade, grade > 0 ? seed || newSeed() : 0, 0);

  // the original roll: one seed drives affixes (green font), option and passive together in sequence.
  // Unchanged on purpose — every item ever saved decodes through this exact formula from its seed alone.
  function rawGradedItem(b, grade, seed) {
    const G = GRADES[grade], L = Math.max(1, b.lvl);
    const rand = mulberry32((seed * 2654435761) ^ (b.id.charCodeAt(0) * 977 + (b.tier || 0) * 131 + grade));
    const pick = (keys) => keys[Math.floor(rand() * keys.length)];
    const it = { ...b, id: makeKey(b.id, grade, seed, 0), base: b.id, grade, rarity: grade, seed };
    for (const k of STAT_KEYS) if (b[k]) it[k] = k === 'crit' ? r3(b[k] * G.mult) : Math.round(b[k] * G.mult);
    it.core = coreStats(it);
    const pool = [...STAT_KEYS];
    const n = G.affix[0] + Math.floor(rand() * (G.affix[1] - G.affix[0] + 1));
    it.affixes = [];
    for (let i = 0; i < n; i++) {
      const k = pool.splice(Math.floor(rand() * pool.length), 1)[0], A = AFFIXES[k];
      const raw = A.v(L) * G.aff * (0.6 + 0.4 * rand());
      const v = A.pct ? r3(raw) : Math.max(1, Math.round(raw));
      it[k] = A.pct ? r3((it[k] || 0) + v) : (it[k] || 0) + v;
      it.affixes.push([k, v]);
    }
    if (G.opt) {
      const k = pick(Object.keys(OPTIONS));
      it.option = [k, r3(OPTIONS[k].v * G.opt * (0.75 + 0.25 * rand()))];
      it.name = `${b.name} «${OPTIONS[k].title}»`;
    }
    if (G.passive) {
      const k = pick(Object.keys(PASSIVES));
      it.passive = [k, r3(PASSIVES[k].v * G.passive * (0.85 + 0.15 * rand()))];
    }
    it.price = Math.round(b.price * G.price);
    return it;
  }
  // หินสุ่มออฟชั่น (green-font affixes) / หินสุ่มสกิลติดตัว (passive): aSeed/pSeed pull just that part from a
  // separately-rolled donor item of the same base+grade, while everything else (base stats, the other part)
  // stays exactly as the main seed rolled it. The base-mult stat values are deterministic from (b, grade) alone
  // (no randomness there), so swapping a donor's affix-touched stat fields in wholesale is exact, not an approximation.
  function gradedItem(b, grade, seed, aSeed, pSeed) {
    const main = rawGradedItem(b, grade, seed);
    if (!aSeed && !pSeed) return main;
    const it = { ...main, aSeed: aSeed || 0, pSeed: pSeed || 0 };
    if (aSeed) {
      const donor = rawGradedItem(b, grade, aSeed);
      for (const k of STAT_KEYS) if (b[k]) it[k] = donor[k];
      it.core = coreStats(it);
      it.affixes = donor.affixes;
    }
    if (pSeed) {
      const donor = rawGradedItem(b, grade, pSeed);
      it.option = donor.option; it.passive = donor.passive;
      it.name = donor.option ? donor.name : main.name;
    }
    it.id = makeKey(b.id, grade, seed, 0, aSeed || 0, pSeed || 0);
    return it;
  }
  // blacksmith buy price for a graded piece (Normal..Unique only — Legendary/Mythic stay drop-only):
  // scaled to the item's own level AND how many average monster kills at that level it represents (lootFor's
  // regular-monster gold range in shared/world-data.js averages to ~3.5 + 1.15×L per kill), so the cost tracks
  // the level's own gold economy instead of a flat number that goes stale as levels rise.
  const SHOP_BUY_GRADE_MAX = 3;                    // Unique (index 3); higher grades are never sold here
  const SHOP_GRADE_KILLS = [60, 220, 900, 3500];   // Normal · Rare · Epic · Unique: kills-worth of price
  const shopGearPrice = (base, grade) => Math.round((3.5 + 1.15 * Math.max(1, base.lvl)) * SHOP_GRADE_KILLS[grade || 0]);

  // ---------------- enhancement (+1..+10): weapons and the 4 armour pieces ----------------
  // An enhanced item is stored as "<key>+<n>" (e.g. "w5+3", "sh5#3.120+3"); ITEMS[key] resolves to the boosted item.
  // Every attempt uses enhancement stones (หินตีบวก, bought / sold at the blacksmith) and a small smith's fee.
  const ENH_STONE = { name: 'หินตีบวก', price: 120, sell: 60, max: 9999,
    desc: 'หินสำหรับตีบวกอาวุธและชุดสวมใส่ (+1 ถึง +10) ที่ร้านช่างตีดาบ · ขั้นยิ่งสูงยิ่งใช้หินมาก' };
  const ENHANCE = {
    // chance to reach +n (index n-1): high at first, lower with every + level
    rate: [0.95, 0.9, 0.8, 0.7, 0.6, 0.45, 0.35, 0.25, 0.08, 0.03],   // +9 / +10 are the hard ones
    // a failed attempt destroys the item from this + level up (index; 0 = every attempt, every grade incl. Mythic)
    breakFrom: 0,
    // +1..+6 only (no guard talisman): a failed attempt rolls between two outcomes —
    //   softBreakChance of the time it breaks outright; the rest of the time it's a "soft" fail,
    //   which then splits 50/50 (softDemoteChance) between keeping the level and dropping it by one
    //   (dropping from +1 would reach +0, so that case breaks it instead). Soft-fail is kept more likely
    // than an outright break (softBreakChance < 0.5).
    softPlusMin: 1, softPlusMax: 6, softBreakChance: 0.3, softDemoteChance: 0.5,
    // stones per attempt for +n (index n-1), times the item level factor below
    stones: [1, 1, 1, 2, 2, 3, 3, 4, 5, 6],
    atkPct: [0, 0.03, 0.06, 0.1, 0.15, 0.21, 0.28, 0.36, 0.46, 0.58, 0.72],
    // armour: share of its own defence / hp / mp / attack gained per + level
    armPct: [0, 0.04, 0.08, 0.13, 0.19, 0.26, 0.34, 0.43, 0.54, 0.67, 0.82],
    // gold fee to go from +plus to +plus+1
    cost: (base, plus) => Math.round(((base.price || 20) * 0.04 + 20) * Math.pow(plus + 1, 1.4) / 10) * 10,
  };
  // ---- damage against monsters (playerStats.pveMult, not used in PvP): it comes from enhancing the whole outfit
  // and from wearing a full set, not from the item level (monsters already scale with the level).
  //   each piece's + level counts pvePlus[plus] / pvePlus[10] (0..1), weighted by SLOT_PVE (weapon half, each armour
  //   piece an eighth); the whole outfit at +10 = ×(1 + PVE_PLUS_MAX). A full set (all 5 slots) adds SET_BONUS[g],
  //   g = its lowest grade (Rare +3% ... Mythic +20%).
  ENHANCE.pvePlus = [0, 0.03, 0.06, 0.1, 0.14, 0.19, 0.25, 0.32, 0.4, 0.5, 0.62];
  const PVE_PLUS_MAX = 1.5;
  const SLOT_PVE = { weapon: 0.5, body: 0.125, legs: 0.125, arms: 0.125, shoulder: 0.125 };
  const SET_BONUS = [0, 0.03, 0.06, 0.1, 0.15, 0.2];
  // the extra damage to monsters one enhanced piece gives (0.0..0.75 for a weapon, 0..0.1875 for an armour piece)
  ENHANCE.pveShare = (it) => (it && SLOT_PVE[it.slot] ? PVE_PLUS_MAX * SLOT_PVE[it.slot]
    * ENHANCE.pvePlus[Math.min(MAX_PLUS, it.plus || 0)] / ENHANCE.pvePlus[MAX_PLUS] : 0);
  // { mult, plus (the enhancement part), set (bonus share), setGrade (-1 = no full set) } of everything worn
  function gearPve(eq) {
    let plus = 1, full = true, low = Infinity;
    for (const slot of SLOTS) {
      const it = eq && ITEMS[eq[slot]];
      if (!it || it.slot !== slot) { full = false; continue; }
      plus += ENHANCE.pveShare(it);
      low = Math.min(low, it.grade || 0);
    }
    const set = full ? SET_BONUS[low] : 0;
    return { mult: plus * (1 + set), plus, set, setGrade: full ? low : -1 };
  }
  // basic stones: more for higher items; mid / high stones (expensive) only follow the + level (1..6)
  ENHANCE.stoneCount = (base, plus) => ENHANCE.stones[Math.min(plus, MAX_PLUS - 1)] * (matTier(base.lvl || 1) ? 1 : 1 + Math.floor((base.lvl || 1) / 20));
  // ยันต์ (talismans) for one enhancement attempt each, bought at the blacksmith and ticked in the enhance tab.
  // Both are used up on the attempt whatever the result. Deliberately expensive gold sinks.
  //   guard  a failed attempt keeps the item at its level instead of destroying it
  //   luck   adds `bonus` to the success chance (absolute, capped at 100%)
  // Enhancement materials come in three tiers by the ITEM's level (MAT_TIERS): basic below Lv.60, mid for Lv.60-99,
  // high for Lv.100+. An item takes only its own tier. The basic stone is ENH_STONE (p.stones); every other material
  // (the charms and the mid / high stones) lives in p.charms under its key (cleanCharms keeps them all).
  //   kind  stone | guard (a failed try keeps the item) | luck (+bonus success chance)     tier  0 basic · 1 mid · 2 high
  const MAT_TIERS = [{ th: 'ขั้นต้น', from: 0 }, { th: 'ขั้นกลาง', from: 60 }, { th: 'ขั้นสูง', from: 100 }];
  const matTier = (itemLvl) => (itemLvl >= MAT_TIERS[2].from ? 2 : itemLvl >= MAT_TIERS[1].from ? 1 : 0);
  const tierRange = (t) => (t === 2 ? `อุปกรณ์ Lv.${MAT_TIERS[2].from} ขึ้นไป` : t === 1 ? `อุปกรณ์ Lv.${MAT_TIERS[1].from}–${MAT_TIERS[2].from - 1}` : `อุปกรณ์ต่ำกว่า Lv.${MAT_TIERS[1].from}`);
  const guardDesc = (t) => `ใช้ตอนตีบวก${tierRange(t)}: ถ้าล้มเหลว ไอเทมไม่แตก ระดับคงเดิม · ใช้ 1 ใบต่อการตีบวก 1 ครั้ง (หมดไปแม้สำเร็จ)`;
  const luckDesc = (t) => `ใช้ตอนตีบวก${tierRange(t)}: โอกาสสำเร็จ +10% (ตีไป +9 เพิ่ม +4% · ตีไป +10 เพิ่ม +2%) · ใช้ 1 ใบต่อการตีบวก 1 ครั้ง`;
  const stoneDesc = (t) => `หินสำหรับตีบวก${tierRange(t)} (+1 ถึง +10) ที่ร้านช่างตีดาบ · ใช้ 1–6 ก้อนต่อครั้งตามขั้นที่ตี`;
  // หินสุ่มออฟชั่น / หินสุ่มสกิลติดตัว: reroll the green-font affixes, or the ✦ passive skill, of a Rare+/Legendary+
  // item — everything else on the item (base stats, grade, the other random part) stays exactly as it was.
  // Priced by the ITEM's own level bracket (ไม่ใช่เลเวลผู้เล่น): Lv.1-60 100,000 · Lv.70-90 300,000 · Lv.100-130 1,000,000
  // (shares the same 0/60/100 tier split as every other enhancement material — close enough to the 70-90 band asked for)
  const reaffixDesc = (t) => `สุ่มคุณสมบัติออฟชั่น (ตัวหนังสือสีเขียว) ใหม่ของอุปกรณ์${tierRange(t)} · ค่าสถานะหลัก เกรด และสกิลติดตัวเดิมไม่เปลี่ยน · ใช้ 1 ก้อนต่อครั้ง มีผลเฉพาะไอเทม Rare ขึ้นไป`;
  const repassiveDesc = (t) => `สุ่มสกิลติดตัว (✦) และออฟชั่นพิเศษ (◆) ใหม่ของอุปกรณ์${tierRange(t)} · ค่าสถานะหลัก เกรด และออฟชั่นสีเขียวเดิมไม่เปลี่ยน · ใช้ 1 ก้อนต่อครั้ง มีผลเฉพาะไอเทม Legendary ขึ้นไป`;
  const ENH_CHARMS = {
    guard: { name: 'ยันต์กันแตก', kind: 'guard', tier: 0, price: 150000, sell: 37500, max: 999, desc: guardDesc(0) },
    luck: { name: 'ยันต์เพิ่มโอกาส', kind: 'luck', tier: 0, price: 30000, sell: 7500, max: 999, desc: luckDesc(0) },
    stone2: { name: 'หินตีบวกขั้นกลาง', kind: 'stone', tier: 1, price: 10000, sell: 2500, max: 9999, desc: stoneDesc(1) },
    guard2: { name: 'ยันต์กันแตกขั้นกลาง', kind: 'guard', tier: 1, price: 750000, sell: 187500, max: 999, desc: guardDesc(1) },
    luck2: { name: 'ยันต์เพิ่มโอกาสขั้นกลาง', kind: 'luck', tier: 1, price: 150000, sell: 37500, max: 999, desc: luckDesc(1) },
    stone3: { name: 'หินตีบวกขั้นสูง', kind: 'stone', tier: 2, price: 100000, sell: 25000, max: 9999, desc: stoneDesc(2) },
    guard3: { name: 'ยันต์กันแตกขั้นสูง', kind: 'guard', tier: 2, price: 7500000, sell: 1875000, max: 999, desc: guardDesc(2) },
    luck3: { name: 'ยันต์เพิ่มโอกาสขั้นสูง', kind: 'luck', tier: 2, price: 1500000, sell: 375000, max: 999, desc: luckDesc(2) },
    reaffix: { name: 'หินสุ่มออฟชั่น', kind: 'reaffix', tier: 0, price: 100000, sell: 25000, max: 999, desc: reaffixDesc(0) },
    reaffix2: { name: 'หินสุ่มออฟชั่นขั้นกลาง', kind: 'reaffix', tier: 1, price: 300000, sell: 75000, max: 999, desc: reaffixDesc(1) },
    reaffix3: { name: 'หินสุ่มออฟชั่นขั้นสูง', kind: 'reaffix', tier: 2, price: 1000000, sell: 250000, max: 999, desc: reaffixDesc(2) },
    repassive: { name: 'หินสุ่มสกิลติดตัว', kind: 'repassive', tier: 0, price: 100000, sell: 25000, max: 999, desc: repassiveDesc(0) },
    repassive2: { name: 'หินสุ่มสกิลติดตัวขั้นกลาง', kind: 'repassive', tier: 1, price: 300000, sell: 75000, max: 999, desc: repassiveDesc(1) },
    repassive3: { name: 'หินสุ่มสกิลติดตัวขั้นสูง', kind: 'repassive', tier: 2, price: 1000000, sell: 250000, max: 999, desc: repassiveDesc(2) },
  };
  // the key of a material: matKey('stone', 0) = 'stone' (ENH_STONE, p.stones), matKey('guard', 1) = 'guard2' ...
  const matKey = (kind, tier) => (tier ? kind + (tier + 1) : kind);
  const matDef = (kind, tier) => (kind === 'stone' && !tier ? ENH_STONE : ENH_CHARMS[matKey(kind, tier)]);
  const matHave = (st, kind, tier) => (kind === 'stone' && !tier ? (st && st.stones) || 0 : ((st && st.charms) || {})[matKey(kind, tier)] || 0);
  // what a luck talisman adds per attempt to reach +n (index n-1): the full bonus up to +8, little at +9 / +10
  ENHANCE.luckBonus = [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.04, 0.02];
  ENHANCE.rateWith = (plus, luck) => { const i = Math.min(plus, MAX_PLUS - 1); return Math.min(1, ENHANCE.rate[i] + (luck ? ENHANCE.luckBonus[i] : 0)); };
  const cleanCharms = (c) => Object.fromEntries(Object.entries(ENH_CHARMS).map(([k, S]) =>
    [k, Math.max(0, Math.min(S.max, Math.floor(Number(c && c[k]) || 0)))]));
  // grades picked for auto-sell (sold the moment they drop instead of going into the bag)
  // bag order of "จัดเรียง" / auto-sort: weapon, body, legs, arms, shoulder, then level, grade, + (high first); empties last
  const sortBag = (inv) => {
    const rank = (it) => { const i = SLOTS.indexOf(it.slot); return i < 0 ? SLOTS.length : i; };
    const items = inv.filter((id) => id && ITEMS[id]).map((id) => [id, ITEMS[id]]);
    items.sort(([a, x], [b, y]) => rank(x) - rank(y) || y.lvl - x.lvl || (y.grade || 0) - (x.grade || 0) || (y.plus || 0) - (x.plus || 0) || (a < b ? -1 : a > b ? 1 : 0));
    return [...items.map(([id]) => id), ...Array(Math.max(0, inv.length - items.length)).fill(null)];
  };
  const cleanAutoSell = (a) => (Array.isArray(a) ? [...new Set(a.filter((g) => Number.isInteger(g) && g >= 0 && g < GRADES.length))].sort((x, y) => x - y) : []);
  ENHANCE.canEnhance = (it) => !!it && (it.slot === 'weapon' || ['body', 'legs', 'arms', 'shoulder'].includes(it.slot));
  const plusId = (key, plus) => { const k = parseId(key); return makeKey(k.id, k.grade, k.seed, plus, k.aSeed, k.pSeed); };
  // b = the (graded) item at +0; the + bonus scales with its own stats, so higher grades gain more
  function enhancedItem(b, plus, key) {
    const base = BASE_ITEMS[b.base || b.id];
    let spent = 0;
    for (let k = 0; k < plus; k++) spent += ENHANCE.cost(base, k) + ENHANCE.stoneCount(base, k) * matDef('stone', matTier(base.lvl || 1)).price;
    const it = { ...b, id: key, base: base.id, plus, name: `+${plus} ${b.name}`, core: { ...b.core }, price: b.price + Math.round(spent * 0.5) };
    const add = (k, v) => { if (!v) return; it[k] = k === 'crit' ? r3((b[k] || 0) + v) : (b[k] || 0) + v; it.core[k] = k === 'crit' ? r3((b.core[k] || 0) + v) : (b.core[k] || 0) + v; };
    if (b.slot === 'weapon') {
      add('atk', Math.round(b.core.atk * ENHANCE.atkPct[plus]) + plus * 3);
      add('crit', Math.max(0, plus - 5) * 0.005);
    } else {
      const P = ENHANCE.armPct[plus];
      if (b.core.def) add('def', Math.round(b.core.def * P) + plus);
      if (b.core.hp) add('hp', Math.round(b.core.hp * P) + plus * 6);
      if (b.core.mp) add('mp', Math.round(b.core.mp * P) + plus * 3);
      if (b.core.atk) add('atk', Math.round(b.core.atk * P) + plus);
      if (b.core.crit) add('crit', Math.max(0, plus - 5) * 0.003);
    }
    return it;
  }
  // only canonical, valid keys resolve (and get cached)
  const derived = {};
  function resolveKey(key) {
    if (derived[key]) return derived[key];
    const k = parseId(key), b = BASE_ITEMS[k.id];
    if (!b || k.grade >= GRADES.length || makeKey(k.id, k.grade, k.seed, k.plus, k.aSeed, k.pSeed) !== key) return undefined;
    if (k.plus && !ENHANCE.canEnhance(b)) return undefined;
    let it = k.grade ? gradedItem(b, k.grade, k.seed, k.aSeed, k.pSeed) : b;
    if (k.plus) it = enhancedItem(it, k.plus, key);
    return (derived[key] = it);
  }
  // the browser shows weapons the way the player's class wields them: the same items read as fly-whisks
  // (แส้) for a นักพรต and bows (ธนู) for a นักธนู. Stats do not change; the server keeps the twin-blade names.
  const bowDesc = (d) => d.replace(/ดาบคู่/g, 'ธนู').replace(/ใบดาบ|กระบังดาบ|ร่องดาบ/g, 'คันธนู').replace(/การฟัน/g, 'การยิง').replace(/ฟัน/g, 'ยิง').replace(/ดาบ/g, 'ธนู');
  for (const w of WEAPONS) {
    w.names = { dualblade: w.name, taoist: w.name.replace('ดาบคู่', 'แส้'), archer: w.name.replace('ดาบคู่', 'ธนู'), spearman: w.name.replace('ดาบคู่', 'ทวน') };
    w.names.warrior = w.name.replace('ดาบคู่', 'ดาบและโล่');
    w.descs = { dualblade: w.desc, taoist: w.desc.replace(/ใบดาบ/g, 'ขนแส้').replace(/ดาบ/g, 'แส้'), archer: bowDesc(w.desc), spearman: w.desc.replace(/ดาบคู่/g, 'ทวน').replace(/ใบดาบ/g, 'คมทวน').replace(/ดาบ/g, 'ทวน') };
    w.descs.warrior = 'ชุดดาบมือเดียวและโล่ ใช้ช่องอาวุธเดียว ค่าสถานะและการตีบวกเท่ากับอาวุธระดับเดียวกัน';
  }
  // นักพรต outfit: the same armour items read as Taoist robes, trousers, wrist cuffs and shoulder shawls
  const TAO_SETS = [
    ['ผ้าฝ้ายศิษย์เต๋า', 'ผ้าฝ้ายขาวของศิษย์สำนักเต๋า เรียบง่าย สวมสบายยามฝึกลมปราณ'],
    ['ไหมเมฆา', 'ไหมปักลายเมฆ เบาดุจหมอกบนยอดเขา'],
    ['ยันต์คุ้มกาย', 'ลงอักขระยันต์ไว้ทุกตะเข็บ ปัดเป่าภัยร้ายและคมอาวุธ'],
    ['ไหมวายุ', 'ไหมวิเศษทอด้วยลมปราณ ทำให้ร่างกายเบาดุจขนนก'],
    ['หยกมรกต', 'ประดับหยกมรกตปลุกเสก เรืองแสงอ่อนยามร่ายเวท'],
    ['บัวทองโอสถ', 'ปักบัวทองด้วยดิ้นทองคำ กลิ่นโอสถทิพย์ไม่เคยจางหาย'],
    ['เซียนสวรรค์', 'อาภรณ์ทิพย์ของเซียน แสงทิพย์ไหลเวียนไม่ขาดสาย'],
    ['จักรพรรดิเก้าสวรรค์', 'อาภรณ์ปักยันต์เก้าสวรรค์ ประดับตราหยกและขอบโลหะทิพย์'],
    ['ปฐมเทพสามภพ', 'อาภรณ์ปฐมเทพ ประดับมณฑลดอกบัวและอักขระแห่งสามภพ'],
  ];
  const TAO_SLOT = { body: 'ชุดคลุม', legs: 'กางเกง', arms: 'ผ้าพันข้อมือ', shoulder: 'ผ้าคลุมไหล่' };
  const SLOT_NAMES_BY = { dualblade: { ...SLOT_NAMES }, taoist: { ...SLOT_NAMES, body: 'ชุดคลุม', arms: 'ข้อมือ', shoulder: 'ผ้าคลุมไหล่' } };
  for (const a of ARMORS) {
    const tao = TAO_SETS[a.tier - 1] || [ARMOR_SETS[a.tier - 1].name, a.desc];
    a.names = { dualblade: a.name, taoist: TAO_SLOT[a.slot] + tao[0] };
    a.descs = { dualblade: a.desc, taoist: tao[1] };
  }
  function setViewClass(cls) {
    for (const w of [...WEAPONS, ...ARMORS]) { w.name = w.names[cls] || w.names.dualblade; w.desc = w.descs[cls] || w.descs.dualblade; }
    Object.assign(SLOT_NAMES, SLOT_NAMES_BY[cls] || SLOT_NAMES_BY.dualblade);
    for (const k of Object.keys(derived)) delete derived[k];
  }
  // consumables stack in one bag slot as "<id>*<n>" (n > 1 only — "potHpS" alone means ×1, never "potHpS*1").
  // Gear never stacks (grade/seed/plus make every piece unique), so this only ever applies to C.CONSUMABLES.
  const STACK_MAX = 999;
  const stackCount = (key) => {
    const i = typeof key === 'string' ? key.indexOf('*') : -1;
    return i < 0 ? 1 : Math.max(1, parseInt(key.slice(i + 1), 10) || 1);
  };
  const stackKey = (id, n) => (n > 1 ? `${id}*${Math.min(STACK_MAX, n)}` : id);
  const ITEMS = typeof Proxy === 'function'
    ? new Proxy(BASE_ITEMS, { get: (t, k) => {
        if (typeof k !== 'string') return t[k];
        const base = k.indexOf('*') < 0 ? k : k.slice(0, k.indexOf('*'));
        return /[#+]/.test(base) ? resolveKey(base) : t[base];
      } })
    : BASE_ITEMS;
  const ALL_ITEMS = [...WEAPONS, ...ARMORS];
  const sellPrice = (it) => Math.max(5, Math.floor(it.price * 0.25));
  // special options + passives of everything worn: { pierce: 0.06, thunder: 0.12, ... } (stacked, capped)
  function gearFx(eq) {
    const fx = {};
    for (const slot of SLOTS) {
      const it = eq && ITEMS[eq[slot]];
      if (!it || it.slot !== slot) continue;
      for (const o of [it.option, it.passive]) if (o) fx[o[0]] = (fx[o[0]] || 0) + o[1];
    }
    for (const k of Object.keys(fx)) fx[k] = r3(Math.min(fx[k], (OPTIONS[k] || PASSIVES[k]).cap));
    return fx;
  }
  // proc chance of each passive worn: { reaper: 0.45, swift: 0.3, ... } = the best grade carrying it
  function gearProcs(eq) {
    const out = {};
    for (const slot of SLOTS) {
      const it = eq && ITEMS[eq[slot]];
      if (!it || it.slot !== slot || !it.passive) continue;
      const k = it.passive[0];
      out[k] = Math.max(out[k] || 0, passiveChance(k, it.grade || 0));
    }
    return out;
  }
  // highest grade worn (drives the Legendary/Mythic aura other players see)
  const gearGrade = (eq) => SLOTS.reduce((g, s) => { const it = eq && ITEMS[eq[s]]; return it ? Math.max(g, it.grade || 0) : g; }, 0);
  // grade per slot [weapon, body, legs, arms, shoulder], 0 = empty / Normal (rings under the feet, grade outfits)
  const gearGrades = (eq) => SLOTS.map((s) => { const it = eq && ITEMS[eq[s]]; return it && it.slot === s ? it.grade || 0 : 0; });
  // +level per slot [weapon, body, legs, arms, shoulder] (rune rings under the feet from +8)
  const gearPlus = (eq) => SLOTS.map((s) => { const it = eq && ITEMS[eq[s]]; return it && it.slot === s ? it.plus || 0 : 0; });
  // base stats + equipment bonuses
  function playerStats(cls, lvl, eq, alloc) {
    const s = statsFor(cls, lvl);
    // stat points first (equipment adds on top)
    const pt = (k) => ((alloc && alloc[k]) || 0) * STAT_POINTS[k].per;
    s.atk += Math.round(pt('atk')); s.def += Math.round(pt('def')); s.maxHp += Math.round(pt('hp')); s.maxMp += Math.round(pt('mp'));
    s.crit += pt('crit');
    s.aspd = r3(s.aspd + pt('aspd'));
    const w = ITEMS[eq && eq.weapon] || WEAPONS[0];
    s.atk += w.atk; s.def += w.def || 0; s.maxHp += w.hp || 0; s.maxMp += w.mp || 0; s.speed += w.speed || 0;
    s.crit += w.crit;
    for (const slot of ARMOR_SLOTS) {
      const a = eq && ITEMS[eq[slot]];
      if (!a || a.slot !== slot) continue;
      s.maxHp += a.hp; s.maxMp += a.mp; s.def += a.def; s.speed += a.speed; s.atk += a.atk; s.crit += a.crit;
    }
    s.crit = r3(Math.min(CRIT_CAP, s.crit));
    s.fx = gearFx(eq);
    s.procs = gearProcs(eq);                         // chance that each passive fires
    const pve = gearPve(eq);                         // enhancement of the outfit + full-set grade: damage to monsters
    s.pveMult = r3(pve.mult); s.pvePlus = r3(pve.plus); s.setBonus = pve.set; s.setGrade = pve.setGrade;
    return s;
  }
  // armour tiers per slot for rendering: [body, legs, arms, shoulder], 0 = nothing worn
  const armorTiers = (eq) => ARMOR_SLOTS.map((s) => { const a = eq && ITEMS[eq[s]]; return a && a.slot === s ? a.tier : 0; });

  // ---------------- monsters ----------------
  // The hunting-map monsters (Lv.1-130) are defined in shared/world-data.js; these are the originals it re-levels.
  // Every boss (each hunting map's lair boss and the battlefield's demon king) comes back this long after it dies.
  const BOSS_RESPAWN = 10 * 60 * 1000;
  const MONSTERS = {
    spirit: { name: 'ภูตหมอก', lvl: 1, hp: 70, atk: 9, def: 1, exp: 22, speed: 70, radius: 20,
      aggro: 0, atkRange: 46, atkCd: 1500, respawn: 8000 },
    boar: { name: 'หมูป่าคลั่ง', lvl: 4, hp: 210, atk: 18, def: 4, exp: 55, speed: 110, radius: 24,
      aggro: 150, atkRange: 50, atkCd: 1400, respawn: 10000 },
    wolf: { name: 'หมาป่าเงา', lvl: 10, hp: 520, atk: 40, def: 10, exp: 170, speed: 150, radius: 24,
      aggro: 220, atkRange: 52, atkCd: 1100, respawn: 12000 },
    golem: { name: 'ยักษ์ศิลา', lvl: 18, hp: 1400, atk: 72, def: 20, exp: 430, speed: 72, radius: 34,
      aggro: 200, atkRange: 66, atkCd: 1800, respawn: 16000 },
    boss: { name: 'ราชันมารโลหิต', lvl: 35, hp: 32000, atk: 165, def: 40, exp: 16000, speed: 88, radius: 58,
      aggro: 300, atkRange: 92, atkCd: 1600, respawn: BOSS_RESPAWN, boss: true },
  };
  // Loot: gold range and independent item chances. `pickOne` = exactly one weighted item.
  // Each dropped item then rolls its grade (rollGrade): Epic+ only when the monster is 0-9 levels above the item.
  const DROPS = {
    spirit: { gold: [3, 7], items: [['w1', 0.008], ['sh1', 0.012], ['pa1', 0.012], ['br1', 0.012], ['sd1', 0.012]] },
    boar: { gold: [6, 14], items: [['w1', 0.02], ['sh1', 0.02], ['pa1', 0.02], ['br1', 0.02], ['sd1', 0.02], ['sh2', 0.004]] },
    wolf: { gold: [14, 26], items: [['w1', 0.02], ['w2', 0.012], ['sh2', 0.015], ['pa2', 0.015], ['br2', 0.015], ['sd2', 0.015]] },
    golem: { gold: [28, 48], items: [['w2', 0.02], ['w3', 0.01], ['w4', 0.003],
      ['sh2', 0.02], ['pa2', 0.02], ['br2', 0.02], ['sd2', 0.02], ['sh3', 0.008], ['pa3', 0.008], ['br3', 0.008], ['sd3', 0.008]] },
    boss: { gold: [600, 900], pickOne: true,
      items: [['w3', 40], ['sh3', 16], ['pa3', 16], ['br3', 16], ['sd3', 16], ['w4', 50], ['w5', 30], ['w6', 15], ['w7', 6], ['w8', 2.5], ['w9', 1], ['w10', 0.4],
        ['sh4', 20], ['pa4', 20], ['br4', 20], ['sd4', 20], ['sh5', 9], ['pa5', 9], ['br5', 9], ['sd5', 9],
        ['sh6', 3], ['pa6', 3], ['br6', 3], ['sd6', 3], ['sh7', 0.5], ['pa7', 0.5], ['br7', 0.5], ['sd7', 0.5]] },
  };
  const MONSTER_TYPES = Object.keys(MONSTERS);

  // PvP battlefield spawns: only the blood demon king (the levelling monsters live on the hunting maps).
  const ZONES = [{ type: 'boss', x0: 78, y0: 59, x1: 81, y1: 61, count: 1, name: 'สนามรบกลาง', fixed: true }];
  const mirX = (x) => MAP_W - 1 - x;
  // open clearings (thinner forest) where the old monster fields were, mirrored for both sides
  const CLEARINGS = [];
  const sideClear = (x0, y0, x1, y1) => { CLEARINGS.push({ x0, y0, x1, y1 }, { x0: mirX(x1), y0, x1: mirX(x0), y1 }); };
  sideClear(30, 46, 44, 74); sideClear(28, 6, 46, 32); sideClear(28, 88, 46, 113); sideClear(57, 24, 70, 46); sideClear(57, 74, 70, 96);
  CLEARINGS.push({ x0: 64, y0: 5, x1: 95, y1: 15 }, { x0: 64, y0: 105, x1: 95, y1: 114 });

  // ---------------- directions ----------------
  // oct: 0=E 1=SE 2=S 3=SW 4=W 5=NW 6=N 7=NE ; sprite sheet column order: S SE E NE N NW W SW
  const DIR_COL = [2, 1, 0, 7, 6, 5, 4, 3];
  const dirFromAngle = (a) => ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
  const dirFromVec = (dx, dy) => dirFromAngle(Math.atan2(dy, dx));

  // ---------------- map generation ----------------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function makeNoise(rand) {
    const G = 64, g = new Float32Array(G * G);
    for (let i = 0; i < g.length; i++) g[i] = rand();
    const at = (x, y) => g[(((y % G) + G) % G) * G + (((x % G) + G) % G)];
    const s = (t) => t * t * (3 - 2 * t);
    return (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), xf = s(x - xi), yf = s(y - yi);
      const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
      return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
    };
  }

  function generateMap(seed) {
    const W = MAP_W, H = MAP_H;
    const rand = mulberry32(seed);
    const noise = makeNoise(rand);
    const fbm = (x, y) => noise(x, y) * 0.6 + noise(x * 2.1 + 17, y * 2.1 + 9) * 0.3 + noise(x * 4.3 + 3, y * 4.3 + 31) * 0.1;
    const tiles = new Uint8Array(W * H);
    const solid = new Uint8Array(W * H);
    const used = new Uint8Array(W * H);
    const objects = [];
    const id = (x, y) => y * W + x;
    const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
    const get = (x, y) => (inb(x, y) ? tiles[id(x, y)] : -1);
    const set = (x, y, t) => { if (inb(x, y)) tiles[id(x, y)] = t; };
    const px = (tx) => tx * TILE + TILE / 2;
    const addObj = (t, v, tx, ty, isSolid, ox = 0, oy = 0) => {
      objects.push([t, v, Math.round(px(tx) + ox), Math.round(ty * TILE + TILE - 6 + oy)]);
      if (inb(tx, ty)) { used[id(tx, ty)] = 1; if (isSolid) solid[id(tx, ty)] = 1; }
    };
    const block = (x0, y0, x1, y1) => {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inb(x, y)) { solid[id(x, y)] = 1; used[id(x, y)] = 1; }
    };

    // Rivers (mirrored)
    for (let y = 0; y < H; y++) {
      const c = 50 + Math.sin(y * 0.075) * 3.2 + Math.sin(y * 0.19 + 1.3) * 1.4;
      const half = 1.9 + Math.sin(y * 0.05 + 2) * 0.5;
      for (let x = Math.floor(c - half - 2); x <= Math.ceil(c + half + 2); x++) {
        const d = Math.abs(x + 0.5 - c);
        if (d <= half) { set(x, y, T.WATER); set(mirX(x), y, T.WATER); }
      }
      for (let x = Math.floor(c - half - 2); x <= Math.ceil(c + half + 2); x++) {
        const d = Math.abs(x + 0.5 - c);
        if (d > half && d <= half + 1.3 && get(x, y) !== T.WATER) { set(x, y, T.SAND); set(mirX(x), y, T.SAND); }
      }
    }

    // Central battlefield
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
      if (Math.hypot(x + 0.5 - CENTER.tx - 0.5, y + 0.5 - CENTER.ty) <= CENTER.r) set(x, y, T.FIELD);

    // Roads
    const road = (x0, y0, x1, y1) => {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const t = get(x, y);
        if (t === T.WATER) set(x, y, T.BRIDGE);
        else if (t === T.GRASS || t === T.SAND) set(x, y, T.PATH);
      }
    };
    road(27, 59, 132, 61);
    road(36, 18, 123, 20);
    road(36, 99, 123, 101);
    road(36, 18, 38, 101);
    road(121, 18, 123, 101);
    road(79, 18, 80, 101);

    // Bases
    for (const f of ['dharma', 'adharma']) {
      const b = BASES[f];
      const floor = f === 'dharma' ? T.HOLY : T.DARK;
      const fv = f === 'dharma' ? 0 : 1;
      const east = f === 'dharma';
      const gateX = east ? b.x1 : b.x0;
      const sideGate = east ? [21, 23] : [mirX(23), mirX(21)];
      for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) {
        set(x, y, floor);
        const edge = x === b.x0 || x === b.x1 || y === b.y0 || y === b.y1;
        if (!edge) continue;
        const mainGate = x === gateX && y >= 58 && y <= 62;
        const sGate = (y === b.y0 || y === b.y1) && x >= sideGate[0] && x <= sideGate[1];
        if (mainGate || sGate) continue;
        const corner = (x === b.x0 || x === b.x1) && (y === b.y0 || y === b.y1);
        const gateSide = (x === gateX && (y === 57 || y === 63)) ||
          ((y === b.y0 || y === b.y1) && (x === sideGate[0] - 1 || x === sideGate[1] + 1));
        addObj(corner || gateSide ? 'tower' : 'wall', fv, x, y, true, 0, 6);
      }
      // Hall: temple (dharma) / fortress (adharma), 9x5 footprint
      const hx = east ? 13 : mirX(13);
      block(hx - 4, 46, hx + 4, 50);
      objects.push([east ? 'temple' : 'fortress', fv, px(hx), 51 * TILE]);
      // Spring / blood altar
      const sx = east ? 12 : mirX(13);
      block(sx, 59, sx + 1, 61);
      objects.push([east ? 'spring' : 'altar', fv, (sx + 1) * TILE, 62 * TILE - 4]);
      // Blacksmith stall
      const sm = SMITH[f];
      block(sm.tx, sm.ty, sm.tx + 1, sm.ty);
      objects.push(['smith', fv, sm.x, sm.y]);
      // ร้านขายยา: a second shop building, same look as the blacksmith's
      const ap = APOTHECARY[f];
      block(ap.tx, ap.ty, ap.tx + 1, ap.ty);
      objects.push(['apothecary', fv, ap.x, ap.y]);
      // Teleport stone back to the hunting maps
      const st = STONES[f];
      block(st.tx, st.ty, st.tx, st.ty);
      objects.push(['stone', fv, st.x, (st.ty + 1) * TILE - 6]);
      // Lanterns along the inner road
      for (const lx of [19, 24]) for (const ly of [57, 63]) addObj('lantern', fv, east ? lx : mirX(lx), ly, true);
      // Banners beside the gate (on the towers)
      for (const gy of [57, 63]) objects.push(['banner', fv, px(gateX), gy * TILE + TILE - 2]);
      // Garden trees
      for (const [tx, ty] of [[6, 56], [6, 68], [9, 74], [17, 74], [25, 74], [25, 47], [20, 47], [6, 47]]) {
        const x = east ? tx : mirX(tx);
        if (!used[id(x, ty)]) addObj('tree', east ? 2 : 3, x, ty, true);
      }
    }

    // Broken pillars around the battlefield + central altar sigil
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + Math.PI / 12;
      const tx = Math.round(CENTER.tx + Math.cos(a) * 13.2), ty = Math.round(CENTER.ty + Math.sin(a) * 13.2);
      if (get(tx, ty) === T.PATH) continue;
      addObj('pillar', i % 3, tx, ty, true);
    }
    objects.push(['sigil', 0, Math.round((CENTER.tx + 0.5) * TILE), Math.round((CENTER.ty + 0.5) * TILE)]);

    // Keep-clear mask: no trees/rocks close to roads, water, bases or the battlefield
    const clear = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const t = tiles[id(x, y)];
      if (t === T.GRASS) continue;
      const r = t === T.SAND ? 1 : 2;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (inb(x + dx, y + dy)) clear[id(x + dx, y + dy)] = 1;
    }
    for (const b of Object.values(BASES)) {
      const s = b.spawn;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (inb(s.tx + dx, s.ty + dy)) clear[id(s.tx + dx, s.ty + dy)] = 1;
    }
    const inZone = (x, y) => CLEARINGS.some((z) => x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1);

    // Trees, rocks, bushes
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const k = id(x, y);
      if (tiles[k] !== T.GRASS || used[k]) continue;
      const border = x < 3 || y < 3 || x > W - 4 || y > H - 4;
      const xr = x / W;
      let variant;
      const r1 = rand();
      if (xr < 0.3) variant = r1 < 0.12 ? 2 : r1 < 0.6 ? 0 : 1;
      else if (xr > 0.7) variant = r1 < 0.12 ? 3 : r1 < 0.6 ? 4 : 1;
      else variant = r1 < 0.5 ? 0 : r1 < 0.8 ? 1 : 4;
      if (border) { addObj('tree', variant, x, y, true, (rand() - 0.5) * 14, 0); continue; }
      if (clear[k]) continue;
      const n = fbm(x / 9, y / 9);
      const zoneFactor = inZone(x, y) ? 0.45 : 1;
      const r2 = rand();
      if ((n > 0.6 && r2 < 0.7 * zoneFactor) || r2 < 0.022 * zoneFactor) {
        addObj('tree', variant, x, y, true, (rand() - 0.5) * 16, (rand() - 0.5) * 6);
      } else if (r2 > 0.988) {
        addObj('rock', Math.floor(rand() * 3), x, y, true);
      } else if (r2 > 0.968) {
        addObj('bush', xr < 0.5 ? 0 : 1, x, y, false, (rand() - 0.5) * 20, (rand() - 0.5) * 10);
      }
    }
    // Water is solid, bridges are not
    for (let k = 0; k < W * H; k++) if (tiles[k] === T.WATER) solid[k] = 1;

    return { w: W, h: H, seed, tiles, solid, objects };
  }

  // ---------------- collision / zones ----------------
  function solidAt(map, x, y) {
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    if (tx < 0 || ty < 0 || tx >= map.w || ty >= map.h) return true;
    return map.solid[ty * map.w + tx] === 1;
  }
  // Feet hit-box: wide and shallow (top-down 3/4 view)
  function canStand(map, x, y, r = 13) {
    return !solidAt(map, x - r, y - 6) && !solidAt(map, x + r, y - 6) &&
      !solidAt(map, x - r, y + 4) && !solidAt(map, x + r, y + 4);
  }
  function baseAt(x, y) {
    const tx = x / TILE, ty = y / TILE;
    for (const f of ['dharma', 'adharma']) {
      const b = BASES[f];
      if (tx >= b.x0 && tx < b.x1 + 1 && ty >= b.y0 && ty < b.y1 + 1) return f;
    }
    return null;
  }
  function areaName(x, y) {
    const b = baseAt(x, y);
    if (b) return BASES[b].name;
    const tx = x / TILE, ty = y / TILE;
    if (Math.hypot(tx - CENTER.tx - 0.5, ty - CENTER.ty) <= CENTER.r + 1) return 'สนามรบกลาง';
    return tx < MAP_W / 2 ? 'แดนธรรมะ' : 'แดนอธรรม';
  }
  const spawnPoint = (f) => ({ x: BASES[f].spawn.tx * TILE + TILE / 2, y: BASES[f].spawn.ty * TILE + TILE / 2 });

  return {
    TILE, MAP_W, MAP_H, T, FACTIONS, BASES, CENTER, STONES, CLASSES, CLASS_ROLES, roleOf, combatMoveScale, MAX_LVL, CONSUMABLES, STACK_MAX, stackCount, stackKey, ITEM_USE_CD,
    skillRank, skillMult, skillInfo, stageOf, SKILL_STAGES, stagesOf, STANCES, GCD_MS, CLASS_IDS, ALL_SKILLS, setViewClass, spearSequence, spearAreaContains,
    BAG_SIZE, STORAGE_SIZE, RARITY, GRADES, GRADE_LIGHT, gradeLight, EPIC, AFFIXES, OPTIONS, PASSIVES, DROP_LVL_RANGE, TOP_ITEM_LVL, canDropHigh, rollGrade, gradeChances, gradeBands, HIGH_BANDS, BOSS_GRADES, BOSS_RESPAWN,
    makeKey, gradeId, gearFx, gearGrade, gearGrades, gearPlus, WEAPONS, WEAPON_BY_TIER, ARMORS, ARMOR_SETS, ALL_ITEMS, ITEMS, SLOTS, SLOT_NAMES, ARMOR_SLOTS,
    MAX_PLUS, REAPER_CD_MS, passiveChance, gearProcs, ENHANCE, MAT_TIERS, matTier, matKey, matDef, matHave, PVE_PLUS_MAX, SLOT_PVE, SET_BONUS, gearPve, ENH_STONE, ENH_CHARMS, cleanCharms, cleanAutoSell, sortBag, parseId, plusId, shopGearPrice, SHOP_BUY_GRADE_MAX, newSeed,
    DROPS, SMITH, APOTHECARY, sellPrice, playerStats, armorTiers, armorLookTier,
    MONSTERS, MONSTER_TYPES, ZONES, DIR_COL,
    SKILL_MAX, SKILL_STEP, SKILL_LVL_GAP, EVO_NEED, EVO_COST, BAR_KEYS, SKILL_PATHS, skillPtsTotal, skillCap, basicOf, skillPtsFree,
    evoBlock, autoSkills, cleanSkills, skillRankOf, skillPower, skillInfoAt, SKILL_VER, BUFF_SKILLS, MOVE_SKILLS, meteorPoints, blastPoints,
    STAT_PTS, STAT_POINTS, PT_KEYS, statPtsTotal, statPtsFree, cleanAlloc, basicCd, BASIC_CD_MUL, STAT_GUIDE_KEY, STAT_GUIDES, statGuide, guideTarget, guidePoints, statLimits, CRIT_CAP, skillMp, MP_COST_PCT, MP_COST_CAP, SKILL_CD_MUL,
    enemyOf, expToNext, EXP_CURVE, EXP_RATE, monsterExpMul, EXP_LEVEL, levelExpMul, expPenalty, PARTY_MAX, PARTY_BONUS, PARTY_BONUS_STEP, PARTY_LVL_GAP, partyExpBonus, partyCountOf, PARTY_RANGE, PARTY_INVITE_MS, PARTY_EXP_MODES, PARTY_ITEM_MODES, PARTY_DEFAULT, PK, LVL_GAP, levelGapMul, DMG_FLOOR, SPEAR_PVE_MULT, TAOIST_SELF_HEAL_MULT, TAOIST_SOLO, TAOIST_MERCY_AURA, WARRIOR_SOLO, WARRIOR_THORNS, SPEAR_WINDUP_GUARD, statsFor, dirFromAngle, dirFromVec,
    generateMap, solidAt, canStand, baseAt, areaName, spawnPoint, mulberry32, makeNoise,
  };
});
