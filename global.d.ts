export {};

declare global {
  interface Window {
    electronAPI: {
      getMachineId: () => Promise<string> | string;
    };
  }
}
