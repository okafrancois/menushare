"use client";

import { api } from "@repo/backend/api";
import { useMutation } from "convex/react";
import type { FunctionArgs } from "convex/server";
import {
  createContext,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";

import {
  randomId,
  readVisitSource,
  VIDEO_COMPLETION_RATIO,
  VISITOR_STORAGE_KEY,
  visitorIdFrom,
} from "@/lib/menu-analytics";
import type { ExternalVideo } from "@/lib/menu-domain";
import { usePrivacyPreference } from "@/lib/privacy-preferences";

type TrackEvent = FunctionArgs<typeof api.analytics.track>["event"];

type MenuTracker = {
  enabled: boolean;
  itemOpen: (itemId: string) => void;
  videoPlay: (itemId?: string) => void;
  videoComplete: (itemId?: string) => void;
};

const disabledTracker: MenuTracker = {
  enabled: false,
  itemOpen() {},
  videoPlay() {},
  videoComplete() {},
};

const MenuTrackerContext = createContext<MenuTracker>(disabledTracker);

export function useMenuTracker() {
  return useContext(MenuTrackerContext);
}

const HEARTBEAT_MS = 30_000;

function readVisitorId(venueId: string) {
  const key = `${VISITOR_STORAGE_KEY}.${venueId}`;
  try {
    const visitor = visitorIdFrom(
      localStorage.getItem(key),
      Date.now(),
      randomId,
    );
    if (visitor.stored) localStorage.setItem(key, visitor.stored);
    return visitor.id;
  } catch {
    // Private browsing can block storage: the visit is still counted once.
    return randomId();
  }
}

/** Anonymous audience measurement of a published menu (no cookie, no IP). */
export function MenuTrackerProvider(props: {
  venueId: string;
  children: ReactNode;
}) {
  const allowed = usePrivacyPreference("analytics");
  return allowed ? <ActiveMenuTrackerProvider {...props} /> : props.children;
}

function ActiveMenuTrackerProvider({
  venueId,
  children,
}: {
  venueId: string;
  children: ReactNode;
}) {
  const track = useMutation(api.analytics.track);
  const sessionId = useRef<string | null>(null);
  const sessionVenueId = useRef<string | null>(null);
  const activeMs = useRef(0);

  const send = useCallback(
    (event: TrackEvent) => {
      if (!sessionId.current) return;
      // Measurement must never disturb the menu.
      track({ sessionId: sessionId.current, event }).catch(() => undefined);
    },
    [track],
  );

  const tracker = useMemo<MenuTracker>(
    () => ({
      enabled: true,
      itemOpen: (itemId) => send({ type: "itemOpen", itemId }),
      videoPlay: (itemId) => send({ type: "videoPlay", itemId }),
      videoComplete: (itemId) => send({ type: "videoComplete", itemId }),
    }),
    [send],
  );

  useEffect(() => {
    // Survives StrictMode's double effect; a different venue is a new visit.
    if (sessionVenueId.current !== venueId) {
      sessionId.current = randomId();
      sessionVenueId.current = venueId;
      activeMs.current = 0;
      const visit = readVisitSource(window.location.search);
      if (visit.cleanedSearch !== window.location.search) {
        window.history.replaceState(
          window.history.state,
          "",
          `${window.location.pathname}${visit.cleanedSearch}${window.location.hash}`,
        );
      }
      send({
        type: "start",
        venueId,
        visitorId: readVisitorId(venueId),
        source: visit.source,
        table: visit.table,
      });
    }

    let visibleSince =
      document.visibilityState === "visible" ? performance.now() : null;
    const settle = () => {
      if (visibleSince === null) return;
      const now = performance.now();
      activeMs.current += now - visibleSince;
      visibleSince = now;
    };
    const heartbeat = () => {
      settle();
      send({ type: "heartbeat", activeMs: Math.round(activeMs.current) });
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        visibleSince = performance.now();
      } else {
        heartbeat();
        visibleSince = null;
      }
    };
    const interval = window.setInterval(() => {
      if (visibleSince !== null) heartbeat();
    }, HEARTBEAT_MS);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", heartbeat);
    return () => {
      settle();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", heartbeat);
    };
  }, [send, venueId]);

  return (
    <MenuTrackerContext.Provider value={tracker}>
      {children}
    </MenuTrackerContext.Provider>
  );
}

