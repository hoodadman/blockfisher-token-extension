import { NAMED_SITES, siteOf } from './readers/url';
import { hostFromInput, loadSettings, setMode, type Settings, type SiteMode } from './settings';
import { forgetSite, isAllowedHere, rememberSite, requestSite, syncScripts } from './sites';
import { renderSwitches } from './ui/switches';

/** Settings page: what happens on each site, and the remembered sites. */

const MODES: Array<[SiteMode, string]> = [
  ['on', 'On'],
  ['off', 'Off'],
];

function modePicker(host: string, current: SiteMode): HTMLSelectElement {
  const select = document.createElement('select');
  select.setAttribute('aria-label', `What happens on ${host}`);
  for (const [value, label] of MODES) {
    const option = new Option(label, value, false, value === current);
    select.add(option);
  }
  select.addEventListener('change', () => void setMode(host, select.value as SiteMode));
  return select;
}

function row(host: string, ...controls: HTMLElement[]): HTMLLIElement {
  const item = document.createElement('li');
  const name = document.createElement('span');
  name.className = 'site';
  name.textContent = host;
  item.append(name, ...controls);
  return item;
}

/** The last settings shown, so adding a site can check them without waiting (see addSite). */
let shown: Settings | undefined;

async function render() {
  const settings = await loadSettings();
  shown = settings;

  const named = document.getElementById('named') as HTMLUListElement;
  named.replaceChildren(...NAMED_SITES.map((host) => row(host, modePicker(host, settings.modes[host] ?? 'on'))));

  const remembered = document.getElementById('remembered') as HTMLUListElement;
  const empty = document.getElementById('remembered-empty') as HTMLElement;
  empty.hidden = settings.remembered.length > 0;
  const rows = await Promise.all(
    settings.remembered.map(async (host) => {
      const controls: HTMLElement[] = [modePicker(host, settings.modes[host] ?? 'on')];
      if (!(await isAllowedHere(host))) {
        const allow = document.createElement('button');
        allow.type = 'button';
        allow.textContent = 'Allow on this computer';
        allow.addEventListener('click', () => {
          void requestSite(host).then(async (granted) => {
            if (granted) await syncScripts();
            await render();
          });
        });
        controls.push(allow);
      }
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Remove';
      remove.addEventListener('click', () => void forgetSite(host).then(render));
      controls.push(remove);
      return row(host, ...controls);
    }),
  );
  remembered.replaceChildren(...rows);
}

/** Adds a site before the user visits it. Chrome asks them to allow it there. */
function addSite(event: SubmitEvent) {
  event.preventDefault();
  const input = document.getElementById('new-site') as HTMLInputElement;
  const note = document.getElementById('add-site-note') as HTMLElement;
  const host = hostFromInput(input.value);
  if (!host) {
    note.textContent = 'Type a website address, like example.com.';
    return;
  }
  if (siteOf(host)) {
    note.textContent = `${host} is already one of the trading sites above.`;
    return;
  }
  if (shown?.remembered.includes(host)) {
    note.textContent = `${host} is already on your list.`;
    return;
  }
  // Chrome only shows its permission prompt inside the click, so ask before any await.
  void requestSite(host).then(async (granted) => {
    if (!granted) {
      note.textContent = `Chrome didn’t allow ${host}, so it wasn’t added.`;
      return;
    }
    await rememberSite(host);
    input.value = '';
    note.textContent = `Added ${host}. Auto scan will run there from the next time you open it.`;
    await render();
  });
}

document.getElementById('add-site')?.addEventListener('submit', addSite);
void render();
void renderSwitches(document.getElementById('switches') as HTMLElement);
