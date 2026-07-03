import { PluginSettingTab, Setting, App, setIcon } from "obsidian";
import { CommandSuggestModal, IconInputModal } from "./modal";
import type ScriptMenusPlugin from "./main";

export interface ScriptEntry {
  label: string;
  commandId: string;
  icon?: string;
}

export interface ModifierConfig {
  alt: boolean;
  ctrl: boolean;
  shift: boolean;
  meta: boolean;
}

export interface MenuProfile {
  name: string;
  modifiers: ModifierConfig;
  submenus: Record<string, ScriptEntry[]>;
  mainMenuCommands: ScriptEntry[];
}

export interface PluginSettings {
  profiles: MenuProfile[];
}

export const DEFAULT_SETTINGS: PluginSettings = {
  profiles: [
    {
      name: "Main",
      modifiers: { alt: true, ctrl: false, shift: false, meta: false },
      submenus: {},
      mainMenuCommands: [],
    },
  ],
};

export class ScriptMenusSettingTab extends PluginSettingTab {
  plugin: ScriptMenusPlugin;

  constructor(app: App, plugin: ScriptMenusPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Script Menus Settings" });
    containerEl.createEl("p", {
      text: "Right-click with a modifier key in the editor to open a custom menu with your commands. If no modifier matches, the default Obsidian context menu appears.",
      cls: "setting-item-description",
    });

    this.renderProfiles();
  }

  private renderProfiles(): void {
    const { containerEl } = this;
    const profiles = this.plugin.settings.profiles;

    containerEl.createEl("h3", { text: "Menu Profiles" });

    const profilesContainer = containerEl.createDiv();
    profilesContainer.style.marginBottom = "16px";

    for (let i = 0; i < profiles.length; i++) {
      this.renderProfileCard(profilesContainer, i);
    }

    if (profiles.length < 8) {
      const addRow = containerEl.createDiv();
      addRow.style.marginTop = "8px";

      const addBtn = addRow.createEl("button", { text: "+ Add profile" });
      addBtn.onclick = async () => {
        const usedModifiers = new Set(
          profiles.map((p) => `${p.modifiers.alt}/${p.modifiers.ctrl}/${p.modifiers.shift}/${p.modifiers.meta}`)
        );

        let combo: ModifierConfig = { alt: false, ctrl: false, shift: false, meta: false };
        for (const m of ["shift", "ctrl", "alt", "meta"] as (keyof ModifierConfig)[]) {
          const test: ModifierConfig = { alt: false, ctrl: false, shift: false, meta: false };
          test[m] = true;
          if (!usedModifiers.has(`${test.alt}/${test.ctrl}/${test.shift}/${test.meta}`)) {
            combo = test;
            break;
          }
        }

        this.plugin.settings.profiles = [
          ...this.plugin.settings.profiles,
          { name: `Profile ${profiles.length + 1}`, modifiers: combo, submenus: {}, mainMenuCommands: [] },
        ];
        await this.plugin.saveSettings();
        this.display();
      };
    }
  }

  private renderProfileCard(container: HTMLElement, index: number): void {
    const profile = this.plugin.settings.profiles[index];

    const card = container.createDiv();
    card.style.cssText = `
      border: 1px solid var(--background-modifier-border);
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 12px;
    `;

    const header = card.createDiv();
    header.style.cssText = "display: flex; align-items: center; gap: 8px; margin-bottom: 12px;";

    const nameInput = header.createEl("input", { type: "text", value: profile.name });
    nameInput.style.cssText = "flex: 1; font-weight: bold; background: var(--background-primary);";
    nameInput.placeholder = "Profile name";
    nameInput.onchange = async () => {
      this.plugin.settings.profiles[index].name = nameInput.value;
      await this.plugin.saveSettings();
    };

    if (this.plugin.settings.profiles.length > 1) {
      const removeBtn = header.createEl("button", { text: "× Remove" });
      removeBtn.style.cssText = "background: transparent; border: none; cursor: pointer; color: var(--text-muted); font-size: 12px;";
      removeBtn.onclick = async () => {
        this.plugin.settings.profiles = [
          ...this.plugin.settings.profiles.slice(0, index),
          ...this.plugin.settings.profiles.slice(index + 1),
        ];
        await this.plugin.saveSettings();
        this.display();
      };
    }

    const modLabel = card.createEl("span", { text: "Modifier combination:" });
    modLabel.style.cssText = "font-size: 12px; color: var(--text-muted); margin-bottom: 6px; display: block;";

    const modRow = card.createDiv();
    modRow.style.cssText = "display: flex; gap: 16px; margin-bottom: 16px;";

    const renderModCheckbox = (label: string, key: keyof ModifierConfig) => {
      const labelEl = modRow.createEl("label");
      labelEl.style.cssText = "display: flex; align-items: center; gap: 4px; cursor: pointer; font-size: 13px;";
      const cb = labelEl.createEl("input", { type: "checkbox" });
      cb.checked = profile.modifiers[key];
      cb.onchange = async () => {
        this.plugin.settings.profiles[index].modifiers[key] = cb.checked;
        await this.plugin.saveSettings();
      };
      labelEl.append(` ${label}`);
    };

    renderModCheckbox("Alt", "alt");
    renderModCheckbox("Ctrl", "ctrl");
    renderModCheckbox("Shift", "shift");
    renderModCheckbox("Meta", "meta");

    this.renderSubmenus(card, index);
    this.renderMainCommands(card, index);
  }

