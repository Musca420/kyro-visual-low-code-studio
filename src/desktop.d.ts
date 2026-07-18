type DesktopWorkspace = {
  root: string;
  name: string;
  files: { path: string; content: string }[];
};

type DesktopUpdateStatus = {
  state: "disabled" | "available" | "rejected";
  message: string;
  version?: string;
  channel?: string;
};

interface Window {
  frontendEditorDesktop?: {
    platform: string;
    readWorkspace: () => Promise<DesktopWorkspace | null>;
    getUpdateStatus: () => Promise<DesktopUpdateStatus>;
    onUpdateStatus: (listener: (status: DesktopUpdateStatus) => void) => () => void;
    onOpenProject: (listener: (path: string) => void) => () => void;
  };
}
