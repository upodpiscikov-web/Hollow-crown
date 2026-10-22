// Settings modal: volume, toggles, save export/import, abandon run, erase all.
import { h, tap, UI, safe } from './core.js';
import { modal, confirmBox, toast, closeAllModals } from './overlay.js';
import { sfx, setVolume } from './sound.js';

function slider(label, value, onInput, onChange) {
  const val = h('span.sl-val', Math.round(value * 100) + '%');
  const input = h('input', { type: 'range', min: 0, max: 100, step: 5, value: Math.round(value * 100), 'aria-label': label });
  input.addEventListener('input', () => { val.textContent = input.value + '%'; onInput(input.value / 100); });
  input.addEventListener('change', () => onChange && onChange(input.value / 100));
  return h('label.set-row', h('span.set-label', label), h('div.sl-wrap', input, val));
}

function toggle(label, desc, value, onChange) {
  const b = h('button.toggle' + (value ? '.on' : ''), { role: 'switch', 'aria-checked': String(!!value) }, h('i'));
  tap(b, () => { value = !value; b.classList.toggle('on', value); b.setAttribute('aria-checked', String(value)); onChange(value); });
  return h('div.set-row', h('span.set-label', label, desc ? h('small', desc) : null), b);
}

export function openSettings(g) {
  const s = g.meta.settings;
  const save = () => g.saveMeta();
  const body = h('div.settings');
  body.append(
    h('div.set-group',
      h('div.set-head', 'Sound'),
      slider('Music', s.music, (v) => { s.music = v; setVolume('music', v); }, () => save()),
      slider('Effects', s.sfx, (v) => { s.sfx = v; setVolume('sfx', v); }, () => { save(); sfx('hit'); })),
    h('div.set-group',
      h('div.set-head', 'Play'),
      toggle('Fast mode', 'Shorter pauses and animations.', s.fast, (v) => { s.fast = v; save(); }),
      toggle('Screen shake', 'Heavy hits shake the screen.', s.shake, (v) => { s.shake = v; save(); }),
      toggle('Confirm End Turn', 'Ask twice when you still have playable cards.', s.confirmEnd, (v) => { s.confirmEnd = v; save(); })));

  // Save management
  const area = h('textarea.save-area', { rows: 3, placeholder: 'Paste a save code here to import it…', spellcheck: 'false' });
  const exportBtn = h('button.btn.small', 'Export');
  const copyBtn = h('button.btn.small', 'Copy');
  const importBtn = h('button.btn.small', 'Import');
  tap(exportBtn, () => { try { area.value = g.exportSave(); area.select(); toast('Save code ready below. Copy it somewhere safe.'); } catch (e) { toast('Export failed: ' + e.message, 'warn'); } });
  tap(copyBtn, async () => {
    if (!area.value) { try { area.value = g.exportSave(); } catch (e) { toast('Export failed.', 'warn'); return; } }
    try { await navigator.clipboard.writeText(area.value); toast('Copied to the clipboard.'); } catch (e) { area.focus(); area.select(); try { document.execCommand('copy'); toast('Copied.'); } catch (e2) { toast('Select the text and copy it by hand.'); } }
  });
  tap(importBtn, async () => {
    const code = area.value.trim();
    if (!code) { toast('Paste a save code first.', 'warn'); return; }
    if (!(await confirmBox('Importing replaces your current progress, including any run in progress.', { yes: 'Import', danger: true }))) return;
    try {
      g.importSave(code);
      UI.inRun = false; UI.view = 'title'; UI.hubShown = false;
      if (UI.applySettings) UI.applySettings();
      closeAllModals();
      toast('Save imported.');
      UI.render();
    } catch (e) { toast('That is not a valid save code.', 'warn'); }
  });
  body.appendChild(h('div.set-group', h('div.set-head', 'Save'), area, h('div.set-btns', exportBtn, copyBtn, importBtn)));

  // Danger zone
  const danger = h('div.set-group', h('div.set-head', 'Danger'));
  if (g.run && UI.inRun) {
    const quit = h('button.btn.small', 'Save & quit to title');
    tap(quit, () => { if (g.cb && (g.cb.busy || g.cb.phase !== 'player')) { toast('Wait for the enemy turn to end.', 'warn'); return; } g.save(); UI.inRun = false; UI.view = 'title'; closeAllModals(); UI.render(); });
    danger.appendChild(quit);
  }
  if (g.run) {
    const ab = h('button.btn.small.danger', 'Abandon expedition');
    tap(ab, async () => {
      if (!(await confirmBox('Abandon this expedition? The Crown will count it a death.', { yes: 'Abandon', danger: true }))) return;
      try { g.abandonRun(); } catch (e) { console.warn(e); }
      UI.inRun = false; UI.view = 'hub'; UI.hubShown = false;
      closeAllModals();
      UI.render();
    });
    danger.appendChild(ab);
  }
  const erase = h('button.btn.small.danger', 'Erase all progress');
  tap(erase, async () => {
    if (!(await confirmBox('Erase <b>everything</b>: heirs, lore, Renown, and any expedition?', { yes: 'Continue', danger: true }))) return;
    if (!(await confirmBox('This cannot be undone. The Crown will forget you ever answered.', { title: 'Truly?', yes: 'Erase it all', danger: true }))) return;
    g.resetAll();
    UI.inRun = false; UI.view = 'title'; UI.hubShown = false;
    if (UI.applySettings) UI.applySettings();
    closeAllModals();
    toast('All is forgotten.');
    UI.render();
  });
  danger.appendChild(erase);
  body.appendChild(danger);
  body.appendChild(h('div.credits', 'The Hollow Crown — a game of ash, iron and candlelight. Fonts: IM Fell English SC, Alegreya, Silkscreen (OFL). All art and music are drawn and sung in code.'));
  return modal({ title: 'Settings', cls: 'm-settings', body, onClose: () => g.saveMeta() });
}
