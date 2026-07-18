type DesktopWorkspace = {
  root: string;
  name: string;
  files: { path: string; content: string }[];
};

interface Window {
  frontendEditorDesktop?: {
    platform: string;
    readWorkspace: () => Promise<DesktopWorkspace | null>;
    onOpenProject: (listener: (path: string) => void) => () => void;
  };
}

