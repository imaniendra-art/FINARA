import { useQuery } from "@tanstack/react-query";

interface LedgerParams {
  accountId: string;
  startDate: string;
  endDate: string;
}

export const useLedger = (params: LedgerParams) => {
  return useQuery({
    queryKey: ["ledger", params],
    queryFn: async () => {
      if (!params.accountId || !params.startDate || !params.endDate) {
        return null;
      }
      
      const searchParams = new URLSearchParams({
        accountId: params.accountId,
        startDate: params.startDate,
        endDate: params.endDate,
      });

      const res = await fetch(`/api/ledger?${searchParams.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Gagal mengambil data buku besar");
      }

      return data;
    },
    enabled: !!params.accountId && !!params.startDate && !!params.endDate,
  });
};
