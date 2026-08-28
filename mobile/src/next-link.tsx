import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";
import { useMobileRouter } from "./router";

type MobileLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string | { pathname?: string; query?: Record<string, string> };
  children: ReactNode;
  prefetch?: boolean;
  replace?: boolean;
  scroll?: boolean;
  shallow?: boolean;
  locale?: string | false;
};

function hrefValue(href: MobileLinkProps["href"]) {
  if (typeof href === "string") return href;
  const params = new URLSearchParams(href.query);
  const query = params.toString();
  return `${href.pathname ?? "/"}${query ? `?${query}` : ""}`;
}

export default function Link({ href, onClick, children, prefetch, replace, scroll, shallow, locale, ...props }: MobileLinkProps) {
  void [prefetch, replace, scroll, shallow, locale];
  const router = useMobileRouter();
  const value = hrefValue(href);
  function navigate(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    router.navigate(value);
  }
  return <a {...props} href={`#${value}`} onClick={navigate}>{children}</a>;
}
