let base44Client = null;

try {
  const mod = await import("@base44/sdk");
  base44Client = mod.createBase44Client({
    appId: import.meta.env.VITE_BASE44_APP_ID,
  });
} catch {
  base44Client = {
    auth: {
      getMe: async () => null,
      login: async () => ({ user: null }),
      logout: async () => {},
      register: async () => ({ user: null }),
    },
  };
}

export { base44Client };
