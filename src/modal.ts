import { App, FuzzySuggestModal, Command, Modal, setIcon } from "obsidian";

export class CommandSuggestModal extends FuzzySuggestModal<Command> {
  private onSelect: (command: Command) => void;

  constructor(app: App, onSelect: (command: Command) => void) {
    super(app);
    this.onSelect = onSelect;
    this.setPlaceholder("Type to search for a command...");
    this.setInstructions([
      { command: "\u2191\u2193", purpose: "Navigate" },
      { command: "\u21B5", purpose: "Select command" },
      { command: "esc", purpose: "Close" },
    ]);
  }

  getItems(): Command[] {
    return (this.app as any).commands.listCommands();
  }

  getItemText(command: Command): string {
    return command.name;
  }

  onChooseItem(command: Command): void {
    this.onSelect(command);
  }
}

export class IconInputModal extends Modal {
  private onSelect: (iconName: string) => void;
  private currentIcon: string;

  constructor(app: App, currentIcon: string, onSelect: (iconName: string) => void) {
    super(app);
    this.currentIcon = currentIcon;
    this.onSelect = onSelect;
    this.setTitle("Choose icon");
  }

  onOpen(): void {
    const { contentEl } = this;

    const desc = contentEl.createEl("p", {
      text: "Enter a Lucide icon name (e.g. 'star', 'trash-2', 'settings').",
    });
    desc.style.cssText = "font-size: 12px; color: var(--text-muted); margin-bottom: 12px;";

    const previewRow = contentEl.createDiv();
    previewRow.style.cssText = "display: flex; align-items: center; gap: 12px; margin-bottom: 12px;";

    const previewIcon = previewRow.createSpan();
    previewIcon.style.cssText = "width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;";
    const previewLabel = previewRow.createSpan();
    previewLabel.style.cssText = "font-size: 13px; color: var(--text-muted);";

    const input = contentEl.createEl("input", { type: "text" });
    input.value = this.currentIcon;
    input.placeholder = "e.g. star, trash-2, settings";
    input.style.cssText = "width: 100%; background: var(--background-primary); margin-bottom: 16px;";

    const updatePreview = () => {
      previewIcon.empty();
      previewLabel.setText("");
      if (input.value.trim()) {
        try {
          setIcon(previewIcon, input.value.trim());
          previewLabel.setText(input.value.trim());
        } catch {
          previewLabel.setText(`"${input.value.trim()}" not found`);
        }
      }
    };
    updatePreview();
    input.addEventListener("input", updatePreview);

    const btnRow = contentEl.createDiv();
    btnRow.style.cssText = "display: flex; justify-content: flex-end; gap: 8px;";

    const clearBtn = btnRow.createEl("button", { text: "Clear" });
    clearBtn.onclick = () => {
      this.onSelect("");
      this.close();
    };

    const applyBtn = btnRow.createEl("button", { text: "Apply", cls: "mod-cta" });
    applyBtn.onclick = () => {
      this.onSelect(input.value.trim());
      this.close();
    };

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") applyBtn.click();
    });

    setTimeout(() => input.focus(), 100);
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
