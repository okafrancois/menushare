"use client";

import { useRef } from "react";

import { CloseButton, Sheet } from "@/components/menu/menu-sheet";
import {
  useMenuTracker,
  useVideoTracking,
} from "@/components/menu/menu-tracker";
import { playerApiUrl } from "@/lib/menu-analytics";
import type { ExternalVideo } from "@/lib/menu-domain";
import { usePrivacyPreference } from "@/lib/privacy-preferences";
import { useState } from "react";
import Link from "next/link";

export function VideoFrame({
  title,
  video,
  itemId,
  autoplay = false,
}: {
  title: string;
  video: ExternalVideo;
  itemId?: string;
  autoplay?: boolean;
}) {
  const allowed = usePrivacyPreference("videos");
  const [once, setOnce] = useState(false);
  if (!allowed && !once)
    return (
      <div className="video-permission">
        <strong>
          Lire avec {video.provider === "youtube" ? "YouTube" : "Vimeo"}
        </strong>
        <p>Le lecteur externe recevra vos informations de connexion.</p>
        <button className="pm-btn primary" onClick={() => setOnce(true)}>
          Lire cette vidéo
        </button>
        <Link href="/privacy">Gérer mes préférences</Link>
      </div>
    );
  return (
    <AllowedVideoFrame
      title={title}
      video={video}
      itemId={itemId}
      autoplay={autoplay}
    />
  );
}

function AllowedVideoFrame({
  title,
  video,
  itemId,
  autoplay,
}: {
  title: string;
  video: ExternalVideo;
  itemId?: string;
  autoplay: boolean;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { enabled } = useMenuTracker();
  useVideoTracking(iframeRef, video, itemId);
  const base = enabled
    ? playerApiUrl(video, window.location.origin)
    : video.embedUrl;
  const src = autoplay
    ? `${base}${base.includes("?") ? "&" : "?"}autoplay=1`
    : base;
  return (
    <iframe
      ref={iframeRef}
      data-testid="video-frame"
      src={src}
      title={title}
      allow="autoplay; encrypted-media; picture-in-picture"
      allowFullScreen
    />
  );
}

export function VideoModal({
  title,
  video,
  onClose,
}: {
  title: string;
  video: ExternalVideo;
  onClose: () => void;
}) {
  return (
    <Sheet onClose={onClose} label={title} variant="night">
      <CloseButton onClose={onClose} className="pm-close on-media" />
      <div className="pm-video-frame">
        <VideoFrame title={title} video={video} autoplay />
      </div>
    </Sheet>
  );
}
