import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {DeleteObjectCommand,GetObjectCommand,ListObjectsV2Command,PutObjectCommand,S3Client,} from "@aws-sdk/client-s3";
import { fromCognitoIdentityPool } from "@aws-sdk/credential-provider-cognito-identity";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import "./App.css";
import DeleteConfirmDialog from "./components/DeleteConfirmDialog";
import Footer from "./components/Footer";
import Header from "./components/Header";
import HeroPlayer from "./components/HeroPlayer";
import VideoRail from "./components/VideoRail";
import {DEFAULT_CATEGORY,ID_TOKEN_STORAGE_KEY,USED_CODE_STORAGE_KEY,VIDEO_EXTENSIONS,buildVideoFromKey,formatSize,getCategoryOptions,groupVideosByCategory,parseGroupsFromToken,sanitizeCategoryForKey,sanitizeFileName,} from "./utils/videoUtils";

const REGION = process.env.REACT_APP_REGION;
const IDENTITY_POOL_ID = process.env.REACT_APP_IDENTITY_POOL_ID;
const USER_POOL_ID = process.env.REACT_APP_USER_POOL_ID;
const CLIENT_ID = process.env.REACT_APP_CLIENT_ID;
const DOMAIN = process.env.REACT_APP_DOMAIN;
const BUCKET = process.env.REACT_APP_BUCKET;

const REDIRECT_URI = `${window.location.origin}/`;
const VIDEO_PREFIX = "videos/";
const EMPTY_VIDEOS = [];

const getStoredToken = () => localStorage.getItem(ID_TOKEN_STORAGE_KEY);

