// In-game dialogs instead of the browser's alert() / confirm(): same look as the rest of the game, clear button
// names ("ทิ้ง", "ขาย" instead of OK), a red button for what cannot be undone, big buttons on phones.
//   await UI.confirm(text, { title, icon, ok, cancel, danger, warn })  → true / false
//   await UI.alert(text, { title, icon, ok })
// text: lines split on \n (a "• " line is a list item); warn: a line in red under the text.
// While a dialog is up it owns the keyboard: Enter = the focused button (the main one by default, "ยกเลิก" for a
// danger one), Esc = cancel, and no game hotkey (attack, bag, Esc-closes-everything ...) gets through.
// Dialogs asked for while one is open wait their turn.
(function () {
  const root = document.createElement('div');
  root.id = 'uiDialog';
  root.className = 'ui-dlg hidden';
  root.innerHTML = `<div class="ui-dlg-box" role="alertdialog" aria-modal="true" aria-labelledby="uiDlgTitle" aria-describedby="uiDlgText">
    <div class="ui-dlg-icon" aria-hidden="true"></div><h3 id="uiDlgTitle"></h3><div id="uiDlgText"></div><p class="ui-dlg-warn"></p>
    <div class="ui-dlg-btns"><button type="button" class="ui-dlg-no"></button><button type="button" class="ui-dlg-yes"></button></div></div>`;
  document.body.appendChild(root);
  const box = root.firstElementChild, $q = (s) => root.querySelector(s);
  const yes = $q('.ui-dlg-yes'), no = $q('.ui-dlg-no'), title = $q('#uiDlgTitle'), text = $q('#uiDlgText'), warn = $q('.ui-dlg-warn'), icon = $q('.ui-dlg-icon');

  const queue = [];
  let cur = null, lastFocus = null;
  function show() {
    if (cur || !queue.length) return;
    cur = queue.shift();
    const o = cur.o;
    icon.textContent = o.icon || (cur.alert ? 'ℹ️' : o.danger ? '⚠️' : '❔');
    title.textContent = o.title || (cur.alert ? 'แจ้งเตือน' : 'ยืนยัน');
    title.classList.toggle('hidden', o.title === '');
    text.innerHTML = '';
    for (const line of String(cur.text || '').split('\n')) {
      const p = document.createElement(line.startsWith('• ') ? 'li' : 'p');
      p.textContent = line.startsWith('• ') ? line.slice(2) : line;
      if (!line.trim()) p.className = 'gap';
      text.appendChild(p);
    }
    warn.textContent = o.warn || '';
    warn.classList.toggle('hidden', !o.warn);
    yes.textContent = o.ok || 'ตกลง';
    no.textContent = o.cancel || 'ยกเลิก';
    no.classList.toggle('hidden', !!cur.alert);
    box.classList.toggle('danger', !!o.danger);
    lastFocus = document.activeElement;
    root.classList.remove('hidden');
    box.classList.remove('pop'); void box.offsetWidth; box.classList.add('pop');
    (o.danger && !cur.alert ? no : yes).focus({ preventScroll: true });
  }
  function close(answer) {
    if (!cur) return;
    const done = cur;
    cur = null;
    root.classList.add('hidden');
    if (lastFocus && lastFocus.isConnected && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    done.resolve(done.alert ? undefined : answer);
    show();
  }
  yes.addEventListener('click', () => close(true));
  no.addEventListener('click', () => close(false));
  root.addEventListener('pointerdown', (e) => { if (e.target === root) close(false); });     // the dimmed backdrop
  // the dialog's keys first (capturing on window runs before the game's own listeners), the game gets none of them
  addEventListener('keydown', (e) => {
    if (!cur) return;
    e.stopImmediatePropagation();
    if (e.key === 'Escape') { e.preventDefault(); close(false); }
    else if (e.key === 'Tab') { e.preventDefault(); (document.activeElement === yes && !cur.alert ? no : yes).focus(); }
    else if (e.key === 'Enter') { e.preventDefault(); close(document.activeElement !== no); }       // the focused button
  }, true);

  const ask = (alert, text, o) => new Promise((resolve) => { queue.push({ alert, text, o: o || {}, resolve }); show(); });
  window.UI = {
    confirm: (text, o) => ask(false, text, o),
    alert: (text, o) => ask(true, text, o),
    open: () => !!cur,
  };
})();
