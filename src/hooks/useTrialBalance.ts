import { useQuery } from "@tanstack/react-query";

interface TrialBalanceParams {
  endDate: string;
}

export const useTrialBalance = (params: TrialBalanceParams) => {
  return useQuery({
    queryKey: ["trial-balance", params],
    queryFn: async () => {
      if (!params.endDate) {
        return null;
      }
      
      const searchParams = new URLSearchParams({
        endDate: params.endDate,
      });

      const res = await fetch(`/api/trial-balance?${searchParams.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Gagal mengambil data neraca saldo");
      }

      return data;
    },
    enabled: !!params.endDate,
  });
};