function App() {
  // Core app state for videos, auth, and UI actions.
  const [videos, setVideos] = useState(EMPTY_VIDEOS);
  const [selectedVideoKey, setSelectedVideoKey] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [previewUrls, setPreviewUrls] = useState({});
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingDeleteVideo, setPendingDeleteVideo] = useState(null);
  const [deletingVideo, setDeletingVideo] = useState(false);
  const [selectedUploadCategory, setSelectedUploadCategory] = useState(DEFAULT_CATEGORY);

  // Prevent duplicate load requests for the same video key.
  const loadingVideoKeyRef = useRef("");

  // Currently active video object (used in hero player and rails highlighting).
  const activeVideo = useMemo(
    () => videos.find((video) => video.key === selectedVideoKey) || videos[0] || null,
    [videos, selectedVideoKey]
  );

  const categorySections = useMemo(() => groupVideosByCategory(videos), [videos]);
  const categoryOptions = useMemo(() => getCategoryOptions(videos), [videos]);

  // Build Cognito hosted login URL.
  const getLoginUrl = useCallback(() => {
    const url = new URL(`${DOMAIN}/login`);
    url.searchParams.set("client_id", CLIENT_ID);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "email openid phone");
    url.searchParams.set("redirect_uri", REDIRECT_URI);
    return url.toString();
  }, []);

  const getToken = useCallback(async (code) => {
    // Exchange authorization code for an id_token.
    const response = await fetch(`${DOMAIN}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: CLIENT_ID,
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[getToken] failed:", response.status, errText);
      throw new Error("Token request failed");
    }

    return response.json();
  }, []);

  const getS3Client = useCallback((idToken) => {
    // Create S3 client with Cognito Identity Pool temporary credentials.
    return new S3Client({
      region: REGION,
      credentials: fromCognitoIdentityPool({
        clientConfig: { region: REGION },
        identityPoolId: IDENTITY_POOL_ID,
        logins: {
          [`cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}`]: idToken,
        },
      }),
    });
  }, []);

  const signVideoUrl = useCallback(
    async (idToken, key) => {
      // Generate time-limited URL so private S3 object can be streamed securely.
      const s3 = getS3Client(idToken);
      return getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: key }), {
        expiresIn: 3600,
      });
    },
    [getS3Client]
  );

  const loadSelectedVideo = useCallback(
    async (idToken, key) => {
      if (!key || loadingVideoKeyRef.current === key) return;

      loadingVideoKeyRef.current = key;
      setLoading(true);
      try {
        // Load playback URL for the selected video in hero player.
        const signedUrl = await signVideoUrl(idToken, key);
        setVideoUrl(signedUrl);
      } catch (error) {
        console.error("[loadSelectedVideo] error:", error);
      } finally {
        loadingVideoKeyRef.current = "";
        setLoading(false);
      }
    },
    [signVideoUrl]
  );

  const loadPreviewUrls = useCallback(
    async (idToken, videoList) => {
      try {
        // Pre-sign rail thumbnails/previews so cards can render quickly.
        const entries = await Promise.all(
          videoList.map(async (video) => [video.key, await signVideoUrl(idToken, video.key)])
        );
        setPreviewUrls(Object.fromEntries(entries));
      } catch (error) {
        console.error("[loadPreviewUrls] error:", error);
      }
    },
    [signVideoUrl]
  );

  const loadVideosFromBucket = useCallback(
    async (idToken) => {
      try {
        const s3 = getS3Client(idToken);
        const response = await s3.send(
          new ListObjectsV2Command({
            Bucket: BUCKET,
            Prefix: VIDEO_PREFIX,
          })
        );

        const discovered = (response.Contents || [])
          .filter((item) => item.Key && !item.Key.endsWith("/") && VIDEO_EXTENSIONS.test(item.Key))
          .map((item) => buildVideoFromKey(item.Key, item.Size));

        if (discovered.length > 0) {
          setVideos(discovered);
          return discovered;
        }
      } catch (error) {
        if (error?.name === "AccessDenied") {
          console.warn("[loadVideosFromBucket] AccessDenied - falling back to seed list");
        } else {
          console.error("[loadVideosFromBucket] error:", error);
        }
      }

      setVideos(EMPTY_VIDEOS);
      return EMPTY_VIDEOS;
    },
    [getS3Client]
  );

  const bootstrapSession = useCallback(
    async (idToken) => {
      // Determine role from token groups and initialize app data.
      const groups = parseGroupsFromToken(idToken);
      const adminUser = groups.includes("admin");

      setIsAdmin(adminUser);
      setLoggedIn(true);

      const discovered = await loadVideosFromBucket(idToken);
      const initialKey = discovered[0]?.key || "";
      setSelectedVideoKey(initialKey);

      if (initialKey) {
        await Promise.all([
          loadSelectedVideo(idToken, initialKey),
          loadPreviewUrls(idToken, discovered),
        ]);
      }
    },
    [loadPreviewUrls, loadSelectedVideo, loadVideosFromBucket]
  );

  const login = useCallback(() => {
    window.location.href = getLoginUrl();
  }, [getLoginUrl]);

  const resetSessionState = useCallback(() => {
    // Clear all in-memory state on logout.
    setLoggedIn(false);
    setIsAdmin(false);
    setVideos(EMPTY_VIDEOS);
    setSelectedVideoKey("");
    setSelectedUploadCategory(DEFAULT_CATEGORY);
    setVideoUrl("");
    setPreviewUrls({});
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(ID_TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(USED_CODE_STORAGE_KEY);
    resetSessionState();
    window.location.replace(getLoginUrl());
  }, [getLoginUrl, resetSessionState]);

  const deleteVideo = useCallback(
    async (key) => {
      const idToken = getStoredToken();
      if (!idToken) return;

      try {
        // Remove from S3 first, then sync local UI state.
        const s3 = getS3Client(idToken);
        await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));

        const nextVideos = videos.filter((video) => video.key !== key);
        setVideos(nextVideos);

        if (selectedVideoKey === key) {
          const nextKey = nextVideos[0]?.key || "";
          setSelectedVideoKey(nextKey);
          if (nextKey) {
            await loadSelectedVideo(idToken, nextKey);
          } else {
            setVideoUrl("");
          }
        }

        setPreviewUrls((prev) => {
          const nextPreviewUrls = { ...prev };
          delete nextPreviewUrls[key];
          return nextPreviewUrls;
        });
      } catch (error) {
        console.error("[deleteVideo] error:", error);
      }
    },
    [getS3Client, loadSelectedVideo, selectedVideoKey, videos]
  );

  const openDeleteDialog = useCallback((video) => {
    setPendingDeleteVideo(video);
  }, []);

  const closeDeleteDialog = useCallback(() => {
    if (deletingVideo) return;
    setPendingDeleteVideo(null);
  }, [deletingVideo]);

  const confirmDeleteVideo = useCallback(async () => {
    if (!pendingDeleteVideo || deletingVideo) return;

    setDeletingVideo(true);
    try {
      // Final step from modal: perform delete and close dialog.
      await deleteVideo(pendingDeleteVideo.key);
      setPendingDeleteVideo(null);
    } finally {
      setDeletingVideo(false);
    }
  }, [deleteVideo, deletingVideo, pendingDeleteVideo]);

  const uploadVideo = useCallback(
    async (event) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;

      const idToken = getStoredToken();
      if (!idToken) return;

      const safeName = sanitizeFileName(file.name);
      const safeCategory = sanitizeCategoryForKey(selectedUploadCategory);
      // Store uploaded files by category folder inside videos/ prefix.
      const key = `${VIDEO_PREFIX}${safeCategory || "featured"}/${Date.now()}-${safeName}`;

      setUploading(true);
      try {
        const s3 = getS3Client(idToken);
        await s3.send(
          new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            Body: new Uint8Array(await file.arrayBuffer()),
            ContentType: file.type || "video/mp4",
          })
        );

        const uploadedVideo = {
          key,
          title: file.name.replace(/\.[^/.]+$/, ""),
          meta: `${formatSize(file.size)} - Uploaded`,
          category: selectedUploadCategory,
        };

        const nextVideos = [...videos, uploadedVideo];
        setVideos(nextVideos);
        setSelectedVideoKey(key);

        await Promise.all([
          loadSelectedVideo(idToken, key),
          loadPreviewUrls(idToken, nextVideos),
        ]);
      } catch (error) {
        console.error("[uploadVideo] error:", error);
      } finally {
        setUploading(false);
      }
    },
    [getS3Client, loadPreviewUrls, loadSelectedVideo, selectedUploadCategory, videos]
  );

  useEffect(() => {
    const init = async () => {
      // Session restore order:
      // 1) existing token, 2) OAuth code exchange, 3) redirect to login.
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const savedToken = getStoredToken();

      if (savedToken) {
        await bootstrapSession(savedToken);
        return;
      }

      if (code) {
        if (sessionStorage.getItem(USED_CODE_STORAGE_KEY) === code) {
          return;
        }
        sessionStorage.setItem(USED_CODE_STORAGE_KEY, code);

        try {
          const tokenData = await getToken(code);
          if (!tokenData.id_token) return;

          localStorage.setItem(ID_TOKEN_STORAGE_KEY, tokenData.id_token);
          await bootstrapSession(tokenData.id_token);
          window.history.replaceState({}, document.title, "/");
        } catch (error) {
          console.error("[init] token exchange error:", error);
        }
        return;
      }

      window.location.replace(getLoginUrl());
    };

    init();
  }, [bootstrapSession, getLoginUrl, getToken]);

  useEffect(() => {
    // Re-sign URL when active card changes.
    const idToken = getStoredToken();
    if (!idToken || !loggedIn || !activeVideo?.key) return;
    loadSelectedVideo(idToken, activeVideo.key);
  }, [activeVideo?.key, loadSelectedVideo, loggedIn]);

  useEffect(() => {
    // Keep selected upload category valid when category list changes.
    if (categoryOptions.includes(selectedUploadCategory)) return;
    setSelectedUploadCategory(categoryOptions[0] || DEFAULT_CATEGORY);
  }, [categoryOptions, selectedUploadCategory]);

  return (
    <div className="app-shell">
      <Header
        loggedIn={loggedIn}
        isAdmin={isAdmin}
        onLogin={login}
        onLogout={logout}
        onUpload={uploadVideo}
        uploading={uploading}
        categories={categoryOptions}
        selectedCategory={selectedUploadCategory}
        onCategoryChange={setSelectedUploadCategory}
      />

      <main className="content-wrap">
        {activeVideo && (
          <HeroPlayer activeVideo={activeVideo} loading={loading} videoUrl={videoUrl} />
        )}

        {categorySections.map((section) => (
          <VideoRail
            key={section.title}
            title={section.title}
            videos={section.videos}
            activeVideoKey={activeVideo?.key}
            previewUrls={previewUrls}
            onSelect={setSelectedVideoKey}
            isAdmin={isAdmin}
            onDeleteRequest={openDeleteDialog}
          />
        ))}
      </main>

      <DeleteConfirmDialog
        video={pendingDeleteVideo}
        deleting={deletingVideo}
        onCancel={closeDeleteDialog}
        onConfirm={confirmDeleteVideo}
      />

      <Footer />
    </div>
  );
}

export default App;
