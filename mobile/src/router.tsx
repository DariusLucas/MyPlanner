import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type MobileRoute = {
  href: string;
  pathname: string;
  searchParams: URLSearchParams;
  revision: number;
  navigate: (href: string) => void;
  refresh: () => void;
};

const RouterContext = createContext<MobileRoute | null>(null);

function currentHref() {
  const hash = window.location.hash.replace(/^#/, "");
  return hash.startsWith("/") ? hash : "/";
}

export function MobileRouterProvider({ children }: { children: ReactNode }) {
  const [href, setHref] = useState(currentHref);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const onHashChange = () => setHref(currentHref());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const navigate = useCallback((nextHref: string) => {
    if (currentHref() === nextHref) {
      setHref(nextHref);
      return;
    }
    window.location.hash = nextHref;
  }, []);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  const value = useMemo(() => {
    const [pathname = "/", query = ""] = href.split("?");
    return {
      href,
      pathname,
      searchParams: new URLSearchParams(query),
      revision,
      navigate,
      refresh,
    };
  }, [href, navigate, refresh, revision]);

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useMobileRouter() {
  const route = useContext(RouterContext);
  if (!route) throw new Error("Mobile router is unavailable.");
  return route;
}
