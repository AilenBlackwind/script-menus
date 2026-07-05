import { App, setIcon } from "obsidian";
import { computePosition, flip, shift, offset, size } from "@floating-ui/dom";
import type { MenuProfile, ScriptEntry, SubmenuSection } from "./settings";

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

  const validMain = profile.mainMenuCommands.filter((e) => e.commandId || e.isSeparator);

  const validSubmenus = profile.submenus.filter((s) =>
    s.entries.some((e) => e.commandId || e.isSeparator)
  );

  if (validMain.length === 0 && validSubmenus.length === 0) {
    const empty = menu.createDiv({ cls: "sm-menu-empty", text: "No commands configured" });
    empty.style.cssText = "padding: 12px 16px; color: var(--text-muted); font-size: 12px; text-align: center;";
    return menu;
  }

  for (const cmd of validMain) {
    menu.appendChild(createItem(cmd, app));
  }

  for (const section of validSubmenus) {
    const valid = section.entries.filter((e) => e.commandId || e.isSeparator);
    menu.appendChild(createGroup(section, valid, app));
  }

  return menu;
}

function createItem(entry: ScriptEntry, app: App): HTMLElement {
  if (entry.isSeparator) return createSeparator();

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

function createGroup(section: SubmenuSection, entries: ScriptEntry[], app: App): HTMLElement {
  const group = document.createElement("div");
  group.className = "sm-menu-group";

  const trigger = document.createElement("div");
  trigger.className = "sm-menu-item sm-group-trigger";
  if (section.color) trigger.style.color = section.color;
  if (section.icon) {
    const iconEl = trigger.createSpan({ cls: "sm-menu-item-icon" });
    if (section.color) iconEl.style.color = section.color;
    try { setIcon(iconEl, section.icon); } catch {}
  }
  trigger.createSpan({ cls: "sm-menu-item-label", text: section.label });

  const arrow = trigger.createSpan({ cls: "sm-group-arrow" });
  setIcon(arrow, "chevron-right");

  const submenu = document.createElement("div");
  submenu.className = "sm-submenu";
  submenu.setAttribute("data-sm-menu", "");
  submenu.style.position = "fixed";
  submenu.style.zIndex = "calc(var(--layer-menu) + 2)";

  for (const entry of entries) {
    submenu.appendChild(createItem(entry, app));
  }

  submenu.addEventListener("click", (e) => e.stopPropagation());

  group.appendChild(trigger);

  let hideTimeout: number | null = null;
  let showTimeout: number | null = null;

  const saveTimeouts = () => {
    const ids: number[] = [];
    if (showTimeout !== null) ids.push(showTimeout);
    if (hideTimeout !== null) ids.push(hideTimeout);
    group.dataset.smTimeouts = ids.join(",");
  };

  const positionAndShow = () => {
    document.body.appendChild(submenu);
    computePosition(trigger, submenu, {
      placement: "right-start",
      middleware: [
        offset(4),
        flip({ padding: 10 }),
        shift({ padding: 10 }),
        size({
          apply({ availableHeight }) {
            submenu.style.maxHeight = `${Math.max(Math.min(availableHeight - 16, 600), 100)}px`;
            submenu.style.overflowY = "auto";
          },
          padding: 8,
        }),
      ],
    }).then(({ x, y }) => {
      submenu.style.left = `${Math.floor(x)}px`;
      submenu.style.top = `${Math.floor(y)}px`;
      submenu.classList.add("sm-submenu-visible");
    });
  };

  const show = () => {
    if (hideTimeout !== null) clearTimeout(hideTimeout);
    if (showTimeout !== null) clearTimeout(showTimeout);
    showTimeout = window.setTimeout(() => {
      positionAndShow();
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
      if (submenu.parentElement) submenu.remove();
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
