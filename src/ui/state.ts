import type { DirectoryListing, DomainError, Location, Preview } from "../shared/contracts";

function normalizePath(path: string): string {
  const segments: string[] = [];
  for (const segment of path.split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") segments.pop(); else segments.push(segment);
  }
  return `/${segments.join("/")}`;
}

function parentPath(path: string): string {
  const normalized = normalizePath(path);
  return normalized === "/" ? "/" : normalized.slice(0, normalized.lastIndexOf("/")) || "/";
}

export interface ExplorerServices {
  listDirectory(path: string, showHidden: boolean): Promise<DirectoryListing>;
  getPreview(path: string): Promise<Preview>;
}

type NavigationIntent = "push" | "back" | "forward" | "refresh";

export class ExplorerState {
  locations: Location[] = [];
  currentDirectory: string;
  listing: DirectoryListing | null = null;
  selectedPath: string | null = null;
  preview: Preview | null = null;
  backHistory: string[] = [];
  forwardHistory: string[] = [];
  showHidden = false;
  navigationWidth = 220;
  previewWidth = 340;
  directoryLoading = false;
  previewLoading = false;
  error: DomainError | null = null;
  private directoryRequest = 0;
  private previewRequest = 0;

  constructor(initialDirectory: string, private readonly services: ExplorerServices) {
    this.currentDirectory = normalizePath(initialDirectory);
  }

  async initialize(): Promise<boolean> {
    return this.navigate(this.currentDirectory, "refresh");
  }

  async open(path: string): Promise<boolean> {
    return this.navigate(path, "push");
  }

  async parent(): Promise<boolean> {
    const target = parentPath(this.currentDirectory);
    return target === this.currentDirectory ? true : this.navigate(target, "push");
  }

  async back(): Promise<boolean> {
    const target = this.backHistory.at(-1);
    return target ? this.navigate(target, "back") : false;
  }

  async forward(): Promise<boolean> {
    const target = this.forwardHistory.at(-1);
    return target ? this.navigate(target, "forward") : false;
  }

  async toggleHidden(): Promise<boolean> {
    this.showHidden = !this.showHidden;
    return this.navigate(this.currentDirectory, "refresh");
  }

  clearSelection(): void {
    this.previewRequest++;
    this.selectedPath = null;
    this.preview = null;
    this.previewLoading = false;
  }

  async select(path: string | null): Promise<boolean> {
    this.clearSelection();
    if (!path) return true;
    const request = ++this.previewRequest;
    this.selectedPath = path;
    this.previewLoading = true;
    try {
      const preview = await this.services.getPreview(path);
      if (request !== this.previewRequest || this.selectedPath !== path) return false;
      this.preview = preview;
      this.previewLoading = false;
      return true;
    } catch {
      if (request === this.previewRequest) {
        this.previewLoading = false;
        this.error = { code: "UNAVAILABLE", message: "The selected item is unavailable." };
      }
      return false;
    }
  }

  private async navigate(rawPath: string, intent: NavigationIntent): Promise<boolean> {
    const path = normalizePath(rawPath);
    const request = ++this.directoryRequest;
    this.directoryLoading = true;
    this.error = null;
    try {
      const listing = await this.services.listDirectory(path, this.showHidden);
      if (request !== this.directoryRequest || listing.path !== path) return false;
      const previous = this.currentDirectory;
      if (intent === "push" && path !== previous) {
        this.backHistory.push(previous);
        this.forwardHistory = [];
      } else if (intent === "back") {
        this.backHistory.pop();
        this.forwardHistory.push(previous);
      } else if (intent === "forward") {
        this.forwardHistory.pop();
        this.backHistory.push(previous);
      }
      this.currentDirectory = path;
      this.listing = listing;
      this.clearSelection();
      this.directoryLoading = false;
      return true;
    } catch {
      if (request === this.directoryRequest) {
        this.directoryLoading = false;
        this.error = { code: "UNAVAILABLE", message: "The location is unavailable." };
      }
      return false;
    }
  }
}
