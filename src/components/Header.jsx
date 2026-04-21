import React from "react";

function Header({
  loggedIn,
  isAdmin,
  onLogin,
  onLogout,
  onUpload,
  uploading,
  categories,
  selectedCategory,
  onCategoryChange,
}) {
  const [showUploadPanel, setShowUploadPanel] = React.useState(false);

  return (
    <header className="topbar">
      <div className="brand-block">
        <div className="brand">Movies</div>
      </div>
      <div className="topbar-actions">
        {loggedIn && isAdmin && (
          <div className="upload-wrap">
            <button
              className={`upload-btn ${uploading ? "disabled" : ""}`}
              onClick={() => setShowUploadPanel((prev) => !prev)}
              disabled={uploading}
            >
              {uploading ? "Uploading..." : "Upload Video"}
            </button>

            {showUploadPanel && !uploading && (
              <div className="upload-panel">
                <div className="upload-category-field">
                  <span className="upload-field-label">Select Categories</span>
                  <select
                    className="upload-select"
                    value={selectedCategory}
                    onChange={(event) => onCategoryChange(event.target.value)}
                  >
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="upload-file-btn">
                  Choose File
                  <input
                    type="file"
                    accept="video/*"
                    onChange={(event) => {
                      onUpload(event);
                      setShowUploadPanel(false);
                    }}
                  />
                </label>
              </div>
            )}
          </div>
        )}
        {loggedIn ? (
          <button className="ghost-btn" onClick={onLogout}>
            Logout
          </button>
        ) : (
          <button className="ghost-btn" onClick={onLogin}>
            Login
          </button>
        )}
      </div>
    </header>
  );
}

export default Header;
