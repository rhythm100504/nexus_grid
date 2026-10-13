import { useEffect, useState } from "react";
import axios from "axios";

// Read-only presentation of existing endpoints. POST contracts remain in App.
export function useResource<T>(path: string, enabled: boolean) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let pending = false;
    const load = async () => {
      if (pending) return;
      pending = true;
      setLoading(true);
      try {
        const response = await axios.get<T>(
          `/api/${path}`,
          { signal: controller.signal },
        );
        if (!controller.signal.aborted) {
          setData(response.data);
          setError("");
        }
      } catch (failure) {
        if (!axios.isCancel(failure) && !controller.signal.aborted)
          setError(`Unable to load ${path}. Check the API connection.`);
      } finally {
        pending = false;
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    const interval = window.setInterval(load, 15000);
    window.addEventListener("resources-changed", load);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      window.removeEventListener("resources-changed", load);
    };
  }, [path, enabled]);
  return { data, error, loading };
}
