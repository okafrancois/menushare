export type NormalizedExternalVideo = {
  provider: "youtube" | "vimeo";
  externalId: string;
  embedUrl: string;
};

const YOUTUBE_ID = /^[A-Za-z0-9_-]{6,20}$/;
const VIMEO_ID = /^\d{5,15}$/;

export function normalizeExternalVideoUrl(
  input: string,
): NormalizedExternalVideo {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error("INVALID_VIDEO_URL");
  }

  if (url.protocol !== "https:") throw new Error("INVALID_VIDEO_URL");
  const host = url.hostname.toLowerCase().replace(/^www\./, "");

  if (host === "youtu.be") {
    return youtube(url.pathname.split("/").filter(Boolean)[0]);
  }

  if (
    host === "youtube.com" ||
    host === "m.youtube.com" ||
    host === "youtube-nocookie.com"
  ) {
    if (url.pathname === "/watch") return youtube(url.searchParams.get("v"));
    const [kind, id] = url.pathname.split("/").filter(Boolean);
    if (kind === "shorts" || kind === "embed") return youtube(id);
  }

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    const id = parts.find((part) => VIMEO_ID.test(part));
    if (!id) throw new Error("INVALID_VIDEO_URL");
    return {
      provider: "vimeo",
      externalId: id,
      embedUrl: `https://player.vimeo.com/video/${id}?dnt=1`,
    };
  }

  throw new Error("UNSUPPORTED_VIDEO_PROVIDER");
}

function youtube(id: string | null | undefined): NormalizedExternalVideo {
  if (!id || !YOUTUBE_ID.test(id)) throw new Error("INVALID_VIDEO_URL");
  return {
    provider: "youtube",
    externalId: id,
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
  };
}
