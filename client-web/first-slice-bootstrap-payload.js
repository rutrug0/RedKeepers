(() => {
  const snapshotRoot = window.__RK_FIRST_SLICE_MANIFEST_SNAPSHOT_V1__;
  if (!snapshotRoot || typeof snapshotRoot !== "object") {
    throw new Error("Missing first-slice manifest snapshot payload at window.__RK_FIRST_SLICE_MANIFEST_SNAPSHOT_V1__.");
  }

  const playableSourceManifest = snapshotRoot.source_manifests?.playable;
  const frontendDefaults = snapshotRoot.playable?.default_consumption_contract?.frontend;
  if (!playableSourceManifest || typeof playableSourceManifest !== "object") {
    throw new Error(
      "Invalid first-slice manifest snapshot payload path: source_manifests.playable",
    );
  }
  if (!frontendDefaults || typeof frontendDefaults !== "object") {
    throw new Error(
      "Invalid first-slice manifest snapshot payload path: playable.default_consumption_contract.frontend",
    );
  }

  window.__RK_FIRST_SLICE_BOOTSTRAP_PAYLOAD_V1__ = Object.freeze({
    schema_version: "rk-v1-first-slice-bootstrap-payload",
    source_manifest: {
      path: String(playableSourceManifest.path || "").trim(),
      manifest_id: String(playableSourceManifest.manifest_id || "").trim(),
    },
    default_consumption_contract: {
      frontend: {
        default_session_entry_settlement_id: String(
          frontendDefaults.default_session_entry_settlement_id || "",
        ).trim(),
        default_hostile_target_settlement_id: String(
          frontendDefaults.default_hostile_target_settlement_id || "",
        ).trim(),
      },
    },
  });
})();
