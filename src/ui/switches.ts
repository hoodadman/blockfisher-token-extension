import { loadSettings, setSwitch, type SwitchName } from '../settings';

/** The on/off switches, shared by the toolbar popup and the settings page. */

const SWITCHES: Array<{ name: SwitchName; label: string; hint: string }> = [
  { name: 'autoScan', label: 'Auto scan', hint: 'Look for tokens on trading sites by itself. Off: only when you click the icon.' },
  { name: 'autoPopup', label: 'Auto pop up', hint: 'Show the card on the page. Off: the icon shows what was found.' },
  { name: 'confirmToken', label: 'Confirm token before scan', hint: 'Ask "Run a safety scan?" first. Off: scan straight away.' },
];

export async function renderSwitches(container: HTMLElement, onChange?: () => void): Promise<void> {
  const { switches } = await loadSettings();
  const rows = SWITCHES.map(({ name, label, hint }) => {
    const row = document.createElement('label');
    row.className = 'bf-switch';
    const text = document.createElement('span');
    text.className = 'bf-switch__text';
    const title = document.createElement('span');
    title.className = 'bf-switch__label';
    title.textContent = label;
    const small = document.createElement('span');
    small.className = 'bf-switch__hint';
    small.textContent = hint;
    text.append(title, small);
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.setAttribute('role', 'switch');
    box.checked = switches[name];
    box.addEventListener('change', () => void setSwitch(name, box.checked).then(onChange));
    row.append(text, box);
    return row;
  });
  container.replaceChildren(...rows);
}