  private renderSubmenus(container: HTMLElement, profileIndex: number): void {
    const profile = this.plugin.settings.profiles[profileIndex];

    container.createEl("h4", { text: "Submenus" });
    const desc = container.createEl("p", {
      text: "Named groups shown as submenus in the menu.",
      cls: "setting-item-description",
    });

    const sectionContainer = container.createDiv();
    sectionContainer.style.marginBottom = "8px";

    const renderSubmenuSections = () => {
      const existing = sectionContainer.querySelectorAll(".sm-submenu-section");
      Array.from(existing).forEach((el) => el.remove());

      for (const [sectionName, entries] of Object.entries(profile.submenus)) {
        const sectionDiv = sectionContainer.createDiv();
        sectionDiv.className = "sm-submenu-section";
        sectionDiv.style.cssText = "margin-bottom: 8px; border: 1px solid var(--background-modifier-border); border-radius: 4px; padding: 8px;";

        const headerRow = sectionDiv.createDiv();
        headerRow.style.cssText = "display: flex; gap: 8px; align-items: center; margin-bottom: 8px;";

        const title = headerRow.createEl("span", { text: sectionName });
        title.style.cssText = "font-weight: bold; flex: 1;";

        const removeBtn = headerRow.createEl("button", { text: "× Remove section" });
        removeBtn.style.cssText = "background: transparent; border: none; cursor: pointer; color: var(--text-muted); font-size: 12px;";
        removeBtn.onclick = async () => {
          const next = { ...this.plugin.settings.profiles[profileIndex].submenus };
          delete next[sectionName];
          this.plugin.settings.profiles[profileIndex].submenus = next;
          await this.plugin.saveSettings();
          renderSubmenuSections();
        };

        const entriesDiv = sectionDiv.createDiv();
        for (let i = 0; i < entries.length; i++) {
          this.renderEntryRow(entriesDiv, entries, i, () => this.plugin.settings.profiles[profileIndex].submenus[sectionName], renderSubmenuSections);
        }

        const addCmdRow = sectionDiv.createDiv();
        addCmdRow.style.marginTop = "4px";
        const addCmdBtn = addCmdRow.createEl("button", { text: "+ Add command" });
        addCmdBtn.onclick = async () => {
          entries.push({ label: "New command", commandId: "" });
          this.plugin.settings.profiles[profileIndex].submenus = { ...this.plugin.settings.profiles[profileIndex].submenus };
          await this.plugin.saveSettings();
          renderSubmenuSections();
        };
      }
    };

    const addSectionRow = sectionContainer.createDiv();
    addSectionRow.style.cssText = "display: flex; gap: 8px; align-items: center; margin-bottom: 12px;";

    const sectionNameInput = addSectionRow.createEl("input", { type: "text" });
    sectionNameInput.placeholder = "Section name (e.g. Utils, Format...)";
    sectionNameInput.style.cssText = "flex: 1; background: var(--background-primary);";

    const addBtn = addSectionRow.createEl("button", { text: "+ Add section" });
    addBtn.onclick = async () => {
      const name = sectionNameInput.value.trim();
      if (!name) return;
      if (profile.submenus[name]) return;
      this.plugin.settings.profiles[profileIndex].submenus = {
        ...this.plugin.settings.profiles[profileIndex].submenus,
        [name]: [],
      };
      await this.plugin.saveSettings();
      sectionNameInput.value = "";
      renderSubmenuSections();
    };

    renderSubmenuSections();
  }

