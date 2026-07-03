import { App, setIcon } from "obsidian";
import { computePosition, flip, shift, offset, size } from "@floating-ui/dom";
import type { MenuProfile, ScriptEntry } from "./settings";

export function dismissAllMenus(): void {
  const menus = document.querySelectorAll("[data-sm-menu]");
  Array.from(menus).forEach((el) => {
    const smEl = el as HTMLElement;
    clearTimeouts(smEl);
    const markDismissed = (smEl as any)._smDismissed as (() => void) | undefined;
    if (markDismissed) markDismissed();
    const cleanup = (smEl as any)._smCleanup as (() => void) | undefined;
    if (cleanup) cleanup();
    smEl.remove();
  });
}

function clearTimeouts(el: HTMLElement): void {
  const groups = el.querySelectorAll("[data-sm-timeouts]");
  Array.from(groups).forEach((g) => {
    const ids = (g as HTMLElement).dataset.smTimeouts;
    if (ids) {
      ids.split(",").forEach((id) => {
        const n = parseInt(id, 10);
        if (!isNaN(n)) clearTimeout(n);
      });
    }
  });
}

export function showContextMenu(ev: MouseEvent, profile: MenuProfile, app: App): void {
  dismissAllMenus();
  const bodyZoom = parseFloat((document.body.style as any).zoom) || 1;
  const x = ev.clientX / bodyZoom;
  const y = ev.clientY / bodyZoom;

  const menuEl = buildMenu(profile, app);
  menuEl.setAttribute("data-sm-menu", "");
  document.body.appendChild(menuEl);

  let dismissed = false;
  (menuEl as any)._smDismissed = () => (dismissed = true);

  const virtualEl = {
    getBoundingClientRect: () => DOMRect.fromRect({ x, y, width: 0, height: 0 }),
  };

  computePosition(virtualEl, menuEl, {
    placement: "bottom-start",
    middleware: [
      offset(4),
      flip({ padding: 10 }),
      shift({ padding: 10 }),
      size({
        apply({ availableHeight, elements }: { availableHeight: number; availableWidth: number; elements: any }) {
          elements.floating.style.maxHeight = `${Math.max(Math.min(availableHeight - 16, 600), 100)}px`;
          elements.floating.style.overflowY = "auto";
        },
        padding: 8,
      }),
    ],
  }).then(({ x: fx, y: fy }) => {
    if (dismissed) return;
    menuEl.style.left = `${Math.floor(fx)}px`;
    menuEl.style.top = `${Math.floor(fy)}px`;
  });

  const cleanup = registerDismissHandlers(menuEl);
  (menuEl as any)._smCleanup = cleanup;
}

function buildMenu(profile: MenuProfile, app: App): HTMLElement {
  const menu = document.createElement("div");
  menu.className = "sm-menu";

  if (profile.mainMenuCommands.length === 0 && Object.keys(profile.submenus).length === 0) {
    const empty = menu.createDiv({ cls: "sm-menu-empty", text: "No commands configured" });
    empty.style.cssText = "padding: 12px 16px; color: var(--text-muted); font-size: 12px; text-align: center;";
    return menu;
  }

  for (const cmd of profile.mainMenuCommands) {
    if (!cmd.commandId) continue;
    menu.appendChild(createItem(cmd, app));
  }

  if (profile.mainMenuCommands.length > 0 && Object.keys(profile.submenus).length > 0) {
    menu.appendChild(createSeparator());
  }

  for (const [groupName, entries] of Object.entries(profile.submenus)) {
    const valid = entries.filter((e) => e.commandId);
    if (valid.length === 0) continue;
    menu.appendChild(createGroup(groupName, valid, app));
  }

  return menu;
}

function createItem(entry: ScriptEntry, app: App): HTMLElement {
  const item = document.createElement("div");
  item.className = "sm-menu-item";

  if (entry.color) {
    item.style.color = entry.color;
  }

  if (entry.icon) {
    const iconEl = item.createSpan({ cls: "sm-menu-item-icon" });
    if (entry.color) {
      iconEl.style.color = entry.color;
    }
    try { setIcon(iconEl, entry.icon); } catch {}
  }

  const label = item.createSpan({ cls: "sm-menu-item-label", text: entry.label });

  item.addEventListener("click", (e) => {
    e.stopPropagation();
    dismissAllMenus();
    (app as any).commands.executeCommandById(entry.commandId);
  });

  return item;
}

function createGroup(name: string, entries: ScriptEntry[], app: App): HTMLElement {
  const group = document.createElement("div");
  group.className = "sm-menu-group";

  const trigger = document.createElement("div");
  trigger.className = "sm-menu-item sm-group-trigger";
  trigger.createSpan({ cls: "sm-menu-item-label", text: name });

  const arrow = trigger.createSpan({ cls: "sm-group-arrow" });
  setIcon(arrow, "chevron-right");

  const submenu = document.createElement("div");
  submenu.className = "sm-submenu";
  for (const entry of entries) {
    submenu.appendChild(createItem(entry, app));
  }

  group.appendChild(trigger);
  group.appendChild(submenu);

  let hideTimeout: number | null = null;
  let showTimeout: number | null = null;

  const saveTimeouts = () => {
    const ids: number[] = [];
    if (showTimeout !== null) ids.push(showTimeout);
    if (hideTimeout !== null) ids.push(hideTimeout);
    group.dataset.smTimeouts = ids.join(",");
  };

  const show = () => {
    if (hideTimeout !== null) clearTimeout(hideTimeout);
    if (showTimeout !== null) clearTimeout(showTimeout);
    showTimeout = window.setTimeout(() => {
      submenu.classList.add("sm-submenu-visible");
      showTimeout = null;
      saveTimeouts();
    }, 150);
    saveTimeouts();
  };

  const hide = () => {
    if (showTimeout !== null) clearTimeout(showTimeout);
    if (hideTimeout !== null) clearTimeout(hideTimeout);
    hideTimeout = window.setTimeout(() => {
      submenu.classList.remove("sm-submenu-visible");
      hideTimeout = null;
      saveTimeouts();
    }, 200);
    saveTimeouts();
  };

  trigger.addEventListener("mouseenter", show);
  trigger.addEventListener("mouseleave", (e) => {
    const related = e.relatedTarget as Node | null;
    if (!related || !submenu.contains(related)) hide();
  });

  submenu.addEventListener("mouseenter", () => {
    if (hideTimeout !== null) clearTimeout(hideTimeout);
    hideTimeout = null;
    submenu.classList.add("sm-submenu-visible");
    saveTimeouts();
  });
  submenu.addEventListener("mouseleave", (e) => {
    const related = e.relatedTarget as Node | null;
    if (!related || !group.contains(related)) hide();
  });

  return group;
}

function createSeparator(): HTMLElement {
  const sep = document.createElement("div");
  sep.className = "sm-menu-separator";
  return sep;
}

function registerDismissHandlers(menuEl: HTMLElement): () => void {
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") dismissAllMenus();
  };

  const onClick = (e: MouseEvent) => {
    if (!menuEl.contains(e.target as Node)) dismissAllMenus();
  };

  document.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("click", onClick, true);

  return () => {
    document.removeEventListener("keydown", onKeyDown, true);
    document.removeEventListener("click", onClick, true);
  };
}
