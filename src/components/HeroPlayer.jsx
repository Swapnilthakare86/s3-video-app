import React, { useEffect, useRef } from "react";
import ReactPlayer from "react-player";

function HeroPlayer({ activeVideo, loading, videoUrl }) {
  const hasReadyRef = useRef(false);

  useEffect(() => {
    hasReadyRef.current = false;
  }, [videoUrl]);

  return (
    <section className="hero">
      <div className="hero-copy">
        <p className="label">Now Streaming</p>
        <h1>{activeVideo.title}</h1>
        <p className="hero-meta">{activeVideo.category} - {activeVideo.meta}</p>
      </div>

      <div className="player-card">
        {loading && <div className="status">Loading video...</div>}
        {!loading && videoUrl && (
          <ReactPlayer
            src={videoUrl}
            controls
            width="100%"
            height="100%"
            onReady={() => {
              hasReadyRef.current = true;
              console.log("Video ready");
            }}
            onError={(error) => {
              if (hasReadyRef.current) return;
              const mediaErrorCode = error?.target?.error?.code;
              if (mediaErrorCode === 1) return;
              console.error("Video failed", error);
            }}
          />
        )}
      </div>
    </section>
  );
}

export default HeroPlayer;
