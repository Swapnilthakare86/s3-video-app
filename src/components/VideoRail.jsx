import React from "react";

function VideoRail({
  title,
  videos,
  activeVideoKey,
  previewUrls,
  onSelect,
  isAdmin,
  onDeleteRequest,
}) {
  return (
    <section className="row">
      <div className="row-head">
        <h4>{title}</h4>
        <span>{videos.length} titles</span>
      </div>
      <div className="rail">
        {videos.map((video) => (
          <button
            key={video.key}
            type="button"
            className={`tile ${video.key === activeVideoKey ? "active" : ""}`}
            onClick={() => onSelect(video.key)}
          >
            {previewUrls?.[video.key] ? (
              <video
                className="tile-thumb"
                src={previewUrls[video.key]}
                muted
                preload="metadata"
                playsInline
              />
            ) : (
              <div className="tile-thumb fallback" />
            )}
            <div className="tile-overlay" />
            <div className="tile-copy">
              <h3>{video.title}</h3>
              <p>{video.meta}</p>
            </div>
            {isAdmin && (
              <span
                className="tile-delete"
                role="button"
                tabIndex={0}
                title="Delete movie"
                aria-label={`Delete ${video.title}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onDeleteRequest(video);
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  event.stopPropagation();
                  onDeleteRequest(video);
                }}
              >
                <svg
                  className="tile-delete-icon"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h2v8H7V9Zm4 0h2v8h-2V9Zm4 0h2v8h-2V9Z" />
                </svg>
              </span>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}

export default VideoRail;
