import useSWR from "swr";
import { ServersResponse, GpuResponse } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useServersData() {
  return useSWR<ServersResponse>("/api/servers", fetcher, {
    refreshInterval: 2000,
    keepPreviousData: true,
    revalidateOnFocus: false,
  });
}

export function useGpuData() {
  return useSWR<GpuResponse>("/api/gpu", fetcher, {
    refreshInterval: 2000,
    keepPreviousData: true,
    revalidateOnFocus: false,
  });
}
