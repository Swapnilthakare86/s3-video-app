import React from "react";

function DeleteConfirmDialog({ video, deleting, onCancel, onConfirm }) {
  if (!video) return null;

  return (
    <div
      className="confirm-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        onCancel();
      }}
    >
      <section
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
      >
        <h3 id="delete-dialog-title">Delete Movie?</h3>
        <p>Are you sure you want to delete ?</p>
        <div className="confirm-actions">
          <button
            type="button"
            className="confirm-btn ghost"
            onClick={onCancel}
            disabled={deleting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="confirm-btn danger"
            onClick={onConfirm}
            disabled={deleting}
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </section>
    </div>
  );
}

export default DeleteConfirmDialog;
