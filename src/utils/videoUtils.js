export const DEFAULT_CATEGORY = "movies";
export const ID_TOKEN_STORAGE_KEY = "id_token";
export const USED_CODE_STORAGE_KEY = "used_code";

export const VIDEO_EXTENSIONS = /\.(mp4|webm|mov|m4v|ogg)$/i;

export const toTitleCase = (value = "") =>
  value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export const formatSize = (bytes) => {
  if (!bytes) return "S3 Video";
  const mb = bytes / (1024 * 1024);
  return `${mb >= 10 ? mb.toFixed(0) : mb.toFixed(1)} MB`;
};

export const buildVideoFromKey = (key, size) => {
  const parts = key.split("/");
  const fileName = parts[parts.length - 1] || "video.mp4";
  const categoryPart = parts.length > 2 ? parts[1] : DEFAULT_CATEGORY;
  const rawTitle = fileName.replace(/\.[^/.]+$/, "").replace(/^\d+-/, "");

  return {
    key,
    title: toTitleCase(rawTitle),
    meta: formatSize(size),
    category: toTitleCase(categoryPart),
  };
};

export const groupVideosByCategory = (videos) => {
  const grouped = videos.reduce((acc, video) => {
    const category = video.category || DEFAULT_CATEGORY;
    if (!acc[category]) acc[category] = [];
    acc[category].push(video);
    return acc;
  }, {});

  return Object.entries(grouped).map(([title, items]) => ({
    title,
    videos: items,
  }));
};

export const getCategoryOptions = (videos) => {
  const options = Array.from(new Set(videos.map((video) => video.category || DEFAULT_CATEGORY)));
  return options.length ? options : [DEFAULT_CATEGORY];
};

export const sanitizeFileName = (name) => name.replace(/\s+/g, "_");

export const sanitizeCategoryForKey = (category) =>
  category
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export const parseGroupsFromToken = (idToken) => {
  try {
    const payload = JSON.parse(atob(idToken.split(".")[1]));
    return payload["cognito:groups"] || [];
  } catch {
    return [];
  }
};