type YouTubePlayer = { getCurrentTime(): number; getDuration(): number };
type YouTubeNamespace = {
  Player: new (
    element: HTMLIFrameElement,
    options: { events: { onStateChange: (event: { data: number }) => void } },
  ) => YouTubePlayer;
};

declare global {
  interface Window {
    YT?: YouTubeNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youTubeApi: Promise<YouTubeNamespace> | null = null;

function loadYouTubeApi() {
  youTubeApi ??= new Promise<YouTubeNamespace>((resolve, reject) => {
    if (window.YT?.Player) return resolve(window.YT);
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT) resolve(window.YT);
    };
    const src = "https://www.youtube.com/iframe_api";
    // The API may already be loading (e.g. from a previous failed attempt).
    if (window.YT || document.querySelector(`script[src="${src}"]`)) return;
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onerror = () => {
      youTubeApi = null;
      reject(new Error("YOUTUBE_API_UNAVAILABLE"));
    };
    document.head.append(script);
  });
  return youTubeApi;
}

type PlaybackHandlers = {
  onPlay: () => void;
  onProgress: (ratio: number) => void;
};

function watchYouTube(
  iframe: HTMLIFrameElement,
  { onPlay, onProgress }: PlaybackHandlers,
) {
  let cancelled = false;
  let poll: number | undefined;
  const stopPolling = () => window.clearInterval(poll);
  loadYouTubeApi()
    .then((YT) => {
      if (cancelled) return;
      // Destroying the player would remove React's iframe: handlers are
      // simply ignored once the frame is gone.
      const player = new YT.Player(iframe, {
        events: {
          onStateChange: ({ data }) => {
            if (cancelled) return;
            stopPolling();
            if (data === 0) onProgress(1);
            if (data !== 1) return;
            onPlay();
            poll = window.setInterval(() => {
              const duration = player.getDuration();
              if (duration > 0) onProgress(player.getCurrentTime() / duration);
            }, 1000);
          },
        },
      });
    })
    .catch(() => undefined);
  return () => {
    cancelled = true;
    stopPolling();
  };
}

function watchVimeo(
  iframe: HTMLIFrameElement,
  { onPlay, onProgress }: PlaybackHandlers,
) {
  let cleanup = () => {};
  let cancelled = false;
  import("@vimeo/player")
    .then(({ default: Player }) => {
      if (cancelled) return;
      const player = new Player(iframe);
      const onTimeUpdate = ({ percent }: { percent: number }) =>
        onProgress(percent);
      const onEnded = () => onProgress(1);
      player.on("play", onPlay);
      player.on("timeupdate", onTimeUpdate);
      player.on("ended", onEnded);
      player.ready().catch(() => undefined);
      cleanup = () => {
        player.off("play", onPlay);
        player.off("timeupdate", onTimeUpdate);
        player.off("ended", onEnded);
      };
    })
    .catch(() => undefined);
  return () => {
    cancelled = true;
    cleanup();
  };
}

/** Reports the first play and the completion of a video, once per opening. */
export function useVideoTracking(
  iframeRef: RefObject<HTMLIFrameElement | null>,
  video: ExternalVideo,
  itemId?: string,
) {
  const tracker = useMenuTracker();

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!tracker.enabled || !iframe) return;
    let played = false;
    let completed = false;
    const handlers: PlaybackHandlers = {
      onPlay() {
        if (played) return;
        played = true;
        tracker.videoPlay(itemId);
      },
      onProgress(ratio) {
        if (!played || completed || ratio < VIDEO_COMPLETION_RATIO) return;
        completed = true;
        tracker.videoComplete(itemId);
      },
    };
    return video.provider === "youtube"
      ? watchYouTube(iframe, handlers)
      : watchVimeo(iframe, handlers);
  }, [iframeRef, itemId, tracker, video.provider, video.embedUrl]);
}
