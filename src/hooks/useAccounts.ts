import { useQuery } from "@tanstack/react-query";

export const useAccounts = () => {
  return useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const res = await fetch("/api/accounts");
      if (!res.ok) {
        throw new Error("Gagal mengambil data akun");
      }
      return res.json();
    },
  });
};
