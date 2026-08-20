import { useMobileRouter } from "./router";

export function usePathname() {
  return useMobileRouter().pathname;
}

export function useRouter() {
  const route = useMobileRouter();
  return {
    refresh: route.refresh,
    push: route.navigate,
    replace: route.navigate,
  };
}
