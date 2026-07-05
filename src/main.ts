import { Plugin, MarkdownView } from "obsidian";
import { DEFAULT_SETTINGS, ScriptMenusSettingTab } from "./settings";
import type { PluginSettings, ScriptEntry } from "./settings";
import { showContextMenu, dismissAllMenus } from "./context-menu";

export default class ScriptMenusPlugin extends Plugin {
  settings: PluginSettings;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.addSettingTab(new ScriptMenusSettingTab(this.app, this));

    this.registerDomEvent(document, "contextmenu", (ev: MouseEvent) => {
      dismissAllMenus();
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!view) return;
      if (view.getMode() !== "source") return;

      try {
        for (const profile of this.settings.profiles) {
          if (
            ev.altKey === profile.modifiers.alt &&
            ev.ctrlKey === profile.modifiers.ctrl &&
            ev.shiftKey === profile.modifiers.shift &&
            ev.metaKey === profile.modifiers.meta
          ) {
            ev.preventDefault();
            ev.stopPropagation();
            showContextMenu(ev, profile, this.app);
            return;
          }
        }
      } catch {}
    }, true);
  }

  onunload(): void {
    dismissAllMenus();
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    for (const profile of this.settings.profiles) {
      if (profile.submenus && !Array.isArray(profile.submenus)) {
        const old = profile.submenus as any;
        profile.submenus = Object.entries(old).map(([label, entries]) => ({
          label,
          entries: (entries as ScriptEntry[]) || [],
        }));
      }
    }
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