  private renderMainCommands(container: HTMLElement, profileIndex: number): void {
    const profile = this.plugin.settings.profiles[profileIndex];

    container.createEl("h4", { text: "Main commands" });
    container.createEl("p", {
      text: "Commands shown at the top of the menu, outside any submenu.",
      cls: "setting-item-description",
    });

    const cmdContainer = container.createDiv();
    cmdContainer.style.marginBottom = "8px";

    const render = () => {
      cmdContainer.empty();
      const list = this.plugin.settings.profiles[profileIndex].mainMenuCommands;

      for (let i = 0; i < list.length; i++) {
        this.renderEntryRow(cmdContainer, list, i, () => this.plugin.settings.profiles[profileIndex].mainMenuCommands, render);
      }

      const addRow = cmdContainer.createDiv();
      addRow.style.marginTop = "8px";
      const addBtn = addRow.createEl("button", { text: "+ Add command" });
      addBtn.onclick = async () => {
        this.plugin.settings.profiles[profileIndex].mainMenuCommands = [
          ...this.plugin.settings.profiles[profileIndex].mainMenuCommands,
          { label: "New command", commandId: "" },
        ];
        await this.plugin.saveSettings();
        render();
      };
    };

    render();
  }

  private renderEntryRow(
    container: HTMLElement,
    list: ScriptEntry[],
    index: number,
    getList: () => ScriptEntry[],
    onRemove?: () => void
  ): void {
    const row = container.createDiv();
    row.style.cssText = "display: flex; gap: 8px; align-items: center; margin-bottom: 4px;";

    const labelInput = row.createEl("input", { type: "text" });
    labelInput.value = list[index].label;
    labelInput.style.cssText = "flex: 1; background: var(--background-primary);";
    labelInput.placeholder = "Label (e.g. My script)";

    const iconBtn = row.createEl("button");
    iconBtn.style.cssText = "width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; background: transparent; border: 1px solid var(--background-modifier-border); border-radius: 4px; cursor: pointer; color: var(--text-muted); flex-shrink: 0;";
    iconBtn.title = "Choose icon";
    const renderIcon = () => {
      iconBtn.empty();
      if (list[index].icon) {
        setIcon(iconBtn, list[index].icon!);
      } else {
        iconBtn.setText("?");
      }
    };
    renderIcon();
    iconBtn.onclick = () => {
      new IconInputModal(this.app, list[index].icon || "", (iconName) => {
        list[index].icon = iconName || undefined;
        getList();
        renderIcon();
        this.plugin.saveSettings();
      }).open();
    };

    const cmdInput = row.createEl("input", { type: "text" });
    cmdInput.value = list[index].commandId;
    cmdInput.style.cssText = "flex: 1; background: var(--background-primary);";
    cmdInput.placeholder = "Command ID (e.g. my-plugin:action)";

    const searchBtn = row.createEl("button", { text: "Find..." });
    searchBtn.style.cssText = "background: transparent; border: none; cursor: pointer; color: var(--text-muted); font-size: 12px;";
    searchBtn.title = "Search for a command";
    searchBtn.onclick = () => {
      new CommandSuggestModal(this.app, (command) => {
        labelInput.value = command.name;
        cmdInput.value = command.id;
        list[index].label = command.name;
        list[index].commandId = command.id;
        this.plugin.saveSettings();
      }).open();
    };

    const removeBtn = row.createEl("button", { text: "×" });
    removeBtn.style.cssText = "background: transparent; border: none; cursor: pointer; color: var(--text-muted);";
    removeBtn.onclick = async () => {
      const updated = [...list.slice(0, index), ...list.slice(index + 1)];
      for (let j = 0; j < updated.length; j++) list[j] = updated[j];
      list.length = updated.length;
      await this.plugin.saveSettings();
      if (onRemove) onRemove();
    };

    labelInput.onchange = async () => {
      list[index].label = labelInput.value;
      await this.plugin.saveSettings();
    };
    cmdInput.onchange = async () => {
      list[index].commandId = cmdInput.value;
      await this.plugin.saveSettings();
    };
  }
}
