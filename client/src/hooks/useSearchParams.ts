import { useCallback, useMemo, useSyncExternalStore } from "react";

/**
 * Custom hook that provides URL search params functionality for wouter.
 * Ensures URL is the single source of truth for filter state.
 *
 * @returns [URLSearchParams, setSearchParams] tuple
 */
export function useSearchParams(): [
  URLSearchParams,
  (
    params: URLSearchParams | ((prev: URLSearchParams) => URLSearchParams),
    options?: { replace?: boolean }
  ) => void
] {
  // Subscribe to URL changes
  const subscribe = useCallback((callback: () => void) => {
    window.addEventListener("popstate", callback);
    return () => window.removeEventListener("popstate", callback);
  }, []);

  // Get current search params
  const getSnapshot = useCallback(() => {
    return window.location.search;
  }, []);

  // SSR fallback
  const getServerSnapshot = useCallback(() => {
    return "";
  }, []);

  const searchString = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Parse search params
  const searchParams = useMemo(() => {
    return new URLSearchParams(searchString);
  }, [searchString]);

  // Set search params function
  const setSearchParams = useCallback(
    (
      paramsOrUpdater:
        | URLSearchParams
        | ((prev: URLSearchParams) => URLSearchParams),
      options: { replace?: boolean } = {}
    ) => {
      const newParams =
        typeof paramsOrUpdater === "function"
          ? paramsOrUpdater(new URLSearchParams(window.location.search))
          : paramsOrUpdater;

      const newUrl = `${window.location.pathname}${
        newParams.toString() ? `?${newParams.toString()}` : ""
      }`;

      if (options.replace) {
        window.history.replaceState({}, "", newUrl);
      } else {
        window.history.pushState({}, "", newUrl);
      }

      // Trigger re-render by dispatching popstate
      window.dispatchEvent(new PopStateEvent("popstate"));
    },
    []
  );

  return [searchParams, setSearchParams];
}

/**
 * Helper hook to get a single search param value with a fallback
 */
export function useSearchParam(key: string, fallback: string = ""): string {
  const [searchParams] = useSearchParams();
  return searchParams.get(key) || fallback;
}
