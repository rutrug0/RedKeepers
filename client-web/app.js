(() => {
  const numberFormatter = new Intl.NumberFormat("en-US");
  const reducedMotionQuery =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)")
      : null;
  const stableIdPattern = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
  const firstSliceBootstrapPayloadSourceGlobalPath =
    "window.__RK_FIRST_SLICE_BOOTSTRAP_PAYLOAD_V1__";
  const readManifestBackedFirstSliceBootstrapPayloadSource = () => {
    const payloadRoot = window.__RK_FIRST_SLICE_BOOTSTRAP_PAYLOAD_V1__;
    if (!payloadRoot || typeof payloadRoot !== "object") {
      throw new Error(
        `Missing manifest-backed bootstrap payload at ${firstSliceBootstrapPayloadSourceGlobalPath}.`,
      );
    }

    const frontendPayload = payloadRoot.default_consumption_contract?.frontend;
    if (!frontendPayload || typeof frontendPayload !== "object") {
      throw new Error(
        `Invalid bootstrap payload path: ${firstSliceBootstrapPayloadSourceGlobalPath}.default_consumption_contract.frontend`,
      );
    }
    const sourceManifest = payloadRoot.source_manifest;
    if (!sourceManifest || typeof sourceManifest !== "object") {
      throw new Error(
        `Invalid bootstrap payload path: ${firstSliceBootstrapPayloadSourceGlobalPath}.source_manifest`,
      );
    }
    const sourceManifestPath = String(sourceManifest.path || "").trim();
    if (sourceManifestPath.length < 1) {
      throw new Error(
        `Invalid bootstrap payload path: ${firstSliceBootstrapPayloadSourceGlobalPath}.source_manifest.path`,
      );
    }
    const sourceManifestId = String(sourceManifest.manifest_id || "").trim();
    if (!stableIdPattern.test(sourceManifestId)) {
      throw new Error(
        `Invalid bootstrap payload path: ${firstSliceBootstrapPayloadSourceGlobalPath}.source_manifest.manifest_id`,
      );
    }

    const defaultSessionEntrySettlementId = String(
      frontendPayload.default_session_entry_settlement_id || "",
    ).trim();
    if (!stableIdPattern.test(defaultSessionEntrySettlementId)) {
      throw new Error(
        `Invalid bootstrap payload path: ${firstSliceBootstrapPayloadSourceGlobalPath}.default_consumption_contract.frontend.default_session_entry_settlement_id`,
      );
    }

    const defaultHostileTargetSettlementId = String(
      frontendPayload.default_hostile_target_settlement_id || "",
    ).trim();
    if (!stableIdPattern.test(defaultHostileTargetSettlementId)) {
      throw new Error(
        `Invalid bootstrap payload path: ${firstSliceBootstrapPayloadSourceGlobalPath}.default_consumption_contract.frontend.default_hostile_target_settlement_id`,
      );
    }

    return Object.freeze({
      source_manifest_path: sourceManifestPath,
      source_manifest_id: sourceManifestId,
      default_session_entry_settlement_id: defaultSessionEntrySettlementId,
      default_hostile_target_settlement_id: defaultHostileTargetSettlementId,
    });
  };
  const firstSliceBootstrapPayloadSourceV1 =
    readManifestBackedFirstSliceBootstrapPayloadSource();
  const firstSliceManifestSnapshotSourceGlobalPath =
    "window.__RK_FIRST_SLICE_MANIFEST_SNAPSHOT_V1__";
  const readManifestBackedFirstSliceManifestSnapshotSource = () => {
    const snapshotRoot = window.__RK_FIRST_SLICE_MANIFEST_SNAPSHOT_V1__;
    if (!snapshotRoot || typeof snapshotRoot !== "object") {
      throw new Error(
        `Missing manifest-backed frontend snapshot at ${firstSliceManifestSnapshotSourceGlobalPath}.`,
      );
    }

    const sourceManifests = snapshotRoot.source_manifests;
    if (!sourceManifests || typeof sourceManifests !== "object") {
      throw new Error(
        `Invalid snapshot path: ${firstSliceManifestSnapshotSourceGlobalPath}.source_manifests`,
      );
    }
    const playableManifest = snapshotRoot.playable;
    if (!playableManifest || typeof playableManifest !== "object") {
      throw new Error(
        `Invalid snapshot path: ${firstSliceManifestSnapshotSourceGlobalPath}.playable`,
      );
    }
    const contentKeyManifest = snapshotRoot.content_keys;
    if (!contentKeyManifest || typeof contentKeyManifest !== "object") {
      throw new Error(
        `Invalid snapshot path: ${firstSliceManifestSnapshotSourceGlobalPath}.content_keys`,
      );
    }

    const readSourceManifest = (sourceManifestKey) => {
      const sourceManifest = sourceManifests[sourceManifestKey];
      if (!sourceManifest || typeof sourceManifest !== "object") {
        throw new Error(
          `Invalid snapshot path: ${firstSliceManifestSnapshotSourceGlobalPath}.source_manifests.${sourceManifestKey}`,
        );
      }
      const sourceManifestPath = String(sourceManifest.path || "").trim();
      if (sourceManifestPath.length < 1) {
        throw new Error(
          `Invalid snapshot path: ${firstSliceManifestSnapshotSourceGlobalPath}.source_manifests.${sourceManifestKey}.path`,
        );
      }
      const sourceManifestId = String(sourceManifest.manifest_id || "").trim();
      if (!stableIdPattern.test(sourceManifestId)) {
        throw new Error(
          `Invalid snapshot path: ${firstSliceManifestSnapshotSourceGlobalPath}.source_manifests.${sourceManifestKey}.manifest_id`,
        );
      }
      return {
        path: sourceManifestPath,
        manifest_id: sourceManifestId,
      };
    };

    const playableSourceManifest = readSourceManifest("playable");
    const contentKeySourceManifest = readSourceManifest("content_keys");
    const readHostileRuntimeTokenSourceManifest = () => {
      const sourceManifest = sourceManifests.hostile_runtime_tokens;
      if (!sourceManifest || typeof sourceManifest !== "object") {
        throw new Error(
          `Invalid snapshot path: ${firstSliceManifestSnapshotSourceGlobalPath}.source_manifests.hostile_runtime_tokens`,
        );
      }
      const sourceManifestPath = String(sourceManifest.path || "").trim();
      if (sourceManifestPath.length < 1) {
        throw new Error(
          `Invalid snapshot path: ${firstSliceManifestSnapshotSourceGlobalPath}.source_manifests.hostile_runtime_tokens.path`,
        );
      }
      const sourceContractId = String(sourceManifest.contract_id || "").trim();
      if (!stableIdPattern.test(sourceContractId)) {
        throw new Error(
          `Invalid snapshot path: ${firstSliceManifestSnapshotSourceGlobalPath}.source_manifests.hostile_runtime_tokens.contract_id`,
        );
      }
      return {
        path: sourceManifestPath,
        contract_id: sourceContractId,
      };
    };
    const hostileRuntimeTokenSourceManifest = readHostileRuntimeTokenSourceManifest();
    const canonicalPlayableNow = playableManifest.canonical_playable_now;
    if (!canonicalPlayableNow || typeof canonicalPlayableNow !== "object") {
      throw new Error(
        `Invalid snapshot path: ${firstSliceManifestSnapshotSourceGlobalPath}.playable.canonical_playable_now`,
      );
    }

    const playableFrontendDefaults =
      playableManifest.default_consumption_contract?.frontend;
    if (!playableFrontendDefaults || typeof playableFrontendDefaults !== "object") {
      throw new Error(
        `Invalid snapshot path: ${firstSliceManifestSnapshotSourceGlobalPath}.playable.default_consumption_contract.frontend`,
      );
    }

    const contentKeyDefaults =
      contentKeyManifest.default_first_slice_seed_usage;
    if (!contentKeyDefaults || typeof contentKeyDefaults !== "object") {
      throw new Error(
        `Invalid snapshot path: ${firstSliceManifestSnapshotSourceGlobalPath}.content_keys.default_first_slice_seed_usage`,
      );
    }
    const includeOnlyContentKeysRaw = contentKeyDefaults.include_only_content_keys;
    if (!Array.isArray(includeOnlyContentKeysRaw) || includeOnlyContentKeysRaw.length < 1) {
      throw new Error(
        `Invalid snapshot path: ${firstSliceManifestSnapshotSourceGlobalPath}.content_keys.default_first_slice_seed_usage.include_only_content_keys`,
      );
    }
    const includeOnlyContentKeys = includeOnlyContentKeysRaw.map((keyValue) => {
      const normalized = String(keyValue || "").trim();
      if (normalized.length < 1) {
        throw new Error(
          `Invalid snapshot key in ${firstSliceManifestSnapshotSourceGlobalPath}.content_keys.default_first_slice_seed_usage.include_only_content_keys`,
        );
      }
      return normalized;
    });

    const legacyAliasMappingRaw = contentKeyManifest.legacy_alias_mapping;
    if (!Array.isArray(legacyAliasMappingRaw)) {
      throw new Error(
        `Invalid snapshot path: ${firstSliceManifestSnapshotSourceGlobalPath}.content_keys.legacy_alias_mapping`,
      );
    }
    const legacyAliasMapping = legacyAliasMappingRaw.map((row, rowIndex) => {
      if (!row || typeof row !== "object") {
        throw new Error(
          `Invalid snapshot row: ${firstSliceManifestSnapshotSourceGlobalPath}.content_keys.legacy_alias_mapping[${rowIndex}]`,
        );
      }
      const canonicalKey = String(row.canonical_key || "").trim();
      if (canonicalKey.length < 1) {
        throw new Error(
          `Invalid snapshot row: ${firstSliceManifestSnapshotSourceGlobalPath}.content_keys.legacy_alias_mapping[${rowIndex}].canonical_key`,
        );
      }
      if (!Array.isArray(row.legacy_keys)) {
        throw new Error(
          `Invalid snapshot row: ${firstSliceManifestSnapshotSourceGlobalPath}.content_keys.legacy_alias_mapping[${rowIndex}].legacy_keys`,
        );
      }
      const legacyKeys = row.legacy_keys.map((legacyKey, legacyIndex) => {
        const normalizedLegacyKey = String(legacyKey || "").trim();
        if (normalizedLegacyKey.length < 1) {
          throw new Error(
            `Invalid snapshot key: ${firstSliceManifestSnapshotSourceGlobalPath}.content_keys.legacy_alias_mapping[${rowIndex}].legacy_keys[${legacyIndex}]`,
          );
        }
        return normalizedLegacyKey;
      });
      return Object.freeze({
        canonical_key: canonicalKey,
        legacy_keys: Object.freeze(legacyKeys),
      });
    });
    const compatibilityAliasOnlyEventKeys = [];
    for (const row of legacyAliasMapping) {
      if (!includeOnlyContentKeys.includes(row.canonical_key)) {
        throw new Error(
          `Invalid snapshot key: ${firstSliceManifestSnapshotSourceGlobalPath}.content_keys.legacy_alias_mapping canonical key '${row.canonical_key}' must exist in default_first_slice_seed_usage.include_only_content_keys`,
        );
      }
      for (const legacyKey of row.legacy_keys) {
        if (!compatibilityAliasOnlyEventKeys.includes(legacyKey)) {
          compatibilityAliasOnlyEventKeys.push(legacyKey);
        }
      }
    }
    for (const legacyAliasKey of compatibilityAliasOnlyEventKeys) {
      if (includeOnlyContentKeys.includes(legacyAliasKey)) {
        throw new Error(
          `Invalid snapshot key: ${firstSliceManifestSnapshotSourceGlobalPath}.content_keys.legacy_alias_mapping compatibility alias key '${legacyAliasKey}' must not be selected in default_first_slice_seed_usage.include_only_content_keys`,
        );
      }
    }
    const migrationKeyStatusByKey = {};
    for (const canonicalDefaultKey of includeOnlyContentKeys) {
      migrationKeyStatusByKey[canonicalDefaultKey] = "canonical-default";
    }
    for (const compatibilityAliasKey of compatibilityAliasOnlyEventKeys) {
      if (migrationKeyStatusByKey[compatibilityAliasKey] === "canonical-default") {
        throw new Error(
          `Invalid snapshot key: ${firstSliceManifestSnapshotSourceGlobalPath}.content_keys.legacy_alias_mapping compatibility alias key '${compatibilityAliasKey}' conflicts with canonical-default migration status`,
        );
      }
      migrationKeyStatusByKey[compatibilityAliasKey] = "compatibility-only";
    }
    const hostileRuntimeTokenContractRaw = contentKeyManifest.hostile_runtime_token_contract;
    if (!hostileRuntimeTokenContractRaw || typeof hostileRuntimeTokenContractRaw !== "object") {
      throw new Error(
        `Invalid snapshot path: ${firstSliceManifestSnapshotSourceGlobalPath}.content_keys.hostile_runtime_token_contract`,
      );
    }
    const hostileRuntimeTokenContractId = String(
      hostileRuntimeTokenContractRaw.contract_id || "",
    ).trim();
    if (!stableIdPattern.test(hostileRuntimeTokenContractId)) {
      throw new Error(
        `Invalid snapshot path: ${firstSliceManifestSnapshotSourceGlobalPath}.content_keys.hostile_runtime_token_contract.contract_id`,
      );
    }
    if (hostileRuntimeTokenContractId !== hostileRuntimeTokenSourceManifest.contract_id) {
      throw new Error(
        `Snapshot contract mismatch: ${firstSliceManifestSnapshotSourceGlobalPath}.content_keys.hostile_runtime_token_contract.contract_id`,
      );
    }
    const hostileRuntimeScopeContract = hostileRuntimeTokenContractRaw.scope_contract;
    if (!hostileRuntimeScopeContract || typeof hostileRuntimeScopeContract !== "object") {
      throw new Error(
        `Invalid snapshot path: ${firstSliceManifestSnapshotSourceGlobalPath}.content_keys.hostile_runtime_token_contract.scope_contract`,
      );
    }
    const hostileRuntimeDefaultSelectionPolicy = hostileRuntimeScopeContract.default_selection_policy;
    if (
      !hostileRuntimeDefaultSelectionPolicy
      || typeof hostileRuntimeDefaultSelectionPolicy !== "object"
    ) {
      throw new Error(
        `Invalid snapshot path: ${firstSliceManifestSnapshotSourceGlobalPath}.content_keys.hostile_runtime_token_contract.scope_contract.default_selection_policy`,
      );
    }
    const hostileRuntimeCanonicalKeysOnly =
      hostileRuntimeDefaultSelectionPolicy.canonical_keys_only;
    if (hostileRuntimeCanonicalKeysOnly !== true) {
      throw new Error(
        `Invalid snapshot path: ${firstSliceManifestSnapshotSourceGlobalPath}.content_keys.hostile_runtime_token_contract.scope_contract.default_selection_policy.canonical_keys_only`,
      );
    }
    const hostileRuntimeDirectDefaultSelectionExcludesAliasOnlyKeys =
      hostileRuntimeDefaultSelectionPolicy.direct_default_selection_excludes_alias_only_keys;
    if (hostileRuntimeDirectDefaultSelectionExcludesAliasOnlyKeys !== true) {
      throw new Error(
        `Invalid snapshot path: ${firstSliceManifestSnapshotSourceGlobalPath}.content_keys.hostile_runtime_token_contract.scope_contract.default_selection_policy.direct_default_selection_excludes_alias_only_keys`,
      );
    }
    const hostileRuntimeAliasLookupContract =
      hostileRuntimeScopeContract.alias_lookup_contract;
    if (!hostileRuntimeAliasLookupContract || typeof hostileRuntimeAliasLookupContract !== "object") {
      throw new Error(
        `Invalid snapshot path: ${firstSliceManifestSnapshotSourceGlobalPath}.content_keys.hostile_runtime_token_contract.scope_contract.alias_lookup_contract`,
      );
    }
    const hostileRuntimeDeterministicResolutionOrderRaw =
      hostileRuntimeAliasLookupContract.deterministic_resolution_order;
    if (
      !Array.isArray(hostileRuntimeDeterministicResolutionOrderRaw)
      || hostileRuntimeDeterministicResolutionOrderRaw.length < 1
    ) {
      throw new Error(
        `Invalid snapshot path: ${firstSliceManifestSnapshotSourceGlobalPath}.content_keys.hostile_runtime_token_contract.scope_contract.alias_lookup_contract.deterministic_resolution_order`,
      );
    }
    const hostileRuntimeDeterministicResolutionOrder =
      hostileRuntimeDeterministicResolutionOrderRaw.map((token, tokenIndex) => {
        const normalizedToken = String(token || "").trim();
        if (normalizedToken.length < 1) {
          throw new Error(
            `Invalid snapshot key: ${firstSliceManifestSnapshotSourceGlobalPath}.content_keys.hostile_runtime_token_contract.scope_contract.alias_lookup_contract.deterministic_resolution_order[${tokenIndex}]`,
          );
        }
        return normalizedToken;
      });
    if (
      hostileRuntimeDeterministicResolutionOrder.length !== 2
      || hostileRuntimeDeterministicResolutionOrder[0] !== "canonical_key"
      || hostileRuntimeDeterministicResolutionOrder[1] !== "legacy_keys_in_declared_order"
    ) {
      throw new Error(
        `Invalid snapshot path: ${firstSliceManifestSnapshotSourceGlobalPath}.content_keys.hostile_runtime_token_contract.scope_contract.alias_lookup_contract.deterministic_resolution_order`,
      );
    }
    const hostileRuntimeAliasKeysAreLookupOnly =
      hostileRuntimeAliasLookupContract.alias_keys_are_lookup_only;
    if (hostileRuntimeAliasKeysAreLookupOnly !== true) {
      throw new Error(
        `Invalid snapshot path: ${firstSliceManifestSnapshotSourceGlobalPath}.content_keys.hostile_runtime_token_contract.scope_contract.alias_lookup_contract.alias_keys_are_lookup_only`,
      );
    }
    const hostileRuntimeCompatibilityAliasOnlyKeysRaw =
      hostileRuntimeTokenContractRaw.compatibility_alias_only_keys;
    if (!Array.isArray(hostileRuntimeCompatibilityAliasOnlyKeysRaw)) {
      throw new Error(
        `Invalid snapshot path: ${firstSliceManifestSnapshotSourceGlobalPath}.content_keys.hostile_runtime_token_contract.compatibility_alias_only_keys`,
      );
    }
    const hostileRuntimeCompatibilityAliasOnlyKeys =
      hostileRuntimeCompatibilityAliasOnlyKeysRaw.map((aliasKey, aliasIndex) => {
        const normalizedAliasKey = String(aliasKey || "").trim();
        if (normalizedAliasKey.length < 1) {
          throw new Error(
            `Invalid snapshot key: ${firstSliceManifestSnapshotSourceGlobalPath}.content_keys.hostile_runtime_token_contract.compatibility_alias_only_keys[${aliasIndex}]`,
          );
        }
        return normalizedAliasKey;
      });
    const hostileRuntimeRequiredRuntimeKeysRaw =
      hostileRuntimeTokenContractRaw.required_runtime_keys;
    if (
      !Array.isArray(hostileRuntimeRequiredRuntimeKeysRaw)
      || hostileRuntimeRequiredRuntimeKeysRaw.length < 1
    ) {
      throw new Error(
        `Invalid snapshot path: ${firstSliceManifestSnapshotSourceGlobalPath}.content_keys.hostile_runtime_token_contract.required_runtime_keys`,
      );
    }
    const hostileRuntimeRequiredCanonicalKeySet = new Set();
    const hostileRuntimeDeclaredAliasKeySet = new Set();
    const hostileRuntimeRequiredRuntimeKeys =
      hostileRuntimeRequiredRuntimeKeysRaw.map((row, rowIndex) => {
        if (!row || typeof row !== "object") {
          throw new Error(
            `Invalid snapshot row: ${firstSliceManifestSnapshotSourceGlobalPath}.content_keys.hostile_runtime_token_contract.required_runtime_keys[${rowIndex}]`,
          );
        }
        const phase = String(row.phase || "").trim();
        if (phase.length < 1) {
          throw new Error(
            `Invalid snapshot row: ${firstSliceManifestSnapshotSourceGlobalPath}.content_keys.hostile_runtime_token_contract.required_runtime_keys[${rowIndex}].phase`,
          );
        }
        const canonicalKey = String(row.canonical_key || "").trim();
        if (canonicalKey.length < 1) {
          throw new Error(
            `Invalid snapshot row: ${firstSliceManifestSnapshotSourceGlobalPath}.content_keys.hostile_runtime_token_contract.required_runtime_keys[${rowIndex}].canonical_key`,
          );
        }
        if (hostileRuntimeRequiredCanonicalKeySet.has(canonicalKey)) {
          throw new Error(
            `Invalid snapshot row: duplicate canonical key '${canonicalKey}' in ${firstSliceManifestSnapshotSourceGlobalPath}.content_keys.hostile_runtime_token_contract.required_runtime_keys`,
          );
        }
        hostileRuntimeRequiredCanonicalKeySet.add(canonicalKey);
        if (!includeOnlyContentKeys.includes(canonicalKey)) {
          throw new Error(
            `Invalid snapshot key: ${firstSliceManifestSnapshotSourceGlobalPath}.content_keys.hostile_runtime_token_contract.required_runtime_keys[${rowIndex}].canonical_key must exist in include_only_content_keys`,
          );
        }
        if (!Array.isArray(row.required_tokens)) {
          throw new Error(
            `Invalid snapshot row: ${firstSliceManifestSnapshotSourceGlobalPath}.content_keys.hostile_runtime_token_contract.required_runtime_keys[${rowIndex}].required_tokens`,
          );
        }
        const requiredTokens = row.required_tokens.map((token, tokenIndex) => {
          const normalizedToken = String(token || "").trim();
          if (normalizedToken.length < 1) {
            throw new Error(
              `Invalid snapshot key: ${firstSliceManifestSnapshotSourceGlobalPath}.content_keys.hostile_runtime_token_contract.required_runtime_keys[${rowIndex}].required_tokens[${tokenIndex}]`,
            );
          }
          return normalizedToken;
        });
        if (!Array.isArray(row.compatibility_alias_keys)) {
          throw new Error(
            `Invalid snapshot row: ${firstSliceManifestSnapshotSourceGlobalPath}.content_keys.hostile_runtime_token_contract.required_runtime_keys[${rowIndex}].compatibility_alias_keys`,
          );
        }
        const compatibilityAliasKeys = row.compatibility_alias_keys.map((aliasKey, aliasIndex) => {
          const normalizedAliasKey = String(aliasKey || "").trim();
          if (normalizedAliasKey.length < 1) {
            throw new Error(
              `Invalid snapshot key: ${firstSliceManifestSnapshotSourceGlobalPath}.content_keys.hostile_runtime_token_contract.required_runtime_keys[${rowIndex}].compatibility_alias_keys[${aliasIndex}]`,
            );
          }
          hostileRuntimeDeclaredAliasKeySet.add(normalizedAliasKey);
          return normalizedAliasKey;
        });
        return Object.freeze({
          phase,
          canonical_key: canonicalKey,
          required_tokens: Object.freeze(requiredTokens),
          compatibility_alias_keys: Object.freeze(compatibilityAliasKeys),
        });
      });
    for (const aliasKey of hostileRuntimeCompatibilityAliasOnlyKeys) {
      if (!hostileRuntimeDeclaredAliasKeySet.has(aliasKey)) {
        throw new Error(
          `Invalid snapshot key: ${firstSliceManifestSnapshotSourceGlobalPath}.content_keys.hostile_runtime_token_contract.compatibility_alias_only_keys contains '${aliasKey}' which is missing in required_runtime_keys compatibility_alias_keys`,
        );
      }
      if (includeOnlyContentKeys.includes(aliasKey)) {
        throw new Error(
          `Invalid snapshot key: ${firstSliceManifestSnapshotSourceGlobalPath}.content_keys.hostile_runtime_token_contract.compatibility_alias_only_keys contains canonical default key '${aliasKey}'`,
        );
      }
    }
    for (const aliasKey of hostileRuntimeDeclaredAliasKeySet) {
      if (!hostileRuntimeCompatibilityAliasOnlyKeys.includes(aliasKey)) {
        throw new Error(
          `Invalid snapshot key: ${firstSliceManifestSnapshotSourceGlobalPath}.content_keys.hostile_runtime_token_contract.required_runtime_keys compatibility alias '${aliasKey}' must be listed in compatibility_alias_only_keys`,
        );
      }
    }
    const defaultFirstSessionNarrativeTemplatesRaw =
      contentKeyManifest.default_first_session_narrative_templates;
    if (
      !defaultFirstSessionNarrativeTemplatesRaw
      || typeof defaultFirstSessionNarrativeTemplatesRaw !== "object"
    ) {
      throw new Error(
        `Invalid snapshot path: ${firstSliceManifestSnapshotSourceGlobalPath}.content_keys.default_first_session_narrative_templates`,
      );
    }
    const defaultFirstSessionNarrativeTemplateSnapshotId = String(
      defaultFirstSessionNarrativeTemplatesRaw.snapshot_id || "",
    ).trim();
    if (!stableIdPattern.test(defaultFirstSessionNarrativeTemplateSnapshotId)) {
      throw new Error(
        `Invalid snapshot path: ${firstSliceManifestSnapshotSourceGlobalPath}.content_keys.default_first_session_narrative_templates.snapshot_id`,
      );
    }
    const defaultFirstSessionNarrativeTemplateManifestId = String(
      defaultFirstSessionNarrativeTemplatesRaw.manifest_id || "",
    ).trim();
    if (defaultFirstSessionNarrativeTemplateManifestId !== contentKeySourceManifest.manifest_id) {
      throw new Error(
        `Snapshot manifest mismatch: ${firstSliceManifestSnapshotSourceGlobalPath}.content_keys.default_first_session_narrative_templates.manifest_id`,
      );
    }
    const defaultFirstSessionTemplatesByKeyRaw =
      defaultFirstSessionNarrativeTemplatesRaw.templates_by_key;
    if (
      !defaultFirstSessionTemplatesByKeyRaw
      || typeof defaultFirstSessionTemplatesByKeyRaw !== "object"
      || Array.isArray(defaultFirstSessionTemplatesByKeyRaw)
    ) {
      throw new Error(
        `Invalid snapshot path: ${firstSliceManifestSnapshotSourceGlobalPath}.content_keys.default_first_session_narrative_templates.templates_by_key`,
      );
    }
    const defaultFirstSessionTemplatesByKeyEntries = Object.entries(
      defaultFirstSessionTemplatesByKeyRaw,
    );
    if (defaultFirstSessionTemplatesByKeyEntries.length < 1) {
      throw new Error(
        `Invalid snapshot path: ${firstSliceManifestSnapshotSourceGlobalPath}.content_keys.default_first_session_narrative_templates.templates_by_key`,
      );
    }
    const defaultFirstSessionTemplatesByKey = defaultFirstSessionTemplatesByKeyEntries.reduce(
      (lookup, [rawTemplateKey, rawTemplateRow]) => {
        const templateKey = String(rawTemplateKey || "").trim();
        if (templateKey.length < 1) {
          throw new Error(
            `Invalid snapshot key in ${firstSliceManifestSnapshotSourceGlobalPath}.content_keys.default_first_session_narrative_templates.templates_by_key`,
          );
        }
        if (!rawTemplateRow || typeof rawTemplateRow !== "object") {
          throw new Error(
            `Invalid snapshot row: ${firstSliceManifestSnapshotSourceGlobalPath}.content_keys.default_first_session_narrative_templates.templates_by_key.${templateKey}`,
          );
        }
        const template = String(rawTemplateRow.template || "").trim();
        if (template.length < 1) {
          throw new Error(
            `Invalid snapshot row: ${firstSliceManifestSnapshotSourceGlobalPath}.content_keys.default_first_session_narrative_templates.templates_by_key.${templateKey}.template`,
          );
        }
        if (!Array.isArray(rawTemplateRow.tokens)) {
          throw new Error(
            `Invalid snapshot row: ${firstSliceManifestSnapshotSourceGlobalPath}.content_keys.default_first_session_narrative_templates.templates_by_key.${templateKey}.tokens`,
          );
        }
        const tokens = rawTemplateRow.tokens.map((token, tokenIndex) => {
          const normalizedToken = String(token || "").trim();
          if (normalizedToken.length < 1) {
            throw new Error(
              `Invalid snapshot key: ${firstSliceManifestSnapshotSourceGlobalPath}.content_keys.default_first_session_narrative_templates.templates_by_key.${templateKey}.tokens[${tokenIndex}]`,
            );
          }
          return normalizedToken;
        });
        lookup[templateKey] = Object.freeze({
          template,
          tokens: Object.freeze(tokens),
        });
        return lookup;
      },
      {},
    );
    const defaultFirstSessionLookupResolutionByCanonicalKeyRaw =
      defaultFirstSessionNarrativeTemplatesRaw.lookup_resolution_order_by_canonical_key;
    if (!Array.isArray(defaultFirstSessionLookupResolutionByCanonicalKeyRaw)) {
      throw new Error(
        `Invalid snapshot path: ${firstSliceManifestSnapshotSourceGlobalPath}.content_keys.default_first_session_narrative_templates.lookup_resolution_order_by_canonical_key`,
      );
    }
    const defaultFirstSessionLookupResolutionByCanonicalKey =
      defaultFirstSessionLookupResolutionByCanonicalKeyRaw.map((row, rowIndex) => {
        if (!row || typeof row !== "object") {
          throw new Error(
            `Invalid snapshot row: ${firstSliceManifestSnapshotSourceGlobalPath}.content_keys.default_first_session_narrative_templates.lookup_resolution_order_by_canonical_key[${rowIndex}]`,
          );
        }
        const canonicalKey = String(row.canonical_key || "").trim();
        if (canonicalKey.length < 1) {
          throw new Error(
            `Invalid snapshot row: ${firstSliceManifestSnapshotSourceGlobalPath}.content_keys.default_first_session_narrative_templates.lookup_resolution_order_by_canonical_key[${rowIndex}].canonical_key`,
          );
        }
        if (!Array.isArray(row.resolution_order) || row.resolution_order.length < 1) {
          throw new Error(
            `Invalid snapshot row: ${firstSliceManifestSnapshotSourceGlobalPath}.content_keys.default_first_session_narrative_templates.lookup_resolution_order_by_canonical_key[${rowIndex}].resolution_order`,
          );
        }
        const resolutionOrder = row.resolution_order.map((lookupKey, lookupIndex) => {
          const normalizedLookupKey = String(lookupKey || "").trim();
          if (normalizedLookupKey.length < 1) {
            throw new Error(
              `Invalid snapshot key: ${firstSliceManifestSnapshotSourceGlobalPath}.content_keys.default_first_session_narrative_templates.lookup_resolution_order_by_canonical_key[${rowIndex}].resolution_order[${lookupIndex}]`,
            );
          }
          if (!defaultFirstSessionTemplatesByKey[normalizedLookupKey]) {
            throw new Error(
              `Invalid snapshot key: ${firstSliceManifestSnapshotSourceGlobalPath}.content_keys.default_first_session_narrative_templates.lookup_resolution_order_by_canonical_key[${rowIndex}].resolution_order[${lookupIndex}] is missing in templates_by_key`,
            );
          }
          return normalizedLookupKey;
        });
        if (resolutionOrder[0] !== canonicalKey) {
          throw new Error(
            `Invalid snapshot row: ${firstSliceManifestSnapshotSourceGlobalPath}.content_keys.default_first_session_narrative_templates.lookup_resolution_order_by_canonical_key[${rowIndex}] must start with canonical_key`,
          );
        }
        return Object.freeze({
          canonical_key: canonicalKey,
          resolution_order: Object.freeze(resolutionOrder),
        });
      });

    return Object.freeze({
      source_manifests: Object.freeze({
        playable: Object.freeze(playableSourceManifest),
        content_keys: Object.freeze(contentKeySourceManifest),
        hostile_runtime_tokens: Object.freeze(hostileRuntimeTokenSourceManifest),
      }),
      playable_manifest: Object.freeze({
        manifest_id: playableSourceManifest.manifest_id,
        canonical_playable_now: canonicalPlayableNow,
        default_consumption_contract: Object.freeze({
          frontend: Object.freeze({
            default_session_entry_settlement_id: String(
              playableFrontendDefaults.default_session_entry_settlement_id || "",
            ).trim(),
            default_hostile_target_settlement_id: String(
              playableFrontendDefaults.default_hostile_target_settlement_id || "",
            ).trim(),
          }),
        }),
      }),
      content_key_manifest: Object.freeze({
        manifest_id: contentKeySourceManifest.manifest_id,
        default_first_slice_seed_usage: Object.freeze({
          include_only_content_keys: Object.freeze(includeOnlyContentKeys),
        }),
        migration_key_status_by_key: Object.freeze(migrationKeyStatusByKey),
        legacy_alias_mapping: Object.freeze(legacyAliasMapping),
        compatibility_alias_only_keys: Object.freeze(compatibilityAliasOnlyEventKeys),
        hostile_runtime_token_contract: Object.freeze({
          contract_id: hostileRuntimeTokenContractId,
          scope_contract: Object.freeze({
            default_selection_policy: Object.freeze({
              canonical_keys_only: true,
              direct_default_selection_excludes_alias_only_keys: true,
            }),
            alias_lookup_contract: Object.freeze({
              deterministic_resolution_order: Object.freeze(
                hostileRuntimeDeterministicResolutionOrder,
              ),
              alias_keys_are_lookup_only: true,
            }),
          }),
          required_runtime_keys: Object.freeze(hostileRuntimeRequiredRuntimeKeys),
          compatibility_alias_only_keys: Object.freeze(
            hostileRuntimeCompatibilityAliasOnlyKeys,
          ),
        }),
        default_first_session_narrative_templates: Object.freeze({
          snapshot_id: defaultFirstSessionNarrativeTemplateSnapshotId,
          manifest_id: defaultFirstSessionNarrativeTemplateManifestId,
          lookup_resolution_order_by_canonical_key: Object.freeze(
            defaultFirstSessionLookupResolutionByCanonicalKey,
          ),
          templates_by_key: Object.freeze(defaultFirstSessionTemplatesByKey),
        }),
      }),
    });
  };
  const firstSliceManifestSnapshotSourceV1 =
    readManifestBackedFirstSliceManifestSnapshotSource();
  const localNarrativeFallbackTemplates = Object.freeze({
    "civ_intro.cinder_throne_legates":
      "The Cinder Throne Legates hold the frontier by ash, ration, and decree. Their magistrates build roads before monuments, and their branded levies turn every settlement into a hard post that is costly to break.",
    "event.units.upkeep_reduced_garrison":
      "{settlement_name}: garrison ration discipline reduces stationed troop upkeep.",
    "event.build.failure_insufficient_resources":
      "{settlement_name}: {building_id} upgrade paused for insufficient resources. Required {required_cost_by_id}; available {available_stock_by_id}.",
    "event.world.scout_unavailable_tile":
      "Scout dispatch to {target_tile_label} aborted: tile is unavailable for this route.",
    "event.scout.unavailable_tile":
      "Scout dispatch to {target_tile_label} aborted: tile is unavailable for this route.",
    "event.combat.placeholder_skirmish_attacker_win":
      "{army_name} wins a brief skirmish near {target_tile_label}. Losses are light; survivors regroup for orders.",
    "event.combat.placeholder_skirmish_defender_win":
      "{army_name} is repelled at {target_tile_label}; the walls hold through the slaughter.",
    "event.combat.placeholder_skirmish_tie_defender_holds":
      "{army_name} is repelled at {target_tile_label}; the walls hold through the slaughter.",
    "event.world.hostile_dispatch_failed_feature_not_in_slice":
      "Dispatch denied: hero march attachment remains disabled until post-slice feature gates pass.",
    "event.world.hostile_dispatch_failed_hero_unavailable":
      "Dispatch denied: selected hero is unavailable (locked, cooling down, or missing player scope).",
    "event.world.hostile_dispatch_failed_hero_already_assigned":
      "Dispatch denied: selected hero is already assigned to an active context.",
    "event.world.hostile_dispatch_failed_hero_target_scope_mismatch":
      "Dispatch denied: selected hero is assigned to an incompatible target scope.",
    "event.hero.assigned":
      "{hero_id} assigned to {assignment_context_type} context {assignment_context_id}.",
    "event.hero.ability_activated":
      "{hero_id} activates {ability_id}; cooldown runs until {cooldown_ends_at}.",
    "event.hero.cooldown_complete":
      "{hero_id} is ready again: {ability_id} cooldown complete.",
    "event.settlement.name_assigned":
      "Surveyors record the new holding as {settlement_name}. The name enters the ledger.",
  });
  const firstSlicePlayableManifestV1 =
    firstSliceManifestSnapshotSourceV1.playable_manifest;
  const firstSliceContentKeyManifestV1 =
    firstSliceManifestSnapshotSourceV1.content_key_manifest;
  const firstSliceHostileRuntimeTokenContractV1 =
    firstSliceContentKeyManifestV1.hostile_runtime_token_contract;
  const firstSliceHostileRuntimeRequiredRowByCanonicalKey = Object.freeze(
    firstSliceHostileRuntimeTokenContractV1.required_runtime_keys.reduce((lookup, row) => {
      lookup[row.canonical_key] = row;
      return lookup;
    }, {}),
  );
  const firstSliceHostileRuntimeCanonicalKeySet = new Set(
    firstSliceHostileRuntimeTokenContractV1.required_runtime_keys.map((row) => row.canonical_key),
  );
  const firstSliceHostileRuntimeCanonicalKeyCandidatesByLegacyAlias = Object.freeze(
    firstSliceHostileRuntimeTokenContractV1.required_runtime_keys.reduce((lookup, row) => {
      for (const legacyKey of row.compatibility_alias_keys) {
        const normalizedLegacyKey = String(legacyKey || "").trim();
        if (normalizedLegacyKey.length < 1) {
          continue;
        }
        if (!Array.isArray(lookup[normalizedLegacyKey])) {
          lookup[normalizedLegacyKey] = [];
        }
        if (!lookup[normalizedLegacyKey].includes(row.canonical_key)) {
          lookup[normalizedLegacyKey].push(row.canonical_key);
        }
      }
      return lookup;
    }, {}),
  );
  const firstSliceHostileRuntimeCompatibilityAliasOnlyKeySet = new Set(
    firstSliceHostileRuntimeTokenContractV1.compatibility_alias_only_keys,
  );
  const firstSliceDefaultFirstSessionNarrativeTemplatesV1 =
    firstSliceContentKeyManifestV1.default_first_session_narrative_templates;
  const firstSliceNarrativeTemplateRowsByContentKey =
    firstSliceDefaultFirstSessionNarrativeTemplatesV1.templates_by_key;
  const firstSliceNarrativeTemplateLookupResolutionOrderByCanonicalEventKey =
    Object.freeze(
      firstSliceDefaultFirstSessionNarrativeTemplatesV1.lookup_resolution_order_by_canonical_key
        .reduce((lookup, row) => {
          lookup[row.canonical_key] = [...row.resolution_order];
          return lookup;
        }, {}),
    );
  const firstSliceDeferredPostSliceEventContentKeys = Object.freeze([
    "event.world.gather_started",
    "event.world.gather_completed",
    "event.world.ambush_triggered",
    "event.world.ambush_resolved",
    "event.hero.assigned",
    "event.hero.unassigned",
    "event.hero.ability_activated",
    "event.hero.cooldown_complete",
  ]);
  const firstSliceAllowedEventContentKeySet = new Set(
    firstSliceContentKeyManifestV1.default_first_slice_seed_usage.include_only_content_keys,
  );
  const firstSliceDeferredPostSliceEventContentKeySet = new Set(
    firstSliceDeferredPostSliceEventContentKeys,
  );
  const migrationKeyStatusCanonicalDefault = "canonical-default";
  const migrationKeyStatusCompatibilityOnly = "compatibility-only";
  const firstSliceMigrationKeyStatusByEventContentKey =
    firstSliceContentKeyManifestV1.migration_key_status_by_key;
  const getFirstSliceMigrationKeyStatus = (contentKey) =>
    firstSliceMigrationKeyStatusByEventContentKey[String(contentKey || "").trim()] || "";
  const isFirstSliceCanonicalDefaultMigrationEventKey = (contentKey) =>
    getFirstSliceMigrationKeyStatus(contentKey) === migrationKeyStatusCanonicalDefault;
  const isFirstSliceCompatibilityOnlyMigrationEventKey = (contentKey) =>
    getFirstSliceMigrationKeyStatus(contentKey) === migrationKeyStatusCompatibilityOnly;
  const firstSliceCanonicalEventKeyCandidatesByLegacyAlias = Object.freeze(
    firstSliceContentKeyManifestV1.legacy_alias_mapping.reduce((lookup, row) => {
      for (const legacyKey of row.legacy_keys) {
        const normalizedLegacyKey = String(legacyKey || "").trim();
        if (normalizedLegacyKey.length < 1) {
          continue;
        }
        if (!Array.isArray(lookup[normalizedLegacyKey])) {
          lookup[normalizedLegacyKey] = [];
        }
        if (!lookup[normalizedLegacyKey].includes(row.canonical_key)) {
          lookup[normalizedLegacyKey].push(row.canonical_key);
        }
      }
      return lookup;
    }, {}),
  );
  const firstSliceDeterministicFallbackEventContentKey = "event.world.hostile_dispatch_failed";
  const firstSliceLocalProfileStorageKey = "rk:first_slice:local_player_profile_v1";
  const assertFirstSliceBootstrapDefaultsAlignManifestScope = (
    manifest,
    bootstrapPayload,
  ) => {
    const canonicalPrimarySettlementId =
      manifest.canonical_playable_now.primary_settlement.settlement_id;
    const canonicalHostileSettlementId =
      manifest.canonical_playable_now.foreign_hostile_profile.settlement_id;
    if (
      bootstrapPayload.default_session_entry_settlement_id
      !== canonicalPrimarySettlementId
    ) {
      throw new Error(
        "Manifest scope drift: bootstrap default session settlement id diverges from canonical primary settlement id.",
      );
    }
    if (
      bootstrapPayload.default_hostile_target_settlement_id
      !== canonicalHostileSettlementId
    ) {
      throw new Error(
        "Manifest scope drift: bootstrap default hostile target settlement id diverges from canonical hostile settlement id.",
      );
    }
    if (
      bootstrapPayload.default_session_entry_settlement_id
      === bootstrapPayload.default_hostile_target_settlement_id
    ) {
      throw new Error(
        "Manifest scope drift: bootstrap default session and hostile target settlement ids must remain distinct.",
      );
    }
    if (bootstrapPayload.source_manifest_id !== manifest.manifest_id) {
      throw new Error(
        "Manifest scope drift: bootstrap payload source manifest id diverges from first-slice playable manifest id.",
      );
    }
  };
  assertFirstSliceBootstrapDefaultsAlignManifestScope(
    firstSlicePlayableManifestV1,
    firstSliceBootstrapPayloadSourceV1,
  );
  const firstSliceDefaultSessionEntrySettlementId =
    firstSliceBootstrapPayloadSourceV1.default_session_entry_settlement_id;
  const firstSliceDefaultHostileTargetSettlementId =
    firstSliceBootstrapPayloadSourceV1.default_hostile_target_settlement_id;
  const firstSlicePlayableDefaults = firstSlicePlayableManifestV1.canonical_playable_now;
  const firstSlicePrimarySettlement = firstSlicePlayableDefaults.primary_settlement;
  const firstSliceForeignHostileProfile = firstSlicePlayableDefaults.foreign_hostile_profile;
  const firstSliceHomeMarkerId = "marker_home_settlement";
  const firstSliceHostileMarkerId = "marker_hostile_target";
  const firstSliceHomeTileId = "tile_0000_0000";
  const firstSliceHostileTileId = "tile_0002_0001";
  const normalizeStableIdToken = (value, fallback) => {
    const normalized = String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    if (normalized.length > 0 && stableIdPattern.test(normalized)) {
      return normalized;
    }
    return fallback;
  };
  const createLocalPlayerProfileSeed = () => {
    const timestampSeed = Date.now().toString(36);
    const randomSeed = Math.random().toString(36).slice(2, 10);
    const composedSeed = normalizeStableIdToken(`${timestampSeed}_${randomSeed}`, "seed_local_profile");
    return `local_profile_${composedSeed}`;
  };
  const createDefaultStableLocalProfile = () => {
    const profileId = createLocalPlayerProfileSeed();
    const isoNow = new Date().toISOString();
    return {
      schema_version: "rk-v1-local-player-profile",
      profile_id: profileId,
      player_id: `player_${profileId}`,
      created_at: isoNow,
      last_seen_at: isoNow,
    };
  };
  const readStableLocalProfileFromStorage = () => {
    try {
      const raw = window.localStorage.getItem(firstSliceLocalProfileStorageKey);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") {
        return null;
      }

      const profileId = normalizeStableIdToken(parsed.profile_id, "");
      const playerId = normalizeStableIdToken(parsed.player_id, "");
      if (profileId.length < 1 || playerId.length < 1) {
        return null;
      }

      return {
        schema_version: "rk-v1-local-player-profile",
        profile_id: profileId,
        player_id: playerId,
        created_at: typeof parsed.created_at === "string" ? parsed.created_at : new Date().toISOString(),
        last_seen_at: typeof parsed.last_seen_at === "string" ? parsed.last_seen_at : new Date().toISOString(),
      };
    } catch {
      return null;
    }
  };
  const persistStableLocalProfile = (profile) => {
    if (!profile) {
      return;
    }
    try {
      window.localStorage.setItem(
        firstSliceLocalProfileStorageKey,
        JSON.stringify(profile),
      );
    } catch {
      // Ignore storage persistence failures in restricted browser contexts.
    }
  };
  const resolveStableLocalProfile = () => {
    const existing = readStableLocalProfileFromStorage();
    if (existing) {
      const hydrated = {
        ...existing,
        last_seen_at: new Date().toISOString(),
      };
      persistStableLocalProfile(hydrated);
      return hydrated;
    }
    const seeded = createDefaultStableLocalProfile();
    persistStableLocalProfile(seeded);
    return seeded;
  };
  const stableLocalProfile = resolveStableLocalProfile();

  const mockClientShellState = {
    panelModes: {
      settlement: "populated",
      worldMap: "populated",
      eventFeed: "populated",
    },
    panels: {
      settlement: {
        title: firstSlicePrimarySettlement.settlement_name,
        stateOptions: ["loading", "populated", "empty", "error"],
        scenarios: {
          loading: {
            titleSuffix: "(Syncing)",
            resourceSlots: 4,
            queueSlots: 3,
            unitSlots: 4,
          },
          populated: {
            resources: [
              { label: "Timber", value: 1240, fill: 62 },
              { label: "Stone", value: 980, fill: 49 },
              { label: "Iron", value: 715, fill: 36 },
              { label: "Grain", value: 1860, fill: 78 },
            ],
            buildQueue: [
              { icon: "B1", label: "Grain Plot Upgrade (Lv. 6)", progress: 45, eta: "08:14" },
              { icon: "B2", label: "Timber Camp Upgrade (Lv. 4)", progress: 12, eta: "19:30" },
              { icon: "B3", label: "Rally Post Upgrade (Lv. 2)", progress: 0, eta: "Queued" },
            ],
            garrison: [
              { unit: "Watch Levy", count: 120 },
              { unit: "Bow Crew", count: 48 },
              { unit: "Trail Scout", count: 64 },
              { unit: "Light Raider", count: 12 },
            ],
            civIntro: {
              civId: firstSlicePlayableDefaults.civilization_profile_id,
              displayName: "Cinder Throne Legates",
              contentKey: "civ_intro.cinder_throne_legates",
            },
          },
          empty: {
            titleSuffix: "(Idle)",
            emptySummary:
              "No active work orders are in progress. Use placeholder controls to seed resource and queue records.",
            resourceHint: "No resource deltas are currently staged in this mock scenario.",
            queueHint: "No build upgrades queued.",
            garrisonHint: "No stationed unit entries.",
            civIntro: {
              civId: firstSlicePlayableDefaults.civilization_profile_id,
              displayName: "Cinder Throne Legates",
              contentKey: "civ_intro.cinder_throne_legates",
            },
          },
          error: {
            titleSuffix: "(Sync Error)",
            errorCode: "SETTLEMENT_SYNC_TIMEOUT",
            emptySummary:
              "Settlement placeholder payload could not be resolved from local mock transport.",
            resourceHint: "Resource ledger unavailable while sync is in error.",
            queueHint: "Build queue data unavailable while sync is in error.",
            garrisonHint: "Garrison snapshot unavailable while sync is in error.",
          },
        },
      },
      worldMap: {
        title: "Frontier Region Map",
        stateOptions: ["loading", "populated", "empty", "error"],
        scenarios: {
          loading: {
            coords: "-- / --",
            region: "Loading placeholder map...",
            selectedTile: {
              Type: "Syncing",
              Control: "Resolving",
              Travel: "Estimating",
            },
            legend: [
              { kind: "settlement", label: "Your Settlements" },
              { kind: "hostile", label: "Hostile / Points of Interest" },
            ],
            actions: [
              "Send Scouts (placeholder)",
              "Inspect Tile (placeholder)",
            ],
          },
          populated: {
            coords: "412 / 198",
            region: "Black Reed March",
            selected_tile_id: firstSliceHomeTileId,
            selected_marker_id: firstSliceHomeMarkerId,
            markers: [
              {
                marker_id: firstSliceHomeMarkerId,
                className: "settlement",
                label: firstSlicePrimarySettlement.settlement_name,
                selected: true,
                tile_id: firstSliceHomeTileId,
                tile_label: firstSlicePrimarySettlement.settlement_name,
                target_kind: "home_settlement",
                settlement_id: firstSliceDefaultSessionEntrySettlementId,
                coords: { x: 0, y: 0 },
              },
              {
                marker_id: firstSliceHostileMarkerId,
                className: "hostile",
                label: firstSliceForeignHostileProfile.settlement_name,
                selected: false,
                tile_id: firstSliceHostileTileId,
                tile_label: firstSliceForeignHostileProfile.target_tile_label,
                target_kind: "hostile_settlement",
                settlement_id: firstSliceForeignHostileProfile.settlement_id,
                defender_garrison_strength: firstSliceForeignHostileProfile.defender_garrison_strength,
                coords: {
                  x: firstSliceForeignHostileProfile.map_coordinate.x,
                  y: firstSliceForeignHostileProfile.map_coordinate.y,
                },
              },
            ],
            routes: [
              { className: "route-line--one" },
              { className: "route-line--two" },
            ],
            selectedTile: {
              Type: "Home Settlement",
              Control: "Player Controlled",
              Travel: "Origin",
            },
            legend: [
              { kind: "settlement", label: "Your Settlements" },
              { kind: "hostile", label: "Hostile / Points of Interest" },
            ],
            actions: [
              "Send Scouts (placeholder)",
              "Dispatch Hostile March",
              "Inspect Tile (placeholder)",
            ],
          },
          empty: {
            coords: "-- / --",
            region: "No discovered frontier tiles",
            selectedTile: {
              Type: "No Selection",
              Control: "N/A",
              Travel: "N/A",
            },
            legend: [
              { kind: "settlement", label: "Your Settlements" },
              { kind: "hostile", label: "Hostile / Points of Interest" },
            ],
            actions: [
              "Send Scouts (placeholder)",
              "Inspect Tile (placeholder)",
            ],
            emptySummary:
              "No marker or route placeholders are active in this map scenario.",
            selectedTileHint: "Select a placeholder tile after mock markers are injected.",
          },
          error: {
            coords: "-- / --",
            region: "Map telemetry unavailable",
            selectedTile: {
              Type: "Unavailable",
              Control: "Unknown",
              Travel: "Unavailable",
            },
            legend: [
              { kind: "settlement", label: "Your Settlements" },
              { kind: "hostile", label: "Hostile / Points of Interest" },
            ],
            actions: ["Retry Sync (placeholder)"],
            errorCode: "MAP_STREAM_OFFLINE",
            emptySummary:
              "World map placeholder stream failed to load. Map interactions stay disabled in this mock error state.",
            selectedTileHint: "Tile inspection is suspended while the map stream is offline.",
          },
        },
      },
      eventFeed: {
        title: "Dispatches & Alerts",
        stateOptions: ["loading", "populated", "empty", "error"],
        scenarios: {
          loading: {
            filters: ["All", "Settlement", "Military", "World"],
            selectedFilter: "All",
            eventSlots: 5,
            notificationSlots: 3,
          },
          populated: {
            filters: ["All", "Settlement", "Military", "World"],
            selectedFilter: "All",
            events: [
              {
                contentKey: "event.tick.passive_gain_success",
                tokens: {
                  settlement_name: firstSlicePrimarySettlement.settlement_name,
                  duration_ms: 250,
                },
                meta: "2m ago | Economy | Tick",
                priority: "high",
              },
              {
                contentKey: "event.tick.passive_gain_stalled",
                tokens: {
                  settlement_name: firstSlicePrimarySettlement.settlement_name,
                  duration_ms: 240,
                },
                meta: "6m ago | Economy | Tick",
                priority: "normal",
              },
              {
                contentKey: "event.build.success",
                tokens: {
                  settlement_name: firstSlicePrimarySettlement.settlement_name,
                  building_label: "Grain Plot Upgrade",
                  from_level: 5,
                  to_level: 6,
                },
                meta: "8m ago | Settlement | Build loop",
                priority: "normal",
              },
              {
                contentKey: "event.build.failure_insufficient_resources",
                tokens: {
                  building_id: "grain_plot",
                  missing_resources_by_id: "Wood: 4, Stone: 2",
                  required_cost_by_id: "Wood: 12, Stone: 5",
                  available_stock_by_id: "Wood: 8, Stone: 3",
                },
                meta: "12m ago | Settlement | Build loop",
                priority: "normal",
              },
              {
                contentKey: "event.train.failure_cooldown",
                tokens: {
                  unit_id: "watch_levy",
                  queue_available_at: "08:42",
                  cooldown_remaining_ms: 4200,
                },
                meta: "16m ago | Military | Train loop",
                priority: "normal",
              },
              {
                contentKey: "event.scout.report_empty",
                tokens: {
                  target_tile_label: "Black Reed March",
                },
                meta: "21m ago | World | Scout loop",
                priority: "normal",
              },
              {
                contentKey: "event.scout.report_hostile",
                tokens: {
                  target_tile_label: "Ruin Site",
                  hostile_force_estimate: "3-5 squads",
                },
                meta: "23m ago | World | Scout loop",
                priority: "normal",
              },
              {
                contentKey: "event.scout.dispatched",
                tokens: {
                  settlement_name: firstSlicePrimarySettlement.settlement_name,
                  target_tile_label: "Black Reed March",
                },
                meta: "25m ago | World | Scout loop",
                priority: "normal",
              },
              {
                contentKey: "event.train.success",
                tokens: {
                  settlement_name: firstSlicePrimarySettlement.settlement_name,
                  quantity: 12,
                  unit_label: "Watch Levy",
                },
                meta: "31m ago | Military | Train loop",
                priority: "normal",
              },
              {
                contentKey: "event.world.hostile_dispatch_target_required",
                tokens: {
                  target_tile_label: firstSliceForeignHostileProfile.target_tile_label,
                },
                meta: "29m ago | World | Hostile loop",
                priority: "normal",
              },
            ],
            queuedNotifications: [
              "Build completion banner slot",
              "Scout report card slot",
              "Hostile dispatch outcome slot",
            ],
          },
          empty: {
            filters: ["All", "Settlement", "Military", "World"],
            selectedFilter: "All",
            emptySummary:
              "No placeholder dispatches are queued. Trigger settlement/map actions to generate feed rows.",
            notificationSummary: "Notification queue is clear.",
          },
          error: {
            filters: ["All", "Settlement", "Military", "World"],
            selectedFilter: "All",
            errorCode: "FEED_CACHE_READ_FAILED",
            emptySummary:
              "Event feed placeholder records failed to load from local mock cache.",
            notificationSummary:
              "Notification queue unavailable while feed cache is in an error state.",
          },
        },
      },
    },
  };

  const panelRefs = {
    settlement: {
      title: document.getElementById("settlement-title"),
      content: document.getElementById("settlement-panel-content"),
      controls: document.getElementById("settlement-panel-state-controls"),
    },
    worldMap: {
      title: document.getElementById("worldmap-title"),
      content: document.getElementById("worldmap-panel-content"),
      controls: document.getElementById("worldmap-panel-state-controls"),
    },
    eventFeed: {
      title: document.getElementById("event-feed-title"),
      content: document.getElementById("event-feed-panel-content"),
      controls: document.getElementById("event-feed-panel-state-controls"),
    },
  };

  const firstSliceResourceIds = Object.freeze([...firstSlicePlayableDefaults.resources]);
  const firstSlicePlayableUnitIdSet = new Set(firstSlicePlayableDefaults.units);
  const settlementResourceCardOrder = Object.freeze([
    { resourceId: "wood", label: "Timber" },
    { resourceId: "stone", label: "Stone" },
    { resourceId: "iron", label: "Iron" },
    { resourceId: "food", label: "Grain" },
  ].filter((entry) => firstSliceResourceIds.includes(entry.resourceId)));
  const settlementGarrisonOrder = Object.freeze([
    { unitId: "watch_levy", label: "Watch Levy" },
    { unitId: "bow_crew", label: "Bow Crew" },
    { unitId: "trail_scout", label: "Trail Scout" },
    { unitId: "light_raider", label: "Light Raider" },
  ].filter((entry) => firstSlicePlayableUnitIdSet.has(entry.unitId)));
  const populatedSettlementScenario = mockClientShellState.panels.settlement.scenarios.populated;
  const defaultBuildQueueEntries = (populatedSettlementScenario.buildQueue || []).map((item) => ({
    ...item,
  }));

  const settlementActionRuntime = {
    settlement_id: firstSliceDefaultSessionEntrySettlementId,
    settlement_name: firstSlicePrimarySettlement.settlement_name,
    player_id: stableLocalProfile.player_id,
    profile_id: stableLocalProfile.profile_id,
    resource_stock_by_id: {
      food: 1860,
      wood: 1240,
      stone: 980,
      iron: 715,
    },
    storage_cap_by_id: {
      food: 2400,
      wood: 2000,
      stone: 1800,
      iron: 1600,
    },
    passive_prod_per_h_by_id: {
      food: 540,
      wood: 360,
      stone: 240,
      iron: 180,
    },
    building_level_by_id: {
      grain_plot: 6,
    },
    garrison_count_by_unit_id: {
      watch_levy: 120,
      bow_crew: 48,
      trail_scout: 64,
      light_raider: 12,
    },
    build_queue_entries: defaultBuildQueueEntries,
    action_outcome_mode: "success",
    pending_action: null,
    last_outcome: null,
    next_correlation_id: 1,
  };
  const settlementContractActionGateRuntime = {
    build: {
      building_id: "grain_plot",
      required_cost_by_id: null,
      cooldown_ends_at: null,
    },
    train: {
      unit_id: "watch_levy",
      required_cost_by_id: null,
      queue_available_at: null,
    },
  };
  const settlementContractGateRefreshTimerByAction = {
    build: null,
    train: null,
  };
  const firstSliceWorldMapHostileDispatchFixture = Object.freeze({
    source_origin: {
      x: 0,
      y: 0,
    },
    seconds_per_tile: 30,
    army_name: "Cinderwatch Vanguard",
    dispatched_units: Object.freeze([
      {
        unit_id: "watch_levy",
        unit_count: 10,
        unit_attack: 5,
      },
    ]),
  });
  const worldMapHostileEventPayloadOrder = Object.freeze([
    "dispatch_sent",
    "march_arrived",
    "combat_resolved",
  ]);
  const worldMapHostileHeroRuntimePayloadOrder = Object.freeze([
    "hero_attached",
  ]);
  const heroDispatchUnlockGateV1 = Object.freeze({
    min_settlement_level: 4,
    min_barracks_level: 2,
    min_completed_attacks: 1,
    min_completed_scouts: 1,
    tutorial_dependency: "tutorial_core_v1_complete",
  });
  const heroDispatchProfileSeed = Object.freeze([
    {
      hero_id: "hero_legion_prefect",
      display_name: "Legion Prefect",
      ability_id: "ability_iron_mandate",
      ability_name: "Iron Mandate",
      cooldown_s: 21_600,
      readiness_state: "ready",
      cooldown_ends_at: null,
      modifier_deltas: Object.freeze([
        "army_attack_mult x1.12 (90s)",
        "morale_loss_taken_mult x0.85 (90s)",
      ]),
      modifier_delta_summary: "Attack +12%, morale loss taken -15% for opening combat window.",
    },
    {
      hero_id: "hero_fen_oracle",
      display_name: "Fen Oracle",
      ability_id: "ability_rotwrit_veil",
      ability_name: "Rotwrit Veil",
      cooldown_s: 28_800,
      readiness_state: "ready",
      cooldown_ends_at: null,
      modifier_deltas: Object.freeze([
        "scout_visibility_radius +1 (next scout)",
        "ambush_chance_mult x1.10 (first contact)",
      ]),
      modifier_delta_summary: "Scout reach +1 and first-contact ambush chance +10% on next qualifying action.",
    },
  ]);
  const worldMapActionRuntime = {
    pending_action: null,
    selected_marker_id: firstSliceHomeMarkerId,
    next_march_sequence: 1,
    hostile_dispatch_outcome: null,
    unavailable_scout_tile_by_id: {},
    player_id: stableLocalProfile.player_id,
    profile_id: stableLocalProfile.profile_id,
    completed_attacks: 0,
    completed_scouts: 0,
    hero_unlock_progress: {
      settlement_level: 1,
      barracks_level: 1,
      tutorial_dependency_complete: false,
    },
    hero_dispatch: {
      selected_hero_id: null,
      heroes: heroDispatchProfileSeed.map((entry) => ({
        ...entry,
        modifier_deltas: [...entry.modifier_deltas],
      })),
    },
  };
  let worldMapHeroCooldownRefreshTimer = null;

  const cloneResourceValues = (values) => {
    const normalized = {};
    for (const resourceId of firstSliceResourceIds) {
      normalized[resourceId] = Number(values?.[resourceId]) || 0;
    }
    return normalized;
  };
  const parseIsoInstant = (value) => {
    if (value instanceof Date && Number.isFinite(value.getTime())) {
      return value;
    }
    if (typeof value !== "string") {
      return null;
    }
    const normalized = value.trim();
    if (normalized.length < 1) {
      return null;
    }
    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return parsed;
  };
  const normalizeResourceCostById = (values) => {
    if (!values || typeof values !== "object") {
      return null;
    }
    const normalized = cloneResourceValues(values);
    const hasAtLeastOneCost = firstSliceResourceIds.some((resourceId) => normalized[resourceId] > 0);
    return hasAtLeastOneCost ? normalized : null;
  };
  const hasInsufficientResourceStock = (requiredById, availableById) =>
    firstSliceResourceIds.some(
      (resourceId) => (Number(availableById?.[resourceId]) || 0) < (Number(requiredById?.[resourceId]) || 0),
    );
  const buildMissingResourceValues = (requiredById, availableById) => {
    const missing = {};
    for (const resourceId of firstSliceResourceIds) {
      const requiredValue = Number(requiredById?.[resourceId]) || 0;
      const availableValue = Number(availableById?.[resourceId]) || 0;
      missing[resourceId] = Math.max(0, requiredValue - availableValue);
    }
    return missing;
  };
  const clearSettlementContractGateRefreshTimer = (actionType) => {
    const existingTimer = settlementContractGateRefreshTimerByAction[actionType];
    if (existingTimer !== null) {
      clearTimeout(existingTimer);
      settlementContractGateRefreshTimerByAction[actionType] = null;
    }
  };
  const scheduleSettlementContractGateRefresh = (actionType, instantValue) => {
    clearSettlementContractGateRefreshTimer(actionType);
    const expiresAt = parseIsoInstant(instantValue);
    if (expiresAt === null) {
      return;
    }
    const remainingMs = expiresAt.getTime() - Date.now();
    if (remainingMs <= 0) {
      return;
    }
    const delayMs = Math.min(remainingMs + 50, 2_147_483_647);
    settlementContractGateRefreshTimerByAction[actionType] = window.setTimeout(() => {
      settlementContractGateRefreshTimerByAction[actionType] = null;
      renderPanels();
    }, delayMs);
  };

  const formatEtaFromSeconds = (durationSeconds) => {
    const totalSeconds = Math.max(0, Math.floor(Number(durationSeconds) || 0));
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
  };
  const resolveHeroDispatchUnlockState = () => {
    const progress = worldMapActionRuntime.hero_unlock_progress || {};
    return (
      (Number(progress.settlement_level) || 0) >= heroDispatchUnlockGateV1.min_settlement_level
      && (Number(progress.barracks_level) || 0) >= heroDispatchUnlockGateV1.min_barracks_level
      && (Number(worldMapActionRuntime.completed_attacks) || 0) >= heroDispatchUnlockGateV1.min_completed_attacks
      && (Number(worldMapActionRuntime.completed_scouts) || 0) >= heroDispatchUnlockGateV1.min_completed_scouts
      && progress.tutorial_dependency_complete === true
    );
  };
  const getWorldMapHeroDispatchRoster = () =>
    Array.isArray(worldMapActionRuntime.hero_dispatch?.heroes)
      ? worldMapActionRuntime.hero_dispatch.heroes
      : [];
  const resolveSelectedWorldMapDispatchHero = () => {
    if (!resolveHeroDispatchUnlockState()) {
      return null;
    }
    const selectedHeroId = String(worldMapActionRuntime.hero_dispatch?.selected_hero_id || "").trim();
    if (selectedHeroId.length < 1) {
      return null;
    }
    const selectedHero = getWorldMapHeroDispatchRoster().find((hero) => hero.hero_id === selectedHeroId) || null;
    if (!selectedHero || selectedHero.readiness_state !== "ready") {
      return null;
    }
    return selectedHero;
  };
  const setSelectedWorldMapDispatchHero = (heroId) => {
    if (!resolveHeroDispatchUnlockState()) {
      worldMapActionRuntime.hero_dispatch.selected_hero_id = null;
      return;
    }

    const normalizedHeroId = String(heroId || "").trim();
    if (normalizedHeroId.length < 1 || normalizedHeroId === "none") {
      worldMapActionRuntime.hero_dispatch.selected_hero_id = null;
      return;
    }

    const selectedHero = getWorldMapHeroDispatchRoster().find((hero) => hero.hero_id === normalizedHeroId);
    if (!selectedHero || selectedHero.readiness_state !== "ready") {
      return;
    }
    worldMapActionRuntime.hero_dispatch.selected_hero_id = normalizedHeroId;
  };
  const formatDurationFromMs = (durationMs) => {
    const totalSeconds = Math.max(0, Math.floor((Number(durationMs) || 0) / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${hours}h ${String(minutes).padStart(2, "0")}m`;
    }
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };
  const resolveHeroReadinessSummary = (hero) => {
    if (!hero || hero.readiness_state !== "on_cooldown") {
      return "Ready now";
    }
    const cooldownEndsAt = parseIsoInstant(hero.cooldown_ends_at);
    if (cooldownEndsAt === null) {
      return "Cooldown";
    }
    const remainingMs = cooldownEndsAt.getTime() - Date.now();
    if (remainingMs <= 0) {
      return "Ready now";
    }
    return `Cooldown ${formatDurationFromMs(remainingMs)} remaining`;
  };
  const clearWorldMapHeroCooldownRefreshTimer = () => {
    if (worldMapHeroCooldownRefreshTimer !== null) {
      clearTimeout(worldMapHeroCooldownRefreshTimer);
      worldMapHeroCooldownRefreshTimer = null;
    }
  };
  const syncWorldMapHeroDispatchReadiness = () => {
    const roster = getWorldMapHeroDispatchRoster();
    if (roster.length < 1) {
      return false;
    }

    let hasUpdated = false;
    for (const hero of roster) {
      if (hero.readiness_state !== "on_cooldown") {
        continue;
      }
      const cooldownEndsAt = parseIsoInstant(hero.cooldown_ends_at);
      if (cooldownEndsAt === null || cooldownEndsAt.getTime() > Date.now()) {
        continue;
      }

      hero.readiness_state = "ready";
      hero.cooldown_ends_at = null;
      appendEventFeedEntry({
        contentKey: "event.hero.cooldown_complete",
        tokens: {
          hero_id: hero.hero_id,
          ability_id: hero.ability_id,
        },
        meta: "Just now | World | HERO cooldown",
        priority: "normal",
      });
      hasUpdated = true;
    }

    if (!resolveHeroDispatchUnlockState()) {
      worldMapActionRuntime.hero_dispatch.selected_hero_id = null;
    } else if (resolveSelectedWorldMapDispatchHero() === null) {
      const selectedHeroId = String(worldMapActionRuntime.hero_dispatch.selected_hero_id || "").trim();
      if (selectedHeroId.length > 0) {
        worldMapActionRuntime.hero_dispatch.selected_hero_id = null;
        hasUpdated = true;
      }
    }

    return hasUpdated;
  };
  const scheduleWorldMapHeroCooldownRefresh = () => {
    clearWorldMapHeroCooldownRefreshTimer();
    const cooldownInstantValues = getWorldMapHeroDispatchRoster()
      .filter((hero) => hero.readiness_state === "on_cooldown")
      .map((hero) => parseIsoInstant(hero.cooldown_ends_at))
      .filter(Boolean);
    if (cooldownInstantValues.length < 1) {
      return;
    }

    const nearestCooldown = cooldownInstantValues
      .map((value) => value.getTime())
      .sort((a, b) => a - b)[0];
    const delayMs = Math.max(50, Math.min(nearestCooldown - Date.now() + 50, 2_147_483_647));
    worldMapHeroCooldownRefreshTimer = window.setTimeout(() => {
      worldMapHeroCooldownRefreshTimer = null;
      const readinessUpdated = syncWorldMapHeroDispatchReadiness();
      if (readinessUpdated) {
        renderPanels();
      } else {
        renderMapPanel();
      }
    }, delayMs);
  };

  const toIsoOrValue = (value) => (value instanceof Date ? value.toISOString() : value);
  const firstSliceTransportRoutes = Object.freeze({
    settlement_tick: "/settlements/{settlementId}/tick",
    building_upgrade: "/settlements/{settlementId}/buildings/{buildingId}/upgrade",
    unit_train: "/settlements/{settlementId}/units/{unitId}/train",
    world_map_tile_interact: "/world-map/tiles/{tileId}/interact",
    world_map_settlement_attack: "/world-map/settlements/{targetSettlementId}/attack",
    world_map_march_snapshot: "/world-map/marches/{marchId}/snapshot",
  });

  const resolveIsoInstant = (value, fallbackIso) => {
    if (value instanceof Date && Number.isFinite(value.getTime())) {
      return value.toISOString();
    }
    if (typeof value === "string") {
      const normalized = value.trim();
      if (normalized.length > 0) {
        const parsed = new Date(normalized);
        if (!Number.isNaN(parsed.getTime())) {
          return parsed.toISOString();
        }
      }
    }
    return fallbackIso;
  };

  const resolveWindowTransportBridge = () => {
    const transportBridge = window.__RK_FIRST_SLICE_SETTLEMENT_LOOP_TRANSPORT__;
    if (transportBridge && typeof transportBridge.invoke === "function") {
      return transportBridge;
    }
    return null;
  };

  const interpolateTransportRoutePath = (routeTemplate, path = {}) =>
    String(routeTemplate).replace(/\{([^}]+)\}/g, (_, tokenName) => {
      const rawValue = path?.[tokenName];
      const normalizedValue = rawValue === undefined || rawValue === null ? "" : String(rawValue);
      return encodeURIComponent(normalizedValue);
    });

  const invokeFirstSliceTransportRoute = async (routeTemplate, request) => {
    const transportBridge = resolveWindowTransportBridge();
    if (transportBridge !== null) {
      try {
        const bridgeResponse = await Promise.resolve(transportBridge.invoke(routeTemplate, request));
        if (
          bridgeResponse
          && Number.isFinite(bridgeResponse.status_code)
          && Object.prototype.hasOwnProperty.call(bridgeResponse, "body")
        ) {
          return bridgeResponse;
        }

        return {
          status_code: 500,
          body: {
            code: "transport_invalid_response",
            message: `Transport bridge returned an invalid response for '${routeTemplate}'.`,
          },
        };
      } catch (error) {
        return {
          status_code: 500,
          body: {
            code: "transport_handler_error",
            message: error instanceof Error ? error.message : "Transport bridge invocation failed.",
          },
        };
      }
    }

    const routePath = interpolateTransportRoutePath(routeTemplate, request?.path);

    try {
      const response = await fetch(routePath, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(request?.body || {}),
      });

      let responseBody = {};
      try {
        responseBody = await response.json();
      } catch {
        responseBody = {};
      }

      return {
        status_code: response.status,
        body: responseBody,
      };
    } catch (error) {
      return {
        status_code: 503,
        body: {
          code: "transport_unreachable",
          message: error instanceof Error ? error.message : "Transport endpoint is unreachable.",
        },
      };
    }
  };

  const unwrapFirstSliceTransportSuccess = (routeTemplate, transportResponse) => {
    if (transportResponse?.status_code === 200) {
      return transportResponse.body;
    }

    const errorCode =
      typeof transportResponse?.body?.code === "string" && transportResponse.body.code.length > 0
        ? transportResponse.body.code
        : "transport_handler_error";
    const errorMessage =
      typeof transportResponse?.body?.message === "string" && transportResponse.body.message.length > 0
        ? transportResponse.body.message
        : `Transport invocation failed for '${routeTemplate}'.`;
    const error = new Error(errorMessage);
    error.code = errorCode;
    error.status_code =
      Number.isFinite(transportResponse?.status_code) ? Math.trunc(transportResponse.status_code) : 500;
    throw error;
  };

  const createFirstSliceClientContractAdapter = () => ({
    tickSettlementCommand: async (input) => {
      const nowIso = new Date().toISOString();
      const requestedAtIso = resolveIsoInstant(input.requested_at, nowIso);
      const requestedAtMs = new Date(requestedAtIso).getTime();
      const durationMs = Math.max(0, Math.floor(Number(input.duration_ms) || 0));
      const tickEndedAtIso = new Date(requestedAtMs + durationMs).toISOString();

      const transportResponse = await invokeFirstSliceTransportRoute(
        firstSliceTransportRoutes.settlement_tick,
        {
          path: {
            settlementId: input.settlement_id,
          },
          body: {
            settlement_id: input.settlement_id,
            flow_version: "v1",
            player_id: input.player_id,
            tick_started_at: requestedAtIso,
            tick_ended_at: tickEndedAtIso,
            settlement_name: input.settlement_name,
            resource_stock_by_id: input.resource_stock_by_id,
            storage_cap_by_id: input.storage_cap_by_id,
            passive_prod_per_h_by_id: input.passive_prod_per_h_by_id,
            correlation_id: input.correlation_id,
          },
        },
      );
      return unwrapFirstSliceTransportSuccess(firstSliceTransportRoutes.settlement_tick, transportResponse);
    },
    buildUpgradeCommand: async (input) => {
      const requestedAtIso = resolveIsoInstant(input.requested_at, new Date().toISOString());

      const transportResponse = await invokeFirstSliceTransportRoute(
        firstSliceTransportRoutes.building_upgrade,
        {
          path: {
            settlementId: input.settlement_id,
            buildingId: input.building_id,
          },
          body: {
            settlement_id: input.settlement_id,
            building_id: input.building_id,
            flow_version: "v1",
            player_id: input.player_id,
            current_level: Number(input.current_level) || 0,
            requested_at: requestedAtIso,
            settlement_name: input.settlement_name,
            resource_stock_by_id: input.resource_stock_by_id,
            cooldown_ends_at: resolveIsoInstant(input.cooldown_ends_at, ""),
            active_upgrade_ends_at: resolveIsoInstant(input.active_upgrade_ends_at, ""),
            correlation_id: input.correlation_id,
          },
        },
      );
      return unwrapFirstSliceTransportSuccess(firstSliceTransportRoutes.building_upgrade, transportResponse);
    },
    trainUnitCommand: async (input) => {
      const requestedAtIso = resolveIsoInstant(input.requested_at, new Date().toISOString());

      const transportResponse = await invokeFirstSliceTransportRoute(
        firstSliceTransportRoutes.unit_train,
        {
          path: {
            settlementId: input.settlement_id,
            unitId: input.unit_id,
          },
          body: {
            settlement_id: input.settlement_id,
            unit_id: input.unit_id,
            flow_version: "v1",
            player_id: input.player_id,
            quantity: Number(input.quantity) || 0,
            requested_at: requestedAtIso,
            barracks_level: Number(input.barracks_level) || 0,
            settlement_name: input.settlement_name,
            resource_stock_by_id: input.resource_stock_by_id,
            queue_available_at: resolveIsoInstant(input.queue_available_at, ""),
            training_time_multiplier: Number(input.training_time_multiplier) || undefined,
            correlation_id: input.correlation_id,
          },
        },
      );
      return unwrapFirstSliceTransportSuccess(firstSliceTransportRoutes.unit_train, transportResponse);
    },
    scoutTileInteractCommand: async (input) => {
      const transportResponse = await invokeFirstSliceTransportRoute(
        firstSliceTransportRoutes.world_map_tile_interact,
        {
          path: {
            tileId: input.tile_id,
          },
          body: {
            settlement_id: input.settlement_id,
            tile_id: input.tile_id,
            interaction_type: "scout",
            flow_version: "v1",
            settlement_name: input.settlement_name,
            player_id: input.player_id,
            assignment_context_type: input.assignment_context_type,
            assignment_context_id: input.assignment_context_id,
          },
        },
      );
      return unwrapFirstSliceTransportSuccess(
        firstSliceTransportRoutes.world_map_tile_interact,
        transportResponse,
      );
    },
    dispatchHostileSettlementAttackCommand: async (input) => {
      const departedAtIso = resolveIsoInstant(input.departed_at, new Date().toISOString());
      const transportResponse = await invokeFirstSliceTransportRoute(
        firstSliceTransportRoutes.world_map_settlement_attack,
        {
          path: {
            targetSettlementId: input.target_settlement_id,
          },
          body: {
            flow_version: "v1",
            march_id: input.march_id,
            source_settlement_id: input.source_settlement_id,
            source_settlement_name: input.source_settlement_name,
            target_settlement_id: input.target_settlement_id,
            target_settlement_name: input.target_settlement_name,
            target_tile_label: input.target_tile_label,
            origin: input.origin,
            target: input.target,
            defender_garrison_strength: Number(input.defender_garrison_strength) || 0,
            dispatched_units: input.dispatched_units,
            departed_at: departedAtIso,
            seconds_per_tile: Number(input.seconds_per_tile) || undefined,
            army_name: input.army_name,
            player_id: input.player_id,
            hero_id: input.hero_id,
            hero_target_scope: input.hero_target_scope,
            hero_assignment_context_id: input.hero_assignment_context_id,
          },
        },
      );
      return unwrapFirstSliceTransportSuccess(
        firstSliceTransportRoutes.world_map_settlement_attack,
        transportResponse,
      );
    },
    getMarchSnapshotCommand: async (input) => {
      const observedAtIso = resolveIsoInstant(input.observed_at, new Date().toISOString());
      const transportResponse = await invokeFirstSliceTransportRoute(
        firstSliceTransportRoutes.world_map_march_snapshot,
        {
          path: {
            marchId: input.march_id,
          },
          body: {
            march_id: input.march_id,
            flow_version: "v1",
            observed_at: observedAtIso,
          },
        },
      );
      return unwrapFirstSliceTransportSuccess(
        firstSliceTransportRoutes.world_map_march_snapshot,
        transportResponse,
      );
    },
  });

  const firstSliceClientContractAdapter = createFirstSliceClientContractAdapter();

  const escapeHtml = (value) =>
    String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const formatNumber = (value) => numberFormatter.format(value);

  const clampPercent = (value) => Math.max(0, Math.min(100, Number(value) || 0));
  const formatTemplateTokenValue = (value) => {
    if (value === undefined || value === null) {
      return "";
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (Array.isArray(value)) {
      return value.map((item) => formatTemplateTokenValue(item)).join(", ");
    }

    if (typeof value === "object") {
      return Object.keys(value)
        .sort()
        .map((key) => `${key}: ${formatTemplateTokenValue(value[key])}`)
        .join(", ");
    }

    return String(value);
  };
  const fillTemplateTokens = (template, tokens = {}) =>
    String(template).replace(/\{([a-z0-9_]+)\}/gi, (match, tokenName) =>
      Object.prototype.hasOwnProperty.call(tokens, tokenName)
        ? formatTemplateTokenValue(tokens[tokenName])
        : match,
    );
  const normalizeManifestEventContentKey = (contentKey) =>
    String(contentKey || "").trim();
  const isManifestAllowedCanonicalEventContentKey = (contentKey) =>
    firstSliceAllowedEventContentKeySet.has(contentKey)
    && !firstSliceDeferredPostSliceEventContentKeySet.has(contentKey);
  const isManifestAllowedCanonicalDefaultEventContentKey = (contentKey) =>
    isManifestAllowedCanonicalEventContentKey(contentKey)
    && isFirstSliceCanonicalDefaultMigrationEventKey(contentKey);
  const resolveCanonicalFirstSliceEventKeyFromLegacyAlias = (legacyAliasKey) => {
    const normalizedLegacyAlias = normalizeManifestEventContentKey(legacyAliasKey);
    if (normalizedLegacyAlias.length < 1) {
      return "";
    }
    if (!isFirstSliceCompatibilityOnlyMigrationEventKey(normalizedLegacyAlias)) {
      return "";
    }
    const canonicalCandidates =
      firstSliceCanonicalEventKeyCandidatesByLegacyAlias[normalizedLegacyAlias];
    if (!Array.isArray(canonicalCandidates) || canonicalCandidates.length < 1) {
      return "";
    }
    for (const canonicalCandidate of canonicalCandidates) {
      if (isManifestAllowedCanonicalDefaultEventContentKey(canonicalCandidate)) {
        return canonicalCandidate;
      }
    }
    return "";
  };
  const resolveCanonicalHostileRuntimeEventKeyFromLegacyAlias = (legacyAliasKey) => {
    const normalizedLegacyAlias = normalizeManifestEventContentKey(legacyAliasKey);
    if (normalizedLegacyAlias.length < 1) {
      return "";
    }
    if (!isFirstSliceCompatibilityOnlyMigrationEventKey(normalizedLegacyAlias)) {
      return "";
    }
    if (!firstSliceHostileRuntimeCompatibilityAliasOnlyKeySet.has(normalizedLegacyAlias)) {
      return "";
    }
    const canonicalCandidates =
      firstSliceHostileRuntimeCanonicalKeyCandidatesByLegacyAlias[normalizedLegacyAlias];
    if (!Array.isArray(canonicalCandidates) || canonicalCandidates.length < 1) {
      return "";
    }
    for (const canonicalCandidate of canonicalCandidates) {
      if (isManifestAllowedCanonicalDefaultEventContentKey(canonicalCandidate)) {
        return canonicalCandidate;
      }
    }
    return "";
  };
  const resolveCanonicalHostileRuntimeEventKey = (contentKey) => {
    const normalizedContentKey = normalizeManifestEventContentKey(contentKey);
    if (normalizedContentKey.length < 1) {
      return "";
    }
    if (firstSliceHostileRuntimeCanonicalKeySet.has(normalizedContentKey)) {
      return isManifestAllowedCanonicalDefaultEventContentKey(normalizedContentKey)
        ? normalizedContentKey
        : "";
    }
    return resolveCanonicalHostileRuntimeEventKeyFromLegacyAlias(normalizedContentKey);
  };
  const resolveDeterministicFallbackEventContentKey = (contentKey) => {
    const normalizedContentKey = normalizeManifestEventContentKey(contentKey);
    if (
      normalizedContentKey.startsWith("event.tick.")
      || normalizedContentKey.startsWith("event.economy.")
    ) {
      return "event.tick.passive_gain_reasoned";
    }
    if (
      normalizedContentKey.startsWith("event.build.")
      || normalizedContentKey.startsWith("event.buildings.")
    ) {
      return "event.build.failure_invalid_state";
    }
    if (
      normalizedContentKey.startsWith("event.train.")
      || normalizedContentKey.startsWith("event.units.")
    ) {
      return "event.train.failure_invalid_state";
    }
    if (
      normalizedContentKey.startsWith("event.scout.")
      || normalizedContentKey.startsWith("event.world.scout_")
    ) {
      return "event.scout.report_empty";
    }
    if (normalizedContentKey.startsWith("event.combat.")) {
      return "event.combat.hostile_resolve_defender_win";
    }
    return firstSliceDeterministicFallbackEventContentKey;
  };
  const resolveManifestScopedEventContentKey = (contentKey) => {
    const normalizedContentKey = normalizeManifestEventContentKey(contentKey);
    if (normalizedContentKey.length < 1) {
      return "";
    }
    if (isManifestAllowedCanonicalDefaultEventContentKey(normalizedContentKey)) {
      return normalizedContentKey;
    }
    if (!isFirstSliceCompatibilityOnlyMigrationEventKey(normalizedContentKey)) {
      return resolveDeterministicFallbackEventContentKey(normalizedContentKey);
    }
    const hostileCanonicalKey = resolveCanonicalHostileRuntimeEventKey(normalizedContentKey);
    if (hostileCanonicalKey.length > 0) {
      return hostileCanonicalKey;
    }
    const canonicalKeyFromLegacyAlias =
      resolveCanonicalFirstSliceEventKeyFromLegacyAlias(normalizedContentKey);
    return canonicalKeyFromLegacyAlias.length > 0
      ? canonicalKeyFromLegacyAlias
      : resolveDeterministicFallbackEventContentKey(normalizedContentKey);
  };
  const mapBackendEventKeyToClientKey = (contentKey) =>
    resolveManifestScopedEventContentKey(contentKey);
  const hostileDispatchFailureContentKeyByCode = Object.freeze({
    source_target_not_foreign: "event.world.hostile_dispatch_failed_source_target_not_foreign",
    max_active_marches_reached: "event.world.hostile_dispatch_failed_max_active_marches_reached",
    path_blocked_impassable: "event.world.hostile_dispatch_failed_path_blocked_impassable",
    march_already_exists: "event.world.hostile_dispatch_failed_march_already_exists",
    feature_not_in_slice: "event.world.hostile_dispatch_failed_feature_not_in_slice",
    hero_unavailable: "event.world.hostile_dispatch_failed_hero_unavailable",
    hero_already_assigned: "event.world.hostile_dispatch_failed_hero_already_assigned",
    hero_target_scope_mismatch: "event.world.hostile_dispatch_failed_hero_target_scope_mismatch",
  });
  const resolveHostileDispatchFailureContentKey = (errorCode) => {
    const normalizedErrorCode = String(errorCode || "").trim().toLowerCase();
    if (normalizedErrorCode.length < 1) {
      return "event.world.hostile_dispatch_failed";
    }
    return hostileDispatchFailureContentKeyByCode[normalizedErrorCode] || "event.world.hostile_dispatch_failed";
  };
  const getNarrativeTemplateByContentKey = (contentKey) => {
    const normalizedContentKey = String(contentKey || "").trim();
    if (normalizedContentKey.length < 1) {
      return "";
    }
    const manifestTemplateRow =
      firstSliceNarrativeTemplateRowsByContentKey[normalizedContentKey];
    if (manifestTemplateRow && typeof manifestTemplateRow.template === "string") {
      return manifestTemplateRow.template;
    }
    return localNarrativeFallbackTemplates[normalizedContentKey] || "";
  };
  const getNarrativeTemplateWithFallback = (contentKey) => {
    if (!contentKey) {
      return "";
    }
    const normalizedContentKey = String(contentKey).trim();
    if (normalizedContentKey.length < 1) {
      return "";
    }
    const directTemplate = getNarrativeTemplateByContentKey(normalizedContentKey);
    if (directTemplate) {
      return directTemplate;
    }
    if (!normalizedContentKey.startsWith("event.")) {
      return "";
    }
    const scopedContentKey = resolveManifestScopedEventContentKey(normalizedContentKey);
    const canonicalScopedContentKey = isManifestAllowedCanonicalEventContentKey(scopedContentKey)
      ? scopedContentKey
      : resolveCanonicalFirstSliceEventKeyFromLegacyAlias(scopedContentKey);
    const candidates = [];
    const addCandidate = (candidate) => {
      const normalizedCandidate = String(candidate || "").trim();
      if (normalizedCandidate.length > 0 && !candidates.includes(normalizedCandidate)) {
        candidates.push(normalizedCandidate);
      }
    };
    const deterministicResolutionOrder =
      firstSliceNarrativeTemplateLookupResolutionOrderByCanonicalEventKey[
        canonicalScopedContentKey || scopedContentKey
      ] || [];
    for (const lookupKey of deterministicResolutionOrder) {
      addCandidate(lookupKey);
    }
    addCandidate(canonicalScopedContentKey || scopedContentKey);
    addCandidate(normalizedContentKey);
    for (const candidateKey of candidates) {
      const candidateTemplate = getNarrativeTemplateByContentKey(candidateKey);
      if (candidateTemplate) {
        return candidateTemplate;
      }
    }
    return "";
  };
  const getNarrativeText = (contentKey, tokens) => {
    const effectiveContentKey = String(contentKey || "").startsWith("event.")
      ? resolveManifestScopedEventContentKey(contentKey)
      : contentKey;
    const template = getNarrativeTemplateWithFallback(effectiveContentKey);

    if (!template) {
      if (
        String(effectiveContentKey || "").startsWith("event.")
        && effectiveContentKey.length > 0
      ) {
        const templateFallbackKey = resolveDeterministicFallbackEventContentKey(
          effectiveContentKey,
        );
        if (templateFallbackKey === effectiveContentKey) {
          return effectiveContentKey
            ? `[Missing placeholder template: ${effectiveContentKey}]`
            : "";
        }
        const fallbackTemplate = getNarrativeTemplateWithFallback(
          templateFallbackKey,
        );
        if (fallbackTemplate) {
          return fillTemplateTokens(fallbackTemplate, {
            ...buildDeterministicFallbackTokens(templateFallbackKey, effectiveContentKey),
            ...(tokens || {}),
          });
        }
      }
      return effectiveContentKey
        ? `[Missing placeholder template: ${effectiveContentKey}]`
        : "";
    }

    return fillTemplateTokens(template, tokens);
  };

  const getPanelScenario = (panelKey) => {
    const panel = mockClientShellState.panels[panelKey];
    const mode = mockClientShellState.panelModes[panelKey];
    return {
      panel,
      mode,
      scenario: panel.scenarios[mode],
    };
  };

  const getPopulatedMapScenario = () => mockClientShellState.panels.worldMap.scenarios.populated;
  const getPopulatedEventScenario = () => mockClientShellState.panels.eventFeed.scenarios.populated;
  const normalizeMapCoordinate = (value, fallback) =>
    Number.isFinite(value) ? Number(value) : Number(fallback) || 0;
  const toMapMarkerDistance = (fromMarker, toMarker) => {
    if (!fromMarker || !toMarker || !fromMarker.coords || !toMarker.coords) {
      return 0;
    }
    const deltaX = Math.abs(
      normalizeMapCoordinate(toMarker.coords.x, 0) - normalizeMapCoordinate(fromMarker.coords.x, 0),
    );
    const deltaY = Math.abs(
      normalizeMapCoordinate(toMarker.coords.y, 0) - normalizeMapCoordinate(fromMarker.coords.y, 0),
    );
    return Math.max(0, Math.trunc(deltaX + deltaY));
  };
  const getWorldMapMarkerList = () => {
    const mapScenario = getPopulatedMapScenario();
    return Array.isArray(mapScenario.markers) ? mapScenario.markers : [];
  };
  const resolveWorldMapHomeMarker = () =>
    getWorldMapMarkerList().find((marker) => marker.target_kind === "home_settlement")
    || getWorldMapMarkerList()[0]
    || null;
  const resolveSelectedWorldMapMarker = () => {
    const markerList = getWorldMapMarkerList();
    if (markerList.length < 1) {
      return null;
    }

    const selectedMarkerId = String(worldMapActionRuntime.selected_marker_id || "").trim();
    if (selectedMarkerId.length > 0) {
      const selectedByRuntime = markerList.find((marker) => marker.marker_id === selectedMarkerId);
      if (selectedByRuntime) {
        return selectedByRuntime;
      }
    }

    const selectedByScenario = markerList.find((marker) => marker.selected === true);
    if (selectedByScenario) {
      return selectedByScenario;
    }

    return markerList[0];
  };
  const buildSelectedTileSnapshotFromMarker = (marker) => {
    if (!marker) {
      return {
        Type: "No Selection",
        Control: "N/A",
        Travel: "N/A",
      };
    }

    const homeMarker = resolveWorldMapHomeMarker();
    const distanceTiles = toMapMarkerDistance(homeMarker, marker);
    const etaSeconds = distanceTiles * firstSliceWorldMapHostileDispatchFixture.seconds_per_tile;
    if (marker.target_kind === "home_settlement") {
      return {
        Type: "Home Settlement",
        Control: "Player Controlled",
        Travel: "Origin",
      };
    }
    if (marker.target_kind === "hostile_settlement") {
      return {
        Type: "Foreign Settlement",
        Control: "Hostile Placeholder",
        Travel: `ETA ${formatEtaFromSeconds(etaSeconds)} (${distanceTiles} tiles)`,
      };
    }
    return {
      Type: "Friendly Placeholder",
      Control: "Friendly Presence",
      Travel: `ETA ${formatEtaFromSeconds(etaSeconds)} (${distanceTiles} tiles)`,
    };
  };
  const syncWorldMapScenarioFromRuntime = () => {
    const mapScenario = getPopulatedMapScenario();
    const markerList = getWorldMapMarkerList();
    if (markerList.length < 1) {
      mapScenario.selected_tile_id = "";
      mapScenario.selectedTile = buildSelectedTileSnapshotFromMarker(null);
      return;
    }

    const selectedMarker = resolveSelectedWorldMapMarker() || markerList[0];
    worldMapActionRuntime.selected_marker_id = selectedMarker.marker_id;
    mapScenario.selected_marker_id = selectedMarker.marker_id;
    mapScenario.selected_tile_id = selectedMarker.tile_id || "";
    mapScenario.selectedTile = buildSelectedTileSnapshotFromMarker(selectedMarker);
    mapScenario.markers = markerList.map((marker) => ({
      ...marker,
      selected: marker.marker_id === selectedMarker.marker_id,
    }));
  };
  const setSelectedWorldMapMarker = (markerId) => {
    if (!markerId || mockClientShellState.panelModes.worldMap !== "populated") {
      return;
    }
    worldMapActionRuntime.selected_marker_id = String(markerId).trim();
    syncWorldMapScenarioFromRuntime();
  };
  const buildDeterministicFallbackTokens = (fallbackContentKey, sourceContentKey) => {
    if (fallbackContentKey === "event.tick.passive_gain_reasoned") {
      return {
        settlement_name: settlementActionRuntime.settlement_name,
        duration_ms: 0,
        reason_codes: `fallback_for:${sourceContentKey || "unknown"}`,
      };
    }
    if (fallbackContentKey === "event.build.failure_invalid_state") {
      return {
        building_id: "grain_plot",
        settlement_name: settlementActionRuntime.settlement_name,
        invalid_reason: `fallback_for:${sourceContentKey || "unknown"}`,
      };
    }
    if (fallbackContentKey === "event.train.failure_invalid_state") {
      return {
        unit_id: "watch_levy",
        settlement_name: settlementActionRuntime.settlement_name,
        invalid_reason: `fallback_for:${sourceContentKey || "unknown"}`,
      };
    }
    if (fallbackContentKey === "event.scout.report_empty") {
      return {
        target_tile_label: firstSliceForeignHostileProfile.target_tile_label,
      };
    }
    if (fallbackContentKey === "event.combat.hostile_resolve_defender_win") {
      return {
        army_name: firstSliceWorldMapHostileDispatchFixture.army_name,
        target_tile_label: firstSliceForeignHostileProfile.target_tile_label,
      };
    }
    return {
      error_code: "content_key_missing",
      target_tile_label: firstSliceForeignHostileProfile.target_tile_label,
      message: `Fallback narrative key applied for '${sourceContentKey}'.`,
    };
  };
  const isMissingRequiredRuntimeTokenValue = (value) =>
    value === undefined
    || value === null
    || (typeof value === "string" && value.trim().length < 1);
  const resolveDeterministicHostileDispatchEtaSeconds = () => {
    const homeMarker = resolveWorldMapHomeMarker();
    const hostileMarker =
      getWorldMapMarkerList().find((marker) => marker.target_kind === "hostile_settlement")
      || resolveSelectedWorldMapMarker();
    const distanceTiles = toMapMarkerDistance(homeMarker, hostileMarker);
    return Math.max(0, distanceTiles * firstSliceWorldMapHostileDispatchFixture.seconds_per_tile);
  };
  const resolveDeterministicHostileRuntimeFallbackTokenValue = (
    canonicalContentKey,
    phase,
    tokenName,
  ) => {
    const dispatchedUnitCount = firstSliceWorldMapHostileDispatchFixture.dispatched_units
      .reduce((total, unit) => total + (Number(unit.unit_count) || 0), 0);
    if (tokenName === "target_tile_label") {
      return firstSliceForeignHostileProfile.target_tile_label;
    }
    if (tokenName === "army_name") {
      return firstSliceWorldMapHostileDispatchFixture.army_name;
    }
    if (tokenName === "origin_settlement_name") {
      return settlementActionRuntime.settlement_name;
    }
    if (tokenName === "source_settlement_name") {
      return settlementActionRuntime.settlement_name;
    }
    if (tokenName === "settlement_name") {
      return settlementActionRuntime.settlement_name;
    }
    if (tokenName === "eta_seconds") {
      return resolveDeterministicHostileDispatchEtaSeconds();
    }
    if (tokenName === "error_code") {
      return `missing_${phase}_token`;
    }
    if (tokenName === "message") {
      return `Contract fallback (${phase}) applied for ${canonicalContentKey}.`;
    }
    if (tokenName === "march_id") {
      return worldMapActionRuntime.hostile_dispatch_outcome?.march_id || "march_unknown";
    }
    if (tokenName === "attacker_units_lost") {
      return 0;
    }
    if (tokenName === "attacker_units_dispatched") {
      return dispatchedUnitCount;
    }
    if (tokenName === "defender_garrison_lost") {
      return 0;
    }
    if (tokenName === "defender_strength") {
      return Number(firstSliceForeignHostileProfile.defender_garrison_strength) || 0;
    }
    if (tokenName === "attacker_units_remaining") {
      return dispatchedUnitCount;
    }
    return `missing_${tokenName}`;
  };
  const applyDeterministicHostileRuntimeTokenFallbacks = (contentKey, payload = {}) => {
    const canonicalHostileKey = resolveCanonicalHostileRuntimeEventKey(contentKey);
    const normalizedPayload = payload && typeof payload === "object"
      ? { ...payload }
      : {};
    if (canonicalHostileKey.length < 1) {
      return normalizedPayload;
    }
    const hostileContractRow =
      firstSliceHostileRuntimeRequiredRowByCanonicalKey[canonicalHostileKey];
    if (!hostileContractRow) {
      return normalizedPayload;
    }
    for (const tokenName of hostileContractRow.required_tokens) {
      if (!isMissingRequiredRuntimeTokenValue(normalizedPayload[tokenName])) {
        continue;
      }
      normalizedPayload[tokenName] = resolveDeterministicHostileRuntimeFallbackTokenValue(
        canonicalHostileKey,
        hostileContractRow.phase,
        tokenName,
      );
    }
    return normalizedPayload;
  };

  const appendEventFeedEntry = (entry) => {
    const eventScenario = getPopulatedEventScenario();
    const existing = Array.isArray(eventScenario.events) ? eventScenario.events : [];
    const rawContentKey = String(entry?.contentKey || "").trim();
    const scopedContentKey = rawContentKey.startsWith("event.")
      ? resolveManifestScopedEventContentKey(rawContentKey)
      : rawContentKey;
    const usedFallbackContentKey =
      rawContentKey.startsWith("event.")
      && scopedContentKey !== rawContentKey;
    const fallbackTokens = usedFallbackContentKey
      ? buildDeterministicFallbackTokens(scopedContentKey, rawContentKey)
      : {};
    const normalizedEntry = {
      ...entry,
      contentKey: scopedContentKey,
      tokens: {
        ...fallbackTokens,
        ...(entry?.tokens || {}),
      },
    };
    eventScenario.events = [normalizedEntry, ...existing].slice(0, 20);
  };
  const formatEventMetaTimestamp = (instantValue) => {
    const parsed = parseIsoInstant(instantValue);
    return parsed ? parsed.toISOString() : "Just now";
  };

  const mapPlaceholderEventTokens = (contentKey, payload) => {
    const normalizedPayload = payload && typeof payload === "object"
      ? payload
      : {};

    if (contentKey === "event.tick.passive_income") {
      const deltaById = normalizedPayload.resource_delta_by_id || {};
      return applyDeterministicHostileRuntimeTokenFallbacks(contentKey, {
        settlement_name: normalizedPayload.settlement_name || settlementActionRuntime.settlement_name,
        food_gain: Number(deltaById.food) || 0,
        wood_gain: Number(deltaById.wood) || 0,
        stone_gain: Number(deltaById.stone) || 0,
        iron_gain: Number(deltaById.iron) || 0,
      });
    }

    return applyDeterministicHostileRuntimeTokenFallbacks(contentKey, {
      ...normalizedPayload,
    });
  };

  const syncSettlementScenarioFromRuntime = () => {
    const scenario = mockClientShellState.panels.settlement.scenarios.populated;
    const resourceStock = settlementActionRuntime.resource_stock_by_id;
    const storageCap = settlementActionRuntime.storage_cap_by_id;

    scenario.resources = settlementResourceCardOrder.map((entry) => {
      const value = Number(resourceStock[entry.resourceId]) || 0;
      const cap = Math.max(1, Number(storageCap[entry.resourceId]) || 1);
      return {
        label: entry.label,
        value,
        fill: clampPercent((value / cap) * 100),
      };
    });

    scenario.buildQueue = (settlementActionRuntime.build_queue_entries || []).map((item) => ({
      ...item,
    }));
    scenario.garrison = settlementGarrisonOrder.map((entry) => ({
      unit: entry.label,
      count: Number(settlementActionRuntime.garrison_count_by_unit_id[entry.unitId]) || 0,
    }));
  };

  const buildOutcomeDetail = (actionType, response) => {
    if (!response) {
      return "";
    }

    const status = response.status === "failed" ? "failed" : "accepted";
    return `${actionType.toUpperCase()} ${status} | ${response.schema_version || response.flow || "contract stub"}`;
  };

  const setLastActionOutcome = (actionType, response, contentKey, tokens) => {
    settlementActionRuntime.last_outcome = {
      actionType,
      status: response?.status === "failed" ? "failed" : "accepted",
      contentKey,
      tokens,
      detail: buildOutcomeDetail(actionType, response),
    };
  };

  const appendPlaceholderEvents = (actionType, response, fallbackKey) => {
    const placeholderEvents = Array.isArray(response?.placeholder_events)
      ? response.placeholder_events
      : [];

    if (placeholderEvents.length === 0) {
      return {
        contentKey: fallbackKey,
        tokens: {},
      };
    }

    const payload = placeholderEvents[0]?.payload || {};
    const contentKey = mapBackendEventKeyToClientKey(payload.event_key || fallbackKey);
    const tokens = mapPlaceholderEventTokens(contentKey, payload);
    appendEventFeedEntry({
      contentKey,
      tokens,
      meta: `Just now | Settlement | ${actionType.toUpperCase()} adapter`,
      priority: "normal",
    });

    return {
      contentKey,
      tokens,
    };
  };

  const applyTickActionResult = (response) => {
    if (response.status === "failed") {
      const failureKey = "event.tick.passive_gain_stalled";
      const failureTokens = {
        settlement_name: settlementActionRuntime.settlement_name,
        duration_ms: Number(response.duration_ms) || 0,
      };
      appendEventFeedEntry({
        contentKey: failureKey,
        tokens: failureTokens,
        meta: "Just now | Economy | TICK adapter",
        priority: "medium",
      });
      setLastActionOutcome("tick", response, failureKey, failureTokens);
      return;
    }

    settlementActionRuntime.resource_stock_by_id = cloneResourceValues(response.resource_stock_by_id);
    const appended = appendPlaceholderEvents("tick", response, "event.tick.passive_income");
    setLastActionOutcome("tick", response, appended.contentKey, appended.tokens);
  };

  const applyBuildActionResult = (response) => {
    if (response.status === "failed") {
      const failureKeyByCode = {
        insufficient_resources: "event.build.failure_insufficient_resources",
        cooldown: "event.build.failure_cooldown",
        invalid_state: "event.build.failure_invalid_state",
      };
      const failureCode = response.error_code || response.failure_code;
      const failureKey = failureKeyByCode[failureCode] || "event.build.failure_invalid_state";
      const failureTokens = {
        ...response,
        settlement_name: settlementActionRuntime.settlement_name,
        cooldown_ends_at: toIsoOrValue(response.cooldown_ends_at),
      };
      const nextBuildingId =
        typeof response.building_id === "string" && response.building_id.trim().length > 0
          ? response.building_id
          : settlementContractActionGateRuntime.build.building_id;
      settlementContractActionGateRuntime.build.building_id = nextBuildingId;
      if (failureCode === "insufficient_resources") {
        const requiredCostById = normalizeResourceCostById(response.required_cost_by_id);
        if (requiredCostById !== null) {
          settlementContractActionGateRuntime.build.required_cost_by_id = requiredCostById;
        }
        settlementContractActionGateRuntime.build.cooldown_ends_at = null;
        clearSettlementContractGateRefreshTimer("build");

        if (response.available_stock_by_id) {
          settlementActionRuntime.resource_stock_by_id = cloneResourceValues(response.available_stock_by_id);
        }
      } else if (failureCode === "cooldown") {
        const cooldownEndsAt = parseIsoInstant(response.cooldown_ends_at);
        settlementContractActionGateRuntime.build.cooldown_ends_at =
          cooldownEndsAt !== null ? cooldownEndsAt.toISOString() : null;
        scheduleSettlementContractGateRefresh(
          "build",
          settlementContractActionGateRuntime.build.cooldown_ends_at,
        );
      }
      appendEventFeedEntry({
        contentKey: failureKey,
        tokens: failureTokens,
        meta: "Just now | Settlement | BUILD adapter",
        priority: "medium",
      });
      setLastActionOutcome("build", response, failureKey, failureTokens);
      return;
    }

    settlementActionRuntime.resource_stock_by_id = cloneResourceValues(response.resource_stock_after_by_id);
    settlementActionRuntime.building_level_by_id[response.building_id] = response.to_level;
    settlementContractActionGateRuntime.build.building_id = response.building_id;
    settlementContractActionGateRuntime.build.required_cost_by_id =
      normalizeResourceCostById(response.resource_cost_by_id)
      || settlementContractActionGateRuntime.build.required_cost_by_id;
    settlementContractActionGateRuntime.build.cooldown_ends_at = null;
    clearSettlementContractGateRefreshTimer("build");
    settlementActionRuntime.build_queue_entries = [
      {
        icon: "B*",
        label: `${response.building_label} (Lv. ${response.from_level} -> ${response.to_level})`,
        progress: 0,
        eta: formatEtaFromSeconds(response.upgrade_duration_s),
      },
      ...settlementActionRuntime.build_queue_entries,
    ].slice(0, 6);

    const appended = appendPlaceholderEvents("build", response, "event.build.upgrade_started");
    setLastActionOutcome("build", response, appended.contentKey, appended.tokens);
  };

  const applyTrainActionResult = (response) => {
    if (response.status === "failed") {
      const failureKeyByCode = {
        insufficient_resources: "event.train.failure_insufficient_resources",
        cooldown: "event.train.failure_cooldown",
        invalid_state: "event.train.failure_invalid_state",
      };
      const failureCode = response.error_code || response.failure_code;
      const failureKey = failureKeyByCode[failureCode] || "event.train.failure_invalid_state";
      const failureTokens = {
        ...response,
        settlement_name: settlementActionRuntime.settlement_name,
        queue_available_at: toIsoOrValue(response.queue_available_at),
      };
      const nextUnitId =
        typeof response.unit_id === "string" && response.unit_id.trim().length > 0
          ? response.unit_id
          : settlementContractActionGateRuntime.train.unit_id;
      settlementContractActionGateRuntime.train.unit_id = nextUnitId;
      if (failureCode === "insufficient_resources") {
        const requiredCostById = normalizeResourceCostById(response.required_cost_by_id);
        if (requiredCostById !== null) {
          settlementContractActionGateRuntime.train.required_cost_by_id = requiredCostById;
        }
        settlementContractActionGateRuntime.train.queue_available_at = null;
        clearSettlementContractGateRefreshTimer("train");

        if (response.available_stock_by_id) {
          settlementActionRuntime.resource_stock_by_id = cloneResourceValues(response.available_stock_by_id);
        }
      } else if (failureCode === "cooldown") {
        const queueAvailableAt = parseIsoInstant(response.queue_available_at);
        settlementContractActionGateRuntime.train.queue_available_at =
          queueAvailableAt !== null ? queueAvailableAt.toISOString() : null;
        scheduleSettlementContractGateRefresh(
          "train",
          settlementContractActionGateRuntime.train.queue_available_at,
        );
      }
      appendEventFeedEntry({
        contentKey: failureKey,
        tokens: failureTokens,
        meta: "Just now | Military | TRAIN adapter",
        priority: "medium",
      });
      setLastActionOutcome("train", response, failureKey, failureTokens);
      return;
    }

    settlementActionRuntime.resource_stock_by_id = cloneResourceValues(response.resource_stock_after_by_id);
    settlementContractActionGateRuntime.train.unit_id = response.unit_id;
    settlementContractActionGateRuntime.train.required_cost_by_id =
      normalizeResourceCostById(response.resource_cost_by_id)
      || settlementContractActionGateRuntime.train.required_cost_by_id;
    settlementContractActionGateRuntime.train.queue_available_at = null;
    clearSettlementContractGateRefreshTimer("train");
    settlementActionRuntime.garrison_count_by_unit_id[response.unit_id] =
      (Number(settlementActionRuntime.garrison_count_by_unit_id[response.unit_id]) || 0) +
      (Number(response.quantity) || 0);
    const appended = appendPlaceholderEvents("train", response, "event.train.started");
    setLastActionOutcome("train", response, appended.contentKey, appended.tokens);
  };

  const resolveActionErrorCode = (error) => {
    if (typeof error?.code === "string" && error.code.trim().length > 0) {
      return error.code.trim();
    }
    return "transport_handler_error";
  };

  const resolveActionErrorMessage = (error) => {
    if (error instanceof Error && error.message.trim().length > 0) {
      return error.message.trim();
    }
    return "Action invocation failed.";
  };

  const handleActionInvocationError = (actionType, error, context = {}) => {
    const errorCode = resolveActionErrorCode(error);
    const failureContentKeyByAction = {
      tick: "event.tick.passive_gain_stalled",
      build: "event.build.failure_invalid_state",
      train: "event.train.failure_invalid_state",
      scout: "event.scout.unavailable_tile",
      attack: "event.world.hostile_dispatch_failed",
    };
    const failureMetaByAction = {
      tick: "Just now | Economy | TICK adapter",
      build: "Just now | Settlement | BUILD adapter",
      train: "Just now | Military | TRAIN adapter",
      scout: "Just now | World | SCOUT adapter",
      attack: "Just now | World | HOSTILE ATTACK adapter",
    };

    const failureContentKey =
      actionType === "attack"
        ? resolveHostileDispatchFailureContentKey(errorCode)
        : failureContentKeyByAction[actionType] || "event.tick.passive_gain_stalled";
    const fallbackTileLabel =
      typeof context.target_tile_label === "string" && context.target_tile_label.trim().length > 0
        ? context.target_tile_label
        : `Frontier Tile ${context.tile_id || "tile_unknown"}`;
    const failureTokensByAction = {
      tick: {
        settlement_name: settlementActionRuntime.settlement_name,
        duration_ms: Number(context.duration_ms) || 0,
      },
      build: {
        building_id: context.building_id || "building_unknown",
        settlement_name: settlementActionRuntime.settlement_name,
        invalid_reason: errorCode,
      },
      train: {
        unit_id: context.unit_id || "unit_unknown",
        settlement_name: settlementActionRuntime.settlement_name,
        invalid_reason: errorCode,
      },
      scout: {
        settlement_name: settlementActionRuntime.settlement_name,
        target_tile_label: fallbackTileLabel,
      },
      attack: {
        target_tile_label: fallbackTileLabel,
        error_code: errorCode,
        message: resolveActionErrorMessage(error),
        source_settlement_name: settlementActionRuntime.settlement_name,
        march_id: context.march_id || "march_unknown",
      },
    };
    const failureTokens = failureTokensByAction[actionType] || failureTokensByAction.tick;

    appendEventFeedEntry({
      contentKey: failureContentKey,
      tokens: failureTokens,
      meta: failureMetaByAction[actionType] || "Just now | Adapter",
      priority: "medium",
    });
    setLastActionOutcome(
      actionType,
      {
        status: "failed",
        flow: "transport.invocation_error",
        message: resolveActionErrorMessage(error),
      },
      failureContentKey,
      failureTokens,
    );
  };

  const resolveSelectedWorldMapTileId = () => {
    if (mockClientShellState.panelModes.worldMap === "populated") {
      syncWorldMapScenarioFromRuntime();
    }
    const selectedMarker = resolveSelectedWorldMapMarker();
    if (selectedMarker && typeof selectedMarker.tile_id === "string" && selectedMarker.tile_id.trim().length > 0) {
      return selectedMarker.tile_id.trim();
    }
    return firstSliceHomeTileId;
  };

  const resolveSelectedWorldMapTileLabel = (tileId) => {
    const selectedMarker = resolveSelectedWorldMapMarker();
    if (selectedMarker && typeof selectedMarker.tile_label === "string" && selectedMarker.tile_label.trim().length > 0) {
      return selectedMarker.tile_label.trim();
    }
    if (selectedMarker && typeof selectedMarker.label === "string" && selectedMarker.label.trim().length > 0) {
      return selectedMarker.label.trim();
    }

    return `Frontier Tile ${tileId}`;
  };
  const resolveSettlementContractActionAvailability = (actionType) => {
    if (actionType === "build") {
      const buildGate = settlementContractActionGateRuntime.build;
      const cooldownEndsAt = parseIsoInstant(buildGate.cooldown_ends_at);
      if (cooldownEndsAt !== null) {
        const cooldownRemainingMs = cooldownEndsAt.getTime() - Date.now();
        if (cooldownRemainingMs > 0) {
          return {
            contractDisabled: true,
            contentKey: "event.build.failure_cooldown",
            tokens: {
              building_id: buildGate.building_id,
              settlement_name: settlementActionRuntime.settlement_name,
              cooldown_ends_at: cooldownEndsAt.toISOString(),
              cooldown_remaining_ms: cooldownRemainingMs,
            },
          };
        }
        buildGate.cooldown_ends_at = null;
        clearSettlementContractGateRefreshTimer("build");
      }

      const requiredCostById = normalizeResourceCostById(buildGate.required_cost_by_id);
      const availableStockById = cloneResourceValues(settlementActionRuntime.resource_stock_by_id);
      if (
        requiredCostById !== null
        && hasInsufficientResourceStock(requiredCostById, availableStockById)
      ) {
        return {
          contractDisabled: true,
          contentKey: "event.build.failure_insufficient_resources",
          tokens: {
            building_id: buildGate.building_id,
            settlement_name: settlementActionRuntime.settlement_name,
            required_cost_by_id: requiredCostById,
            available_stock_by_id: availableStockById,
            missing_resources_by_id: buildMissingResourceValues(requiredCostById, availableStockById),
          },
        };
      }
    }

    if (actionType === "train") {
      const trainGate = settlementContractActionGateRuntime.train;
      const queueAvailableAt = parseIsoInstant(trainGate.queue_available_at);
      if (queueAvailableAt !== null) {
        const cooldownRemainingMs = queueAvailableAt.getTime() - Date.now();
        if (cooldownRemainingMs > 0) {
          return {
            contractDisabled: true,
            contentKey: "event.train.failure_cooldown",
            tokens: {
              unit_id: trainGate.unit_id,
              settlement_name: settlementActionRuntime.settlement_name,
              queue_available_at: queueAvailableAt.toISOString(),
              cooldown_remaining_ms: cooldownRemainingMs,
            },
          };
        }
        trainGate.queue_available_at = null;
        clearSettlementContractGateRefreshTimer("train");
      }

      const requiredCostById = normalizeResourceCostById(trainGate.required_cost_by_id);
      const availableStockById = cloneResourceValues(settlementActionRuntime.resource_stock_by_id);
      if (
        requiredCostById !== null
        && hasInsufficientResourceStock(requiredCostById, availableStockById)
      ) {
        return {
          contractDisabled: true,
          contentKey: "event.train.failure_insufficient_resources",
          tokens: {
            unit_id: trainGate.unit_id,
            settlement_name: settlementActionRuntime.settlement_name,
            required_cost_by_id: requiredCostById,
            available_stock_by_id: availableStockById,
            missing_resources_by_id: buildMissingResourceValues(requiredCostById, availableStockById),
          },
        };
      }
    }

    return {
      contractDisabled: false,
      contentKey: "",
      tokens: {},
    };
  };
  const resolveWorldMapScoutContractAvailability = () => {
    const tileId = resolveSelectedWorldMapTileId();
    const unavailableTileEntry = worldMapActionRuntime.unavailable_scout_tile_by_id[tileId];
    if (!unavailableTileEntry) {
      return {
        contractDisabled: false,
        contentKey: "",
        tokens: {},
      };
    }

    const contentKey =
      typeof unavailableTileEntry.contentKey === "string" && unavailableTileEntry.contentKey.trim().length > 0
        ? unavailableTileEntry.contentKey
        : "event.scout.unavailable_tile";
    const fallbackTokens = {
      settlement_name: settlementActionRuntime.settlement_name,
      target_tile_label: resolveSelectedWorldMapTileLabel(tileId),
    };
    const tokens = mapPlaceholderEventTokens(contentKey, {
      ...fallbackTokens,
      ...(unavailableTileEntry.tokens || {}),
    });
    return {
      contractDisabled: true,
      contentKey,
      tokens,
    };
  };
  const resolveWorldMapHostileDispatchAvailability = () => {
    const selectedMarker = resolveSelectedWorldMapMarker();
    const isHostileSettlementTarget =
      selectedMarker
      && selectedMarker.target_kind === "hostile_settlement"
      && typeof selectedMarker.settlement_id === "string"
      && selectedMarker.settlement_id.trim().length > 0;
    if (isHostileSettlementTarget) {
      return {
        contractDisabled: false,
        contentKey: "",
        tokens: {},
      };
    }

    return {
      contractDisabled: true,
      contentKey: "event.world.hostile_dispatch_target_required",
      tokens: {
        target_tile_label: selectedMarker?.tile_label || selectedMarker?.label || "foreign settlement tile",
      },
    };
  };

  const appendHostileDispatchLifecycleEvents = (response) => {
    const eventPayloads = response?.event_payloads || {};
    const resolvedEvents = worldMapHostileEventPayloadOrder
      .map((payloadKey) => {
        const payload = eventPayloads?.[payloadKey];
        if (!payload || typeof payload.content_key !== "string") {
          return null;
        }
        return {
          payload_key: payload.payload_key || payloadKey,
          content_key: payload.content_key,
          tokens: payload.tokens || {},
          occurred_at: payload.occurred_at,
        };
      })
      .filter(Boolean);

    if (resolvedEvents.length < 1) {
      return;
    }

    for (const event of resolvedEvents) {
      const contentKey = mapBackendEventKeyToClientKey(event.content_key);
      const tokens = mapPlaceholderEventTokens(contentKey, event.tokens);
      appendEventFeedEntry({
        contentKey,
        tokens,
        meta: `${formatEventMetaTimestamp(event.occurred_at)} | World | HOSTILE ${String(event.payload_key || "event").toUpperCase()}`,
        priority: event.payload_key === "combat_resolved" ? "high" : "normal",
      });
    }
  };
  const resolveHostileHeroRuntimePayloadRows = (response) => {
    const runtimePayloads = Array.isArray(response?.hero_runtime_payloads)
      ? response.hero_runtime_payloads
      : [];
    if (runtimePayloads.length < 1) {
      return [];
    }

    const orderByPayloadKey = {};
    worldMapHostileHeroRuntimePayloadOrder.forEach((payloadKey, index) => {
      orderByPayloadKey[payloadKey] = index;
    });

    return runtimePayloads
      .map((payload, index) => {
        if (!payload || typeof payload.content_key !== "string") {
          return null;
        }
        const payloadKeyValue = String(payload.payload_key || "").trim();
        const payloadKey = payloadKeyValue.length > 0 ? payloadKeyValue : `runtime_${index + 1}`;
        return {
          payload_key: payloadKey,
          content_key: payload.content_key,
          tokens: payload.tokens || {},
          occurred_at: payload.occurred_at,
          order_index: index,
        };
      })
      .filter(Boolean)
      .sort((left, right) => {
        const leftOrder = Object.prototype.hasOwnProperty.call(orderByPayloadKey, left.payload_key)
          ? orderByPayloadKey[left.payload_key]
          : Number.MAX_SAFE_INTEGER;
        const rightOrder = Object.prototype.hasOwnProperty.call(orderByPayloadKey, right.payload_key)
          ? orderByPayloadKey[right.payload_key]
          : Number.MAX_SAFE_INTEGER;
        if (leftOrder !== rightOrder) {
          return leftOrder - rightOrder;
        }
        return left.order_index - right.order_index;
      });
  };
  const appendHostileHeroRuntimePayloadEvents = (runtimePayloadRows) => {
    if (!Array.isArray(runtimePayloadRows) || runtimePayloadRows.length < 1) {
      return;
    }

    for (const payload of runtimePayloadRows) {
      const contentKey = mapBackendEventKeyToClientKey(payload.content_key);
      const tokens = mapPlaceholderEventTokens(contentKey, payload.tokens || {});
      appendEventFeedEntry({
        contentKey,
        tokens,
        meta: `${formatEventMetaTimestamp(payload.occurred_at)} | World | HERO ${String(payload.payload_key || "runtime").toUpperCase()}`,
        priority: "normal",
      });
    }
  };
  const resolveSelectedHeroDispatchAttachmentContext = (marchId) => {
    const selectedHero = resolveSelectedWorldMapDispatchHero();
    if (!resolveHeroDispatchUnlockState() || !selectedHero || selectedHero.readiness_state !== "ready") {
      return null;
    }

    return {
      hero_id: selectedHero.hero_id,
      hero_name: selectedHero.display_name,
      ability_id: selectedHero.ability_id,
      ability_name: selectedHero.ability_name,
      assignment_context_type: "army",
      assignment_context_id: marchId,
      modifier_deltas: [...(selectedHero.modifier_deltas || [])],
      modifier_delta_summary: selectedHero.modifier_delta_summary || "",
      cooldown_s: Number(selectedHero.cooldown_s) || 0,
    };
  };
  const resolveAcceptedHeroDispatchAttachment = (response) => {
    const backendAttachment = response?.hero_attachment;
    if (!backendAttachment || typeof backendAttachment !== "object") {
      return null;
    }

    const heroId = String(backendAttachment.hero_id || "").trim();
    if (heroId.length < 1) {
      return null;
    }

    worldMapActionRuntime.hero_dispatch.selected_hero_id = null;
    const rosterHero = getWorldMapHeroDispatchRoster().find((candidate) => candidate.hero_id === heroId);

    const assignmentContextTypeValue = String(backendAttachment.assignment_context_type || "army").trim();
    return {
      player_id: String(backendAttachment.player_id || "").trim(),
      hero_id: heroId,
      hero_name: rosterHero?.display_name || heroId,
      assignment_id: String(backendAttachment.assignment_id || "").trim(),
      assignment_context_type: assignmentContextTypeValue.length > 0 ? assignmentContextTypeValue : "army",
      assignment_context_id: String(backendAttachment.assignment_context_id || "").trim(),
      attached_at: backendAttachment.attached_at || null,
      detached_at: backendAttachment.detached_at || null,
    };
  };

  const applyHostileDispatchActionResult = (response, context) => {
    const targetTileLabel = context?.target_tile_label || "Hostile Settlement";
    const targetSettlementId =
      context?.target_settlement_id
      || firstSliceDefaultHostileTargetSettlementId;
    const isFailedContract = response?.status === "failed";
    if (isFailedContract) {
      const failureErrorCode = response?.error_code || response?.failure_code || "hostile_dispatch_failed";
      const failureContentKey = resolveHostileDispatchFailureContentKey(failureErrorCode);
      const failureTokens = {
        target_tile_label: targetTileLabel,
        error_code: failureErrorCode,
        message: response?.message || "Contract rejected by world-map attack endpoint.",
        source_settlement_name: response?.source_settlement_name || settlementActionRuntime.settlement_name,
        march_id: response?.march_id || context?.march_id || "march_unknown",
      };
      appendEventFeedEntry({
        contentKey: failureContentKey,
        tokens: failureTokens,
        meta: "Just now | World | HOSTILE ATTACK adapter",
        priority: "medium",
      });
      worldMapActionRuntime.hostile_dispatch_outcome = {
        status: "failed",
        flow: response?.flow || "world_map.hostile_attack_v1",
        march_id: response?.march_id || context?.march_id || "march_unknown",
        content_key: failureContentKey,
        target_tile_label: targetTileLabel,
        target_settlement_id: targetSettlementId,
        error_code: failureErrorCode,
        message: response?.message || "Hostile march dispatch failed.",
        source_settlement_name: response?.source_settlement_name || settlementActionRuntime.settlement_name,
        updated_at: new Date().toISOString(),
      };
      setLastActionOutcome("attack", response, failureContentKey, failureTokens);
      return;
    }

    worldMapActionRuntime.completed_attacks += 1;
    const heroRuntimePayloadRows = resolveHostileHeroRuntimePayloadRows(response);
    const heroDispatchAttachment = resolveAcceptedHeroDispatchAttachment(response);
    appendHostileHeroRuntimePayloadEvents(heroRuntimePayloadRows);
    appendHostileDispatchLifecycleEvents(response);
    const resolvedPayloads = response?.event_payloads || {};
    const primaryOutcomePayload =
      resolvedPayloads.combat_resolved
      || resolvedPayloads.march_arrived
      || resolvedPayloads.dispatch_sent;
    const outcomeContentKey = mapBackendEventKeyToClientKey(
      primaryOutcomePayload?.content_key || "event.world.hostile_dispatch_en_route",
    );
    const outcomeTokens = mapPlaceholderEventTokens(
      outcomeContentKey,
      primaryOutcomePayload?.tokens || {
        target_tile_label: targetTileLabel,
      },
    );
    worldMapActionRuntime.hostile_dispatch_outcome = {
      status: "accepted",
      flow: response?.flow || "world_map.hostile_attack_v1",
      march_id: response?.march_id || context?.march_id || "march_unknown",
      target_tile_label: targetTileLabel,
      target_settlement_id: targetSettlementId,
      payloads: resolvedPayloads,
      combat_outcome: response?.combat_outcome || null,
      attacker_strength: Number(response?.attacker_strength) || 0,
      defender_strength: Number(response?.defender_strength) || 0,
      losses: response?.losses || null,
      snapshot: context?.snapshot || null,
      hero_dispatch_attachment: heroDispatchAttachment,
      hero_runtime_payloads: heroRuntimePayloadRows,
      updated_at: new Date().toISOString(),
    };
    setLastActionOutcome("attack", response, outcomeContentKey, outcomeTokens);
  };

  const applyScoutActionResult = (response) => {
    const isFailure = response?.status === "failed";
    const fallbackBackendContentKey = isFailure
      ? "event.world.scout_unavailable_tile"
      : "event.scout.dispatched";
    const backendContentKey = response?.event?.content_key || fallbackBackendContentKey;
    const contentKey = mapBackendEventKeyToClientKey(backendContentKey);
    const fallbackTileId =
      typeof response?.tile_id === "string" && response.tile_id.trim().length > 0
        ? response.tile_id
        : resolveSelectedWorldMapTileId();
    const eventTokens = response?.event?.tokens || {
      settlement_name: settlementActionRuntime.settlement_name,
      target_tile_label: resolveSelectedWorldMapTileLabel(fallbackTileId),
    };
    const tokens = mapPlaceholderEventTokens(contentKey, eventTokens);
    if (isFailure && response?.error_code === "unavailable_tile") {
      worldMapActionRuntime.unavailable_scout_tile_by_id[fallbackTileId] = {
        contentKey,
        tokens,
      };
    } else {
      delete worldMapActionRuntime.unavailable_scout_tile_by_id[fallbackTileId];
    }
    if (!isFailure) {
      worldMapActionRuntime.completed_scouts += 1;
    }

    appendEventFeedEntry({
      contentKey,
      tokens,
      meta: "Just now | World | SCOUT adapter",
      priority: isFailure ? "medium" : "normal",
    });
    setLastActionOutcome("scout", response, contentKey, tokens);
  };

  const runSettlementContractAction = async (actionType) => {
    if (settlementActionRuntime.pending_action !== null) {
      return;
    }
    if (actionType === "build" || actionType === "train") {
      const availability = resolveSettlementContractActionAvailability(actionType);
      if (availability.contractDisabled) {
        return;
      }
    }

    settlementActionRuntime.pending_action = actionType;
    const shouldFail = settlementActionRuntime.action_outcome_mode === "failure";
    const requestedAt = new Date();
    const correlationId = `rk-client-web-${settlementActionRuntime.next_correlation_id++}`;
    const tickDurationMs = shouldFail ? 0 : 60_000;
    renderPanels();

    try {
      if (actionType === "tick") {
        const response = await firstSliceClientContractAdapter.tickSettlementCommand({
          settlement_id: settlementActionRuntime.settlement_id,
          settlement_name: settlementActionRuntime.settlement_name,
          player_id: settlementActionRuntime.player_id,
          requested_at: requestedAt,
          duration_ms: tickDurationMs,
          resource_stock_by_id: settlementActionRuntime.resource_stock_by_id,
          storage_cap_by_id: settlementActionRuntime.storage_cap_by_id,
          passive_prod_per_h_by_id: settlementActionRuntime.passive_prod_per_h_by_id,
          correlation_id: correlationId,
        });
        applyTickActionResult(response);
      }

      if (actionType === "build") {
        const buildResourceStock = shouldFail
          ? {
            food: 0,
            wood: 0,
            stone: 0,
            iron: 0,
          }
          : settlementActionRuntime.resource_stock_by_id;
        const response = await firstSliceClientContractAdapter.buildUpgradeCommand({
          settlement_id: settlementActionRuntime.settlement_id,
          settlement_name: settlementActionRuntime.settlement_name,
          player_id: settlementActionRuntime.player_id,
          building_id: "grain_plot",
          current_level: settlementActionRuntime.building_level_by_id.grain_plot || 0,
          requested_at: requestedAt,
          resource_stock_by_id: buildResourceStock,
          correlation_id: correlationId,
        });
        applyBuildActionResult(response);
      }

      if (actionType === "train") {
        const queueAvailableAt = shouldFail ? new Date(requestedAt.getTime() + 90_000) : undefined;
        const response = await firstSliceClientContractAdapter.trainUnitCommand({
          settlement_id: settlementActionRuntime.settlement_id,
          settlement_name: settlementActionRuntime.settlement_name,
          player_id: settlementActionRuntime.player_id,
          unit_id: "watch_levy",
          quantity: 4,
          requested_at: requestedAt,
          barracks_level: 1,
          resource_stock_by_id: settlementActionRuntime.resource_stock_by_id,
          queue_available_at: queueAvailableAt,
          correlation_id: correlationId,
        });
        applyTrainActionResult(response);
      }
    } catch (error) {
      if (actionType === "tick") {
        handleActionInvocationError("tick", error, { duration_ms: tickDurationMs });
      } else if (actionType === "build") {
        handleActionInvocationError("build", error, { building_id: "grain_plot" });
      } else if (actionType === "train") {
        handleActionInvocationError("train", error, { unit_id: "watch_levy" });
      }
    } finally {
      settlementActionRuntime.pending_action = null;
      renderPanels();
    }
  };

  const runWorldMapContractAction = async (actionType) => {
    if ((actionType !== "scout" && actionType !== "attack") || worldMapActionRuntime.pending_action !== null) {
      return;
    }
    syncWorldMapHeroDispatchReadiness();
    if (actionType === "scout") {
      const scoutAvailability = resolveWorldMapScoutContractAvailability();
      if (scoutAvailability.contractDisabled) {
        return;
      }
    }
    if (actionType === "attack") {
      const hostileDispatchAvailability = resolveWorldMapHostileDispatchAvailability();
      if (hostileDispatchAvailability.contractDisabled) {
        return;
      }
    }

    const tileId = resolveSelectedWorldMapTileId();
    const targetTileLabel = resolveSelectedWorldMapTileLabel(tileId);
    const selectedMarker = resolveSelectedWorldMapMarker();
    const targetSettlementId =
      typeof selectedMarker?.settlement_id === "string" && selectedMarker.settlement_id.trim().length > 0
        ? selectedMarker.settlement_id.trim()
        : firstSliceDefaultHostileTargetSettlementId;
    const targetSettlementName =
      typeof selectedMarker?.label === "string" && selectedMarker.label.trim().length > 0
        ? selectedMarker.label.trim()
        : targetTileLabel;
    const targetCoords = {
      x: normalizeMapCoordinate(selectedMarker?.coords?.x, firstSliceForeignHostileProfile.map_coordinate.x),
      y: normalizeMapCoordinate(selectedMarker?.coords?.y, firstSliceForeignHostileProfile.map_coordinate.y),
    };
    const marchId = `march_attack_${String(worldMapActionRuntime.next_march_sequence).padStart(4, "0")}`;
    const heroDispatchContext = actionType === "attack"
      ? resolveSelectedHeroDispatchAttachmentContext(marchId)
      : null;
    if (actionType === "attack") {
      worldMapActionRuntime.next_march_sequence += 1;
    }

    worldMapActionRuntime.pending_action = actionType;
    renderPanels();

    try {
      if (actionType === "scout") {
        const response = await firstSliceClientContractAdapter.scoutTileInteractCommand({
          settlement_id: settlementActionRuntime.settlement_id,
          settlement_name: settlementActionRuntime.settlement_name,
          tile_id: tileId,
          player_id: worldMapActionRuntime.player_id,
        });
        applyScoutActionResult(response);
        return;
      }

      const response = await firstSliceClientContractAdapter.dispatchHostileSettlementAttackCommand({
        march_id: marchId,
        source_settlement_id: settlementActionRuntime.settlement_id,
        source_settlement_name: settlementActionRuntime.settlement_name,
        target_settlement_id: targetSettlementId,
        target_settlement_name: targetSettlementName,
        target_tile_label: targetTileLabel,
        origin: {
          x: normalizeMapCoordinate(firstSliceWorldMapHostileDispatchFixture.source_origin.x, 0),
          y: normalizeMapCoordinate(firstSliceWorldMapHostileDispatchFixture.source_origin.y, 0),
        },
        target: targetCoords,
        defender_garrison_strength: Number(selectedMarker?.defender_garrison_strength) || 40,
        dispatched_units: firstSliceWorldMapHostileDispatchFixture.dispatched_units,
        departed_at: new Date(),
        seconds_per_tile: firstSliceWorldMapHostileDispatchFixture.seconds_per_tile,
        army_name: firstSliceWorldMapHostileDispatchFixture.army_name,
        player_id: worldMapActionRuntime.player_id,
        hero_id: heroDispatchContext?.hero_id,
        hero_target_scope: heroDispatchContext?.assignment_context_type,
        hero_assignment_context_id: heroDispatchContext?.assignment_context_id,
      });

      let latestMarchSnapshot = null;
      if (response?.status === "accepted") {
        try {
          latestMarchSnapshot = await firstSliceClientContractAdapter.getMarchSnapshotCommand({
            march_id: response.march_id,
            observed_at: new Date(),
          });
        } catch {
          latestMarchSnapshot = null;
        }
      }
      applyHostileDispatchActionResult(response, {
        march_id: marchId,
        target_tile_label: targetTileLabel,
        target_settlement_id: targetSettlementId,
        snapshot: latestMarchSnapshot,
      });
    } catch (error) {
      if (actionType === "scout") {
        handleActionInvocationError("scout", error, {
          tile_id: tileId,
          target_tile_label: targetTileLabel,
        });
      } else if (actionType === "attack") {
        handleActionInvocationError("attack", error, {
          tile_id: tileId,
          target_tile_label: targetTileLabel,
        });
      }
    } finally {
      worldMapActionRuntime.pending_action = null;
      renderPanels();
    }
  };

  const renderStateControls = (panelKey) => {
    const panel = mockClientShellState.panels[panelKey];
    const currentMode = mockClientShellState.panelModes[panelKey];
    const target = panelRefs[panelKey].controls;

    if (!target) {
      return;
    }

    const buttons = panel.stateOptions
      .map((mode) => {
        const isActive = mode === currentMode;
        const label = mode.charAt(0).toUpperCase() + mode.slice(1);

        return `
          <button
            type="button"
            class="mock-state-btn${isActive ? " is-active" : ""}"
            data-mock-panel="${panelKey}"
            data-mock-mode="${mode}"
            aria-pressed="${String(isActive)}"
          >${escapeHtml(label)}</button>
        `;
      })
      .join("");

    target.innerHTML = `<span class="mock-state-label">Mock state</span>${buttons}`;
  };

  const renderSettlementPanel = () => {
    const { panel, mode, scenario } = getPanelScenario("settlement");
    const refs = panelRefs.settlement;

    if (!refs.content || !refs.title) {
      return;
    }

    if (mode === "populated") {
      syncSettlementScenarioFromRuntime();
    }

    refs.title.textContent = scenario.titleSuffix ? `${panel.title} ${scenario.titleSuffix}` : panel.title;

    if (mode === "loading") {
      const resourceCards = Array.from({ length: scenario.resourceSlots })
        .map(
          () => `
            <article class="skeleton-card" aria-hidden="true">
              <div class="skeleton-line"></div>
              <div class="skeleton-line"></div>
              <div class="wire-bar"><span style="width: 35%"></span></div>
            </article>
          `,
        )
        .join("");

      const queueRows = Array.from({ length: scenario.queueSlots })
        .map(
          () => `
            <li class="skeleton-row" aria-hidden="true">
              <span class="wire-icon"></span>
              <div class="skeleton-row__body">
                <div class="skeleton-line"></div>
                <div class="skeleton-line skeleton-line--sm"></div>
              </div>
              <div class="skeleton-line" style="width: 52px;"></div>
            </li>
          `,
        )
        .join("");

      const unitRows = Array.from({ length: scenario.unitSlots })
        .map(
          () => `
            <div class="unit-row" aria-hidden="true">
              <span class="wire-silhouette"></span>
              <div class="skeleton-line"></div>
              <div class="skeleton-line" style="width: 36px;"></div>
            </div>
          `,
        )
        .join("");

      refs.content.innerHTML = `
        <div class="stack">
          <section class="subpanel">
            <h3>Resource Ledger</h3>
            <p class="loading-copy">Loading placeholder resources from local mock state...</p>
            <div class="resource-grid" aria-label="Loading resource placeholders">${resourceCards}</div>
          </section>
          <section class="subpanel">
            <div class="subpanel__head">
              <h3>Build Queue</h3>
              <button type="button" class="ghost-btn">Manage</button>
            </div>
            <p class="loading-copy">Queue items syncing (mock loading state).</p>
            <ul class="wire-list" aria-label="Loading build queue placeholders">${queueRows}</ul>
          </section>
          <section class="subpanel">
            <div class="subpanel__head">
              <h3>Garrison Snapshot</h3>
              <button type="button" class="ghost-btn">Review</button>
            </div>
            <div class="unit-rows" aria-label="Loading garrison placeholders">${unitRows}</div>
          </section>
          <section class="subpanel compact">
            <h3>Civilization Briefing</h3>
            <p class="loading-copy">Loading placeholder civ intro copy from stable mock content keys...</p>
            <div aria-hidden="true">
              <div class="skeleton-line" style="width: 42%;"></div>
              <div class="skeleton-line"></div>
              <div class="skeleton-line" style="width: 88%;"></div>
            </div>
          </section>
        </div>
      `;

      return;
    }

    if (mode === "empty") {
      const civIntroTitle = scenario.civIntro?.displayName || "Civilization";
      const civIntroText = getNarrativeText(scenario.civIntro?.contentKey, scenario.civIntro?.tokens);

      refs.content.innerHTML = `
        <div class="stack">
          <section class="subpanel compact">
            <h3>Settlement Status</h3>
            <div class="wire-empty">${escapeHtml(scenario.emptySummary || "No active settlement data in this placeholder state.")}</div>
          </section>
          <section class="subpanel">
            <h3>Resource Ledger</h3>
            <div class="wire-empty">${escapeHtml(scenario.resourceHint || "No resources recorded.")}</div>
          </section>
          <section class="subpanel">
            <div class="subpanel__head">
              <h3>Build Queue</h3>
              <button type="button" class="ghost-btn">Manage</button>
            </div>
            <div class="wire-empty">${escapeHtml(scenario.queueHint || "No build queue items.")}</div>
          </section>
          <section class="subpanel">
            <div class="subpanel__head">
              <h3>Garrison Snapshot</h3>
              <button type="button" class="ghost-btn">Review</button>
            </div>
            <div class="wire-empty">${escapeHtml(scenario.garrisonHint || "No unit entries available.")}</div>
          </section>
          <section class="subpanel compact">
            <h3>Civilization Briefing</h3>
            <p><strong>${escapeHtml(civIntroTitle)}</strong></p>
            <p>${escapeHtml(civIntroText)}</p>
          </section>
        </div>
      `;

      return;
    }

    if (mode === "error") {
      refs.content.innerHTML = `
        <div class="stack">
          <section class="subpanel compact">
            <h3>Settlement Status</h3>
            <div class="wire-empty">
              <strong>Placeholder error: ${escapeHtml(scenario.errorCode || "UNKNOWN_SETTLEMENT_ERROR")}</strong><br />
              ${escapeHtml(scenario.emptySummary || "Settlement data could not be loaded.")}
            </div>
          </section>
          <section class="subpanel">
            <h3>Resource Ledger</h3>
            <div class="wire-empty">${escapeHtml(scenario.resourceHint || "Resource ledger unavailable.")}</div>
          </section>
          <section class="subpanel">
            <div class="subpanel__head">
              <h3>Build Queue</h3>
              <button type="button" class="ghost-btn">Manage</button>
            </div>
            <div class="wire-empty">${escapeHtml(scenario.queueHint || "Build queue unavailable.")}</div>
          </section>
          <section class="subpanel">
            <div class="subpanel__head">
              <h3>Garrison Snapshot</h3>
              <button type="button" class="ghost-btn">Review</button>
            </div>
            <div class="wire-empty">${escapeHtml(scenario.garrisonHint || "Garrison data unavailable.")}</div>
          </section>
        </div>
      `;

      return;
    }

    const resources = scenario.resources
      .map(
        (resource) => `
          <article class="resource-card">
            <p class="resource-card__label">${escapeHtml(resource.label)}</p>
            <p class="resource-card__value">${escapeHtml(formatNumber(resource.value))}</p>
            <div class="wire-bar"><span style="width:${clampPercent(resource.fill)}%"></span></div>
          </article>
        `,
      )
      .join("");

    const buildQueue = scenario.buildQueue
      .map(
        (item) => `
          <li>
            <span class="wire-icon" aria-hidden="true">${escapeHtml(item.icon)}</span>
            <div class="wire-list__body">
              <p>${escapeHtml(item.label)}</p>
              <div class="wire-bar"><span style="width:${clampPercent(item.progress)}%"></span></div>
            </div>
            <span class="wire-time">${escapeHtml(item.eta)}</span>
          </li>
        `,
      )
      .join("");

    const garrison = scenario.garrison
      .map(
        (unit) => `
          <div class="unit-row">
            <span class="wire-silhouette" aria-hidden="true"></span>
            <span>${escapeHtml(unit.unit)}</span>
            <span>${escapeHtml(formatNumber(unit.count))}</span>
          </div>
        `,
      )
      .join("");
    const civIntroTitle = scenario.civIntro?.displayName || "Civilization";
    const civIntroText = getNarrativeText(scenario.civIntro?.contentKey, scenario.civIntro?.tokens);
    const isSuccessMode = settlementActionRuntime.action_outcome_mode === "success";
    const isFailureMode = settlementActionRuntime.action_outcome_mode === "failure";
    const pendingAction = settlementActionRuntime.pending_action;
    const buildAvailability = resolveSettlementContractActionAvailability("build");
    const trainAvailability = resolveSettlementContractActionAvailability("train");
    const tickDisabled = pendingAction !== null;
    const buildDisabled = pendingAction !== null || buildAvailability.contractDisabled;
    const trainDisabled = pendingAction !== null || trainAvailability.contractDisabled;
    const settlementContractReasonRows = [
      buildAvailability.contractDisabled
        ? `
          <li class="action-reason-item" data-content-key="${escapeHtml(buildAvailability.contentKey)}">
            <strong>Build Upgrade</strong>
            <span>${escapeHtml(getNarrativeText(buildAvailability.contentKey, buildAvailability.tokens))}</span>
          </li>
        `
        : "",
      trainAvailability.contractDisabled
        ? `
          <li class="action-reason-item" data-content-key="${escapeHtml(trainAvailability.contentKey)}">
            <strong>Train Unit</strong>
            <span>${escapeHtml(getNarrativeText(trainAvailability.contentKey, trainAvailability.tokens))}</span>
          </li>
        `
        : "",
    ]
      .filter((row) => row.length > 0)
      .join("");
    const settlementContractReasonSection = settlementContractReasonRows.length > 0
      ? `<ul class="action-reason-list" aria-live="polite">${settlementContractReasonRows}</ul>`
      : "";
    const lastOutcome = settlementActionRuntime.last_outcome;
    const outcomeNarrative = lastOutcome
      ? getNarrativeText(lastOutcome.contentKey, lastOutcome.tokens)
      : "No adapter calls yet. Trigger Tick, Build, Train, Scout, or Hostile March to see contract payload outcomes.";
    const outcomeClass = lastOutcome
      ? lastOutcome.status === "failed"
        ? "action-outcome is-failed"
        : "action-outcome is-success"
      : "action-outcome";

    refs.content.innerHTML = `
      <div class="stack">
        <section class="subpanel compact">
          <div class="subpanel__head">
            <h3>First-Slice Action Adapter</h3>
            <span class="chip chip--small">Transport Bridge</span>
          </div>
          <p class="subpanel-note">Outcome path</p>
          <div class="segment-row segment-row--dual" role="group" aria-label="Settlement action outcome path">
            <button
              type="button"
              class="segment${isSuccessMode ? " is-selected" : ""}"
              data-settlement-outcome-mode="success"
              aria-pressed="${String(isSuccessMode)}"
            >Success</button>
            <button
              type="button"
              class="segment${isFailureMode ? " is-selected" : ""}"
              data-settlement-outcome-mode="failure"
              aria-pressed="${String(isFailureMode)}"
            >Failure</button>
          </div>
          <div class="settlement-action-grid" role="group" aria-label="Settlement actions">
            <button
              type="button"
              class="action-btn"
              data-settlement-adapter-action="tick"
              ${tickDisabled ? "disabled" : ""}
            >${pendingAction === "tick" ? "Ticking..." : "Tick Settlement"}</button>
            <button
              type="button"
              class="action-btn"
              data-settlement-adapter-action="build"
              ${buildDisabled ? "disabled" : ""}
            >${pendingAction === "build" ? "Queuing..." : "Build Upgrade"}</button>
            <button
              type="button"
              class="action-btn"
              data-settlement-adapter-action="train"
              ${trainDisabled ? "disabled" : ""}
            >${pendingAction === "train" ? "Training..." : "Train Unit"}</button>
          </div>
          ${settlementContractReasonSection}
          <p class="${outcomeClass}" aria-live="polite">${escapeHtml(outcomeNarrative)}</p>
          <p class="subpanel-note">${escapeHtml(lastOutcome?.detail || "Awaiting adapter response.")}</p>
        </section>
        <section class="subpanel">
          <h3>Resource Ledger</h3>
          <div class="resource-grid" aria-label="Mock resource cards">${resources}</div>
        </section>
        <section class="subpanel">
          <div class="subpanel__head">
            <h3>Build Queue</h3>
            <button type="button" class="ghost-btn">Manage</button>
          </div>
          <ul class="wire-list" aria-label="Mock build queue">${buildQueue}</ul>
        </section>
        <section class="subpanel">
          <div class="subpanel__head">
            <h3>Garrison Snapshot</h3>
            <button type="button" class="ghost-btn">Review</button>
          </div>
          <div class="unit-rows" aria-label="Mock unit rows">${garrison}</div>
        </section>
        <section class="subpanel compact">
          <h3>Civilization Briefing</h3>
          <p class="subpanel-note">Placeholder intro copy is keyed to the narrative seed pack.</p>
          <p><strong>${escapeHtml(civIntroTitle)}</strong></p>
          <p>${escapeHtml(civIntroText)}</p>
        </section>
      </div>
    `;
  };

  const renderMapPanel = () => {
    const { panel, mode, scenario } = getPanelScenario("worldMap");
    const refs = panelRefs.worldMap;

    if (!refs.content || !refs.title) {
      return;
    }

    if (mode === "populated") {
      syncWorldMapHeroDispatchReadiness();
      syncWorldMapScenarioFromRuntime();
      scheduleWorldMapHeroCooldownRefresh();
    } else {
      clearWorldMapHeroCooldownRefreshTimer();
    }

    refs.title.textContent = panel.title;

    const selectedFields = Object.entries(scenario.selectedTile || {})
      .map(
        ([label, value]) => `
          <div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>
        `,
      )
      .join("");

    const legendItems = (scenario.legend || [])
      .map(
        (item) => `
          <li><span class="legend-swatch ${escapeHtml(item.kind)}"></span>${escapeHtml(item.label)}</li>
        `,
      )
      .join("");

    const isMapActionPending = worldMapActionRuntime.pending_action !== null;
    const scoutAvailability = resolveWorldMapScoutContractAvailability();
    const hostileDispatchAvailability = resolveWorldMapHostileDispatchAvailability();
    const mapContractReasonRows = [
      mode === "populated" && scoutAvailability.contractDisabled
        ? `
          <li class="action-reason-item" data-content-key="${escapeHtml(scoutAvailability.contentKey)}">
            <strong>Send Scouts</strong>
            <span>${escapeHtml(getNarrativeText(scoutAvailability.contentKey, scoutAvailability.tokens))}</span>
          </li>
        `
        : "",
      mode === "populated" && hostileDispatchAvailability.contractDisabled
        ? `
          <li class="action-reason-item" data-content-key="${escapeHtml(hostileDispatchAvailability.contentKey)}">
            <strong>Dispatch Hostile March</strong>
            <span>${escapeHtml(getNarrativeText(hostileDispatchAvailability.contentKey, hostileDispatchAvailability.tokens))}</span>
          </li>
        `
        : "",
    ]
      .filter((row) => row.length > 0)
      .join("");
    const mapContractReasonSection = mapContractReasonRows.length > 0
      ? `<ul class="action-reason-list" aria-live="polite">${mapContractReasonRows}</ul>`
      : "";
    const heroDispatchUnlockState = resolveHeroDispatchUnlockState();
    const selectedDispatchHero = resolveSelectedWorldMapDispatchHero();
    const heroAttachRows = getWorldMapHeroDispatchRoster()
      .map((hero) => {
        const isSelected = selectedDispatchHero?.hero_id === hero.hero_id;
        const isReady = hero.readiness_state === "ready";
        const readinessLabel = isReady ? "Ready" : "Cooldown";
        const readinessMeta = resolveHeroReadinessSummary(hero);
        const cooldownValue = hero.cooldown_ends_at ? formatEventMetaTimestamp(hero.cooldown_ends_at) : "Available now";
        return `
          <li>
            <button
              type="button"
              class="hero-attach-option${isSelected ? " is-selected" : ""}"
              data-worldmap-hero-attach-id="${escapeHtml(hero.hero_id)}"
              aria-pressed="${String(isSelected)}"
              ${isReady ? "" : "disabled"}
            >
              <span class="hero-attach-option__name">${escapeHtml(hero.display_name)}</span>
              <span class="hero-state-pill${isReady ? " is-ready" : " is-cooldown"}">${escapeHtml(readinessLabel)}</span>
              <span class="hero-attach-option__meta">${escapeHtml(readinessMeta)}</span>
              <span class="hero-attach-option__meta">Cooldown ends: ${escapeHtml(cooldownValue)}</span>
            </button>
          </li>
        `;
      })
      .join("");
    const selectedHeroModifierRows = selectedDispatchHero
      ? (selectedDispatchHero.modifier_deltas || [])
        .map((delta) => `<li>${escapeHtml(delta)}</li>`)
        .join("")
      : "";
    const heroDispatchSection = mode === "populated" && heroDispatchUnlockState
      ? `
        <section class="subpanel compact hero-attach-panel">
          <div class="subpanel__head">
            <h3>Hero Attach (Optional)</h3>
            <span class="chip chip--small">Post-Onboarding</span>
          </div>
          <p class="subpanel-note">Dispatch remains fully valid with no hero attached.</p>
          <div class="stack-sm">
            <button
              type="button"
              class="hero-attach-option${selectedDispatchHero === null ? " is-selected" : ""}"
              data-worldmap-hero-attach-id="none"
              aria-pressed="${String(selectedDispatchHero === null)}"
            >
              <span class="hero-attach-option__name">No Hero</span>
              <span class="hero-state-pill is-optional">Core loop path</span>
              <span class="hero-attach-option__meta">No ability cooldown tracked for this dispatch.</span>
            </button>
            <ul class="hero-attach-list">${heroAttachRows || "<li class=\"wire-empty\">No unlocked heroes in roster.</li>"}</ul>
          </div>
          ${selectedDispatchHero
            ? `
              <div class="hero-preview-block">
                <p class="hero-preview-title">Pre-Commit Modifier Preview</p>
                <p class="subpanel-note">${escapeHtml(selectedDispatchHero.modifier_delta_summary || "")}</p>
                <ul class="hero-preview-list">${selectedHeroModifierRows}</ul>
              </div>
            `
            : ""
          }
        </section>
      `
      : "";
    const actionItems = (scenario.actions || [])
      .map((label) => {
        const normalizedLabel = String(label).trim().toLowerCase();
        const isScoutAction = normalizedLabel.startsWith("send scouts");
        const isHostileDispatchAction = normalizedLabel.startsWith("dispatch hostile march");
        const isDisabled =
          mode !== "populated"
          || isMapActionPending
          || settlementActionRuntime.pending_action !== null
          || (isScoutAction && scoutAvailability.contractDisabled)
          || (isHostileDispatchAction && hostileDispatchAvailability.contractDisabled);
        const displayLabel = isScoutAction && worldMapActionRuntime.pending_action === "scout"
          ? "Scouting..."
          : isHostileDispatchAction && worldMapActionRuntime.pending_action === "attack"
            ? "Dispatching..."
          : label;

        return `<button type="button" class="action-btn"${
          isScoutAction
            ? ' data-worldmap-adapter-action="scout"'
            : isHostileDispatchAction
              ? ' data-worldmap-adapter-action="attack"'
              : ""
        } ${isDisabled ? "disabled" : ""}>${escapeHtml(displayLabel)}</button>`;
      })
      .join("");
    const hostileDispatchOutcome = worldMapActionRuntime.hostile_dispatch_outcome;
    const hostileDispatchOutcomeSection = (() => {
      if (mode === "loading") {
        return `
          <section class="subpanel compact">
            <h3>Hostile Dispatch Outcome</h3>
            <p class="loading-copy">Awaiting world-map contract readiness...</p>
          </section>
        `;
      }

      if (!hostileDispatchOutcome) {
        return `
          <section class="subpanel compact">
            <h3>Hostile Dispatch Outcome</h3>
            <p class="subpanel-note">Dispatch path uses backend payload rows only: dispatch_sent -> march_arrived -> combat_resolved (+ ordered hero runtime rows when present).</p>
            <div class="wire-empty">Select the hostile settlement marker and dispatch one march to view lifecycle + combat results.</div>
          </section>
        `;
      }

      if (hostileDispatchOutcome.status === "failed") {
        const failedNarrativeContentKey =
          typeof hostileDispatchOutcome.content_key === "string" && hostileDispatchOutcome.content_key.trim().length > 0
            ? hostileDispatchOutcome.content_key
            : resolveHostileDispatchFailureContentKey(hostileDispatchOutcome.error_code);
        const tokens = {
          target_tile_label: hostileDispatchOutcome.target_tile_label,
          error_code: hostileDispatchOutcome.error_code,
          message: hostileDispatchOutcome.message,
          source_settlement_name: hostileDispatchOutcome.source_settlement_name,
          march_id: hostileDispatchOutcome.march_id,
        };
        const failedNarrative = getNarrativeText(failedNarrativeContentKey, tokens);
        return `
          <section class="subpanel compact">
            <h3>Hostile Dispatch Outcome</h3>
            <p class="action-outcome is-failed">${escapeHtml(failedNarrative)}</p>
            <div class="wire-fields">
              <div><span>Flow</span><strong>${escapeHtml(hostileDispatchOutcome.flow || "world_map.hostile_attack_v1")}</strong></div>
              <div><span>Error</span><strong>${escapeHtml(hostileDispatchOutcome.error_code || "hostile_dispatch_failed")}</strong></div>
              <div><span>March ID</span><strong>${escapeHtml(hostileDispatchOutcome.march_id || "march_unknown")}</strong></div>
            </div>
          </section>
        `;
      }

      const payloadRows = worldMapHostileEventPayloadOrder
        .map((payloadKey) => {
          const payload = hostileDispatchOutcome.payloads?.[payloadKey];
          if (!payload || typeof payload.content_key !== "string") {
            return "";
          }
          const contentKey = mapBackendEventKeyToClientKey(payload.content_key);
          const narrative = getNarrativeText(
            contentKey,
            mapPlaceholderEventTokens(contentKey, payload.tokens || {}),
          );
          return `
            <li class="event-item${payloadKey === "combat_resolved" ? " priority-high" : ""}" data-payload-key="${escapeHtml(payload.payload_key || payloadKey)}">
              <p class="event-item__title">${escapeHtml(narrative)}</p>
              <p class="event-item__meta">${escapeHtml(`${payload.payload_key || payloadKey} | ${contentKey} | ${formatEventMetaTimestamp(payload.occurred_at)}`)}</p>
            </li>
          `;
        })
        .filter((row) => row.length > 0)
        .join("");
      const losses = hostileDispatchOutcome.losses || {};
      const snapshot = hostileDispatchOutcome.snapshot;
      const snapshotProgressRatio = Number(snapshot?.authoritative_position?.progress_ratio) || 0;
      const snapshotProgressPercent = `${Math.round(clampPercent(snapshotProgressRatio * 100))}%`;
      const snapshotDistanceTiles = Number(snapshot?.authoritative_position?.distance_tiles) || 0;
      const snapshotTravelState = snapshot?.march_state || "march_state_unknown";
      const heroDispatchAttachment = hostileDispatchOutcome.hero_dispatch_attachment || null;
      const heroRuntimePayloadRows = Array.isArray(hostileDispatchOutcome.hero_runtime_payloads)
        ? hostileDispatchOutcome.hero_runtime_payloads
        : [];
      const heroRuntimeRows = heroRuntimePayloadRows
        .map((payload) => {
          if (!payload || typeof payload.content_key !== "string") {
            return "";
          }
          const contentKey = mapBackendEventKeyToClientKey(payload.content_key);
          const narrative = getNarrativeText(
            contentKey,
            mapPlaceholderEventTokens(contentKey, payload.tokens || {}),
          );
          return `<li><code>${escapeHtml(payload.payload_key || "runtime")}</code> - ${escapeHtml(narrative)}</li>`;
        })
        .filter((row) => row.length > 0)
        .join("");
      const heroAttachmentMetaSection = heroDispatchAttachment
        ? `
          <div class="wire-fields">
            <div><span>Hero</span><strong>${escapeHtml(heroDispatchAttachment.hero_name || heroDispatchAttachment.hero_id || "hero_unknown")}</strong></div>
            <div><span>Player</span><strong>${escapeHtml(heroDispatchAttachment.player_id || "player_unknown")}</strong></div>
            <div><span>Assignment</span><strong>${escapeHtml(heroDispatchAttachment.assignment_id || "assignment_unknown")}</strong></div>
            <div><span>Context</span><strong>${escapeHtml(`${heroDispatchAttachment.assignment_context_type || "army"}:${heroDispatchAttachment.assignment_context_id || "context_unknown"}`)}</strong></div>
            <div><span>Attached At</span><strong>${escapeHtml(formatEventMetaTimestamp(heroDispatchAttachment.attached_at))}</strong></div>
          </div>
        `
        : `<p class="subpanel-note">No hero attachment metadata returned for this dispatch.</p>`;
      const heroImpactSection = heroDispatchAttachment || heroRuntimeRows.length > 0
        ? `
          <div class="hero-impact-block" data-content-key="event.hero.assigned">
            <p class="hero-impact-title">Hero Attachment Metadata</p>
            ${heroAttachmentMetaSection}
            <p class="hero-impact-title">Hero Runtime Payload Rows</p>
            <div class="wire-fields">
              <div><span>Expected Order</span><strong>${escapeHtml(worldMapHostileHeroRuntimePayloadOrder.join(" -> "))}</strong></div>
              <div><span>Rows Returned</span><strong>${escapeHtml(String(heroRuntimePayloadRows.length))}</strong></div>
            </div>
            <ul class="hero-shared-key-list">${heroRuntimeRows || "<li>No hero runtime payload rows returned.</li>"}</ul>
          </div>
        `
        : "";
      return `
        <section class="subpanel compact">
          <h3>Hostile Dispatch Outcome</h3>
          <p class="subpanel-note">Backend payload lifecycle (deterministic): dispatch_sent -> march_arrived -> combat_resolved</p>
          <ol class="event-list">${payloadRows || '<li class="event-item"><p class="event-item__title">No payload rows returned.</p></li>'}</ol>
          <div class="wire-fields">
            <div><span>Combat Outcome</span><strong>${escapeHtml(hostileDispatchOutcome.combat_outcome || "unknown")}</strong></div>
            <div><span>Strength</span><strong>${escapeHtml(`${formatNumber(hostileDispatchOutcome.attacker_strength || 0)} vs ${formatNumber(hostileDispatchOutcome.defender_strength || 0)}`)}</strong></div>
            <div><span>Losses</span><strong>${escapeHtml(`${formatNumber(Number(losses.attacker_units_lost) || 0)} attackers / ${formatNumber(Number(losses.defender_garrison_lost) || 0)} defenders`)}</strong></div>
          </div>
          ${heroImpactSection}
          <div class="wire-fields">
            <div><span>March State</span><strong>${escapeHtml(snapshotTravelState)}</strong></div>
            <div><span>Travel Progress</span><strong>${escapeHtml(snapshotProgressPercent)}</strong></div>
            <div><span>Distance</span><strong>${escapeHtml(`${formatNumber(snapshotDistanceTiles)} tiles`)}</strong></div>
          </div>
        </section>
      `;
    })();

    if (mode === "loading") {
      refs.content.innerHTML = `
        <div class="map-layout">
          <div class="map-stage is-loading" role="group" aria-label="Loading placeholder world map viewport">
            <div class="map-overlay map-overlay--top-left">
              <span class="chip chip--small">Coords: ${escapeHtml(scenario.coords)}</span>
              <span class="chip chip--small">Region: ${escapeHtml(scenario.region)}</span>
            </div>
            <div class="map-grid" aria-hidden="true"></div>
            <div class="map-loading-overlay" aria-hidden="true">
              <div class="map-loading-card">
                <div class="skeleton-line skeleton-line--chip"></div>
                <div class="skeleton-line"></div>
                <div class="skeleton-line" style="width: 72%;"></div>
              </div>
            </div>
            <div class="map-overlay map-overlay--bottom-right">
              <div class="map-controls" aria-label="Placeholder map controls">
                <button type="button" class="control-btn" aria-label="Zoom in">+</button>
                <button type="button" class="control-btn" aria-label="Zoom out">-</button>
                <button type="button" class="control-btn" aria-label="Center on settlement">O</button>
              </div>
            </div>
          </div>
          <aside class="map-side" aria-label="Map side panels">
            <section class="subpanel compact">
              <h3>Selected Tile</h3>
              <p class="loading-copy">Loading selected tile preview...</p>
              <div class="wire-fields">${selectedFields}</div>
            </section>
            <section class="subpanel compact">
              <h3>Legend (Placeholder)</h3>
              <ul class="legend-list">${legendItems}</ul>
            </section>
            <section class="subpanel compact">
              <h3>Map Actions</h3>
              <p class="loading-copy">Actions remain placeholder-only during mock loading.</p>
              <div class="stack-sm">${actionItems}</div>
              ${mapContractReasonSection}
            </section>
            ${heroDispatchSection}
            ${hostileDispatchOutcomeSection}
          </aside>
        </div>
      `;

      return;
    }

    if (mode === "empty") {
      refs.content.innerHTML = `
        <div class="map-layout">
          <div class="map-stage" role="group" aria-label="Empty placeholder world map viewport">
            <div class="map-overlay map-overlay--top-left">
              <span class="chip chip--small">Coords: ${escapeHtml(scenario.coords)}</span>
              <span class="chip chip--small">Region: ${escapeHtml(scenario.region)}</span>
            </div>
            <div class="map-grid" aria-hidden="true"></div>
            <div class="map-loading-overlay" aria-hidden="true">
              <div class="map-loading-card">
                <p class="subpanel-note">${escapeHtml(scenario.emptySummary || "No map marker placeholders are available.")}</p>
              </div>
            </div>
            <div class="map-overlay map-overlay--bottom-right">
              <div class="map-controls" aria-label="Placeholder map controls">
                <button type="button" class="control-btn" aria-label="Zoom in">+</button>
                <button type="button" class="control-btn" aria-label="Zoom out">-</button>
                <button type="button" class="control-btn" aria-label="Center on settlement">O</button>
              </div>
            </div>
          </div>
          <aside class="map-side" aria-label="Map side panels">
            <section class="subpanel compact">
              <h3>Selected Tile</h3>
              <p class="subpanel-note">${escapeHtml(scenario.selectedTileHint || "No tile selected.")}</p>
              <div class="wire-fields">${selectedFields}</div>
            </section>
            <section class="subpanel compact">
              <h3>Legend (Placeholder)</h3>
              <ul class="legend-list">${legendItems}</ul>
            </section>
            <section class="subpanel compact">
              <h3>Map Actions</h3>
              <div class="stack-sm">${actionItems}</div>
              ${mapContractReasonSection}
            </section>
            ${heroDispatchSection}
            ${hostileDispatchOutcomeSection}
          </aside>
        </div>
      `;

      return;
    }

    if (mode === "error") {
      refs.content.innerHTML = `
        <div class="map-layout">
          <div class="map-stage is-loading" role="group" aria-label="Error placeholder world map viewport">
            <div class="map-overlay map-overlay--top-left">
              <span class="chip chip--small">Coords: ${escapeHtml(scenario.coords)}</span>
              <span class="chip chip--small">Region: ${escapeHtml(scenario.region)}</span>
            </div>
            <div class="map-grid" aria-hidden="true"></div>
            <div class="map-loading-overlay" aria-hidden="true">
              <div class="map-loading-card">
                <p class="subpanel-note"><strong>Placeholder error: ${escapeHtml(scenario.errorCode || "UNKNOWN_MAP_ERROR")}</strong></p>
                <p class="subpanel-note">${escapeHtml(scenario.emptySummary || "Map stream unavailable.")}</p>
              </div>
            </div>
            <div class="map-overlay map-overlay--bottom-right">
              <div class="map-controls" aria-label="Placeholder map controls">
                <button type="button" class="control-btn" aria-label="Zoom in">+</button>
                <button type="button" class="control-btn" aria-label="Zoom out">-</button>
                <button type="button" class="control-btn" aria-label="Center on settlement">O</button>
              </div>
            </div>
          </div>
          <aside class="map-side" aria-label="Map side panels">
            <section class="subpanel compact">
              <h3>Selected Tile</h3>
              <p class="subpanel-note">${escapeHtml(scenario.selectedTileHint || "Tile inspection unavailable.")}</p>
              <div class="wire-fields">${selectedFields}</div>
            </section>
            <section class="subpanel compact">
              <h3>Legend (Placeholder)</h3>
              <ul class="legend-list">${legendItems}</ul>
            </section>
            <section class="subpanel compact">
              <h3>Map Actions</h3>
              <div class="stack-sm">${actionItems}</div>
              ${mapContractReasonSection}
            </section>
            ${heroDispatchSection}
            ${hostileDispatchOutcomeSection}
          </aside>
        </div>
      `;

      return;
    }

    const markers = (scenario.markers || [])
      .map(
        (marker) => `
          <button
            type="button"
            class="map-marker ${escapeHtml(marker.className)}${marker.selected ? " is-selected" : ""}"
            data-worldmap-marker-id="${escapeHtml(marker.marker_id || "")}"
            data-worldmap-tile-id="${escapeHtml(marker.tile_id || "")}"
            aria-pressed="${String(marker.selected === true)}"
            aria-label="${escapeHtml(`Select ${marker.label}`)}"
          >${escapeHtml(marker.label)}</button>
        `,
      )
      .join("");

    const routes = (scenario.routes || [])
      .map((route) => `<div class="route-line ${escapeHtml(route.className)}"></div>`)
      .join("");

    refs.content.innerHTML = `
      <div class="map-layout">
        <div class="map-stage" role="group" aria-label="Placeholder world map viewport with grid and marker blocks">
          <div class="map-overlay map-overlay--top-left">
            <span class="chip chip--small">Coords: ${escapeHtml(scenario.coords)}</span>
            <span class="chip chip--small">Region: ${escapeHtml(scenario.region)}</span>
          </div>
          <div class="map-grid" aria-hidden="true">
            ${markers}
            ${routes}
          </div>
          <div class="map-overlay map-overlay--bottom-right">
            <div class="map-controls" aria-label="Placeholder map controls">
              <button type="button" class="control-btn" aria-label="Zoom in">+</button>
              <button type="button" class="control-btn" aria-label="Zoom out">-</button>
              <button type="button" class="control-btn" aria-label="Center on settlement">O</button>
            </div>
          </div>
        </div>
        <aside class="map-side" aria-label="Map side panels">
          <section class="subpanel compact">
            <h3>Selected Tile</h3>
            <p class="subpanel-note">Selection state is driven by mock marker data.</p>
            <div class="wire-fields">${selectedFields}</div>
          </section>
          <section class="subpanel compact">
            <h3>Legend (Placeholder)</h3>
            <ul class="legend-list">${legendItems}</ul>
          </section>
          <section class="subpanel compact">
            <h3>Map Actions</h3>
            <div class="stack-sm">${actionItems}</div>
            ${mapContractReasonSection}
          </section>
          ${heroDispatchSection}
          ${hostileDispatchOutcomeSection}
        </aside>
      </div>
    `;
  };

  const renderEventPanel = () => {
    const { panel, mode, scenario } = getPanelScenario("eventFeed");
    const refs = panelRefs.eventFeed;

    if (!refs.content || !refs.title) {
      return;
    }

    refs.title.textContent = panel.title;

    const filters = (scenario.filters || [])
      .map((filter) => {
        const isSelected = filter === scenario.selectedFilter;
        return `<button type="button" class="segment${isSelected ? " is-selected" : ""}">${escapeHtml(filter)}</button>`;
      })
      .join("");

    if (mode === "loading") {
      const eventSlots = Array.from({ length: scenario.eventSlots })
        .map(
          () => `
            <li class="skeleton-event" aria-hidden="true">
              <div class="skeleton-line"></div>
              <div class="skeleton-line"></div>
            </li>
          `,
        )
        .join("");

      const notificationSlots = Array.from({ length: scenario.notificationSlots })
        .map(
          () => `
            <div class="wire-tile" aria-hidden="true">
              <div class="skeleton-line" style="width: 90%;"></div>
            </div>
          `,
        )
        .join("");

      refs.content.innerHTML = `
        <div class="stack">
          <section class="subpanel compact">
            <h3>Feed Controls</h3>
            <div class="segment-row" role="group" aria-label="Loading event filters">${filters}</div>
          </section>
          <section class="subpanel">
            <h3>Recent Events</h3>
            <p class="loading-copy">Loading event entries from local mock state...</p>
            <ol class="event-list" aria-label="Loading event feed placeholders">${eventSlots}</ol>
          </section>
          <section class="subpanel compact">
            <h3>Queued Notifications</h3>
            <div class="wire-tiles">${notificationSlots}</div>
          </section>
        </div>
      `;

      return;
    }

    if (mode === "empty") {
      refs.content.innerHTML = `
        <div class="stack">
          <section class="subpanel compact">
            <h3>Feed Controls</h3>
            <div class="segment-row" role="group" aria-label="Mock event filters">${filters}</div>
          </section>
          <section class="subpanel">
            <h3>Recent Events</h3>
            <div class="wire-empty">${escapeHtml(scenario.emptySummary || "No event feed entries are available.")}</div>
          </section>
          <section class="subpanel compact">
            <h3>Queued Notifications</h3>
            <div class="wire-empty">${escapeHtml(scenario.notificationSummary || "No notifications queued.")}</div>
          </section>
        </div>
      `;

      return;
    }

    if (mode === "error") {
      refs.content.innerHTML = `
        <div class="stack">
          <section class="subpanel compact">
            <h3>Feed Controls</h3>
            <div class="segment-row" role="group" aria-label="Mock event filters">${filters}</div>
          </section>
          <section class="subpanel">
            <h3>Recent Events</h3>
            <div class="wire-empty">
              <strong>Placeholder error: ${escapeHtml(scenario.errorCode || "UNKNOWN_EVENT_FEED_ERROR")}</strong><br />
              ${escapeHtml(scenario.emptySummary || "Event feed unavailable in this mock state.")}
            </div>
          </section>
          <section class="subpanel compact">
            <h3>Queued Notifications</h3>
            <div class="wire-empty">${escapeHtml(scenario.notificationSummary || "Notification queue unavailable.")}</div>
          </section>
        </div>
      `;

      return;
    }

    const priorityClassByValue = {
      high: " priority-high",
      medium: " priority-medium",
      normal: "",
    };

    const events = (scenario.events || [])
      .map((item) => {
        const priorityClass = priorityClassByValue[item.priority] || "";
        const resolvedContentKey = item.contentKey
          ? resolveManifestScopedEventContentKey(item.contentKey)
          : "";
        const title = resolvedContentKey
          ? getNarrativeText(resolvedContentKey, item.tokens)
          : item.title || "[Missing event title]";
        return `
          <li class="event-item${priorityClass}"${resolvedContentKey ? ` data-content-key="${escapeHtml(resolvedContentKey)}"` : ""}>
            <p class="event-item__title">${escapeHtml(title)}</p>
            <p class="event-item__meta">${escapeHtml(item.meta)}</p>
          </li>
        `;
      })
      .join("");

    const notifications = (scenario.queuedNotifications || [])
      .map((item) => `<div class="wire-tile">${escapeHtml(item)}</div>`)
      .join("");

    refs.content.innerHTML = `
      <div class="stack">
        <section class="subpanel compact">
          <h3>Feed Controls</h3>
          <div class="segment-row" role="group" aria-label="Mock event filters">${filters}</div>
        </section>
        <section class="subpanel">
          <h3>Recent Events</h3>
          <ol class="event-list" aria-label="Mock event feed entries">${events}</ol>
        </section>
        <section class="subpanel compact">
          <h3>Queued Notifications</h3>
          <div class="wire-tiles">${notifications}</div>
        </section>
      </div>
    `;
  };

  const renderPanels = () => {
    renderStateControls("settlement");
    renderStateControls("worldMap");
    renderStateControls("eventFeed");

    renderSettlementPanel();
    renderMapPanel();
    renderEventPanel();
  };

  document.addEventListener("click", (event) => {
    const settlementOutcomeModeButton = event.target.closest("[data-settlement-outcome-mode]");
    if (settlementOutcomeModeButton) {
      const outcomeMode = settlementOutcomeModeButton.getAttribute("data-settlement-outcome-mode");
      if (outcomeMode === "success" || outcomeMode === "failure") {
        settlementActionRuntime.action_outcome_mode = outcomeMode;
        renderSettlementPanel();
      }
      return;
    }

    const settlementActionButton = event.target.closest("[data-settlement-adapter-action]");
    if (settlementActionButton) {
      const actionType = settlementActionButton.getAttribute("data-settlement-adapter-action");
      if (actionType === "tick" || actionType === "build" || actionType === "train") {
        void runSettlementContractAction(actionType);
      }
      return;
    }

    const worldMapHeroAttachButton = event.target.closest("[data-worldmap-hero-attach-id]");
    if (worldMapHeroAttachButton) {
      const heroId = worldMapHeroAttachButton.getAttribute("data-worldmap-hero-attach-id");
      setSelectedWorldMapDispatchHero(heroId);
      renderPanels();
      const focusTarget = typeof heroId === "string" && heroId.trim().length > 0
        ? document.querySelector(`[data-worldmap-hero-attach-id="${heroId.trim()}"]`)
        : null;
      if (focusTarget instanceof HTMLButtonElement) {
        focusTarget.focus({ preventScroll: true });
      }
      return;
    }

    const worldMapActionButton = event.target.closest("[data-worldmap-adapter-action]");
    if (worldMapActionButton) {
      const actionType = worldMapActionButton.getAttribute("data-worldmap-adapter-action");
      if (actionType === "scout" || actionType === "attack") {
        void runWorldMapContractAction(actionType);
      }
      return;
    }

    const worldMapMarkerButton = event.target.closest("[data-worldmap-marker-id]");
    if (worldMapMarkerButton) {
      const markerId = worldMapMarkerButton.getAttribute("data-worldmap-marker-id");
      if (typeof markerId === "string" && markerId.trim().length > 0) {
        setSelectedWorldMapMarker(markerId);
        renderPanels();
        const replacementMarkerButton = document.querySelector(
          `[data-worldmap-marker-id="${markerId.trim()}"]`,
        );
        if (replacementMarkerButton instanceof HTMLButtonElement) {
          replacementMarkerButton.focus({ preventScroll: true });
        }
      }
      return;
    }

    const button = event.target.closest("[data-mock-panel][data-mock-mode]");

    if (!button) {
      return;
    }

    const panelKey = button.getAttribute("data-mock-panel");
    const mode = button.getAttribute("data-mock-mode");
    const panel = panelKey ? mockClientShellState.panels[panelKey] : null;

    if (!panel || !mode || !panel.stateOptions.includes(mode)) {
      return;
    }

    mockClientShellState.panelModes[panelKey] = mode;
    renderPanels();

    const replacementButton = document.querySelector(
      `[data-mock-panel="${panelKey}"][data-mock-mode="${mode}"]`,
    );

    if (replacementButton instanceof HTMLButtonElement) {
      replacementButton.focus({ preventScroll: true });
    }
  });

  renderPanels();

  const tabs = Array.from(document.querySelectorAll(".region-tab"));

  if (tabs.length === 0) {
    return;
  }

  const syncTabSelection = (activeTab) => {
    tabs.forEach((item) => {
      const isActive = item === activeTab;
      item.classList.toggle("is-active", isActive);
      item.setAttribute("aria-selected", String(isActive));
      item.tabIndex = isActive ? 0 : -1;
    });
  };

  const moveFocusToPanel = (tab) => {
    const targetId = tab.getAttribute("data-target");
    const panel = targetId ? document.getElementById(targetId) : null;

    if (!panel) {
      return;
    }

    syncTabSelection(tab);

    try {
      panel.focus({ preventScroll: true });
    } catch {
      panel.focus();
    }

    panel.scrollIntoView({
      behavior: reducedMotionQuery?.matches ? "auto" : "smooth",
      block: "start",
    });
  };

  tabs.forEach((tab, index) => {
    tab.tabIndex = index === 0 ? 0 : -1;

    tab.addEventListener("click", () => moveFocusToPanel(tab));

    tab.addEventListener("keydown", (event) => {
      const currentIndex = tabs.indexOf(tab);

      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        const next = tabs[(currentIndex + 1) % tabs.length];
        next.focus();
      }

      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        const prev = tabs[(currentIndex - 1 + tabs.length) % tabs.length];
        prev.focus();
      }

      if (event.key === "Home") {
        event.preventDefault();
        tabs[0].focus();
      }

      if (event.key === "End") {
        event.preventDefault();
        tabs[tabs.length - 1].focus();
      }

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        moveFocusToPanel(tab);
      }
    });
  });

  // Keep region tab state in sync with reading position on scroll.
  const panels = tabs
    .map((tab) => document.getElementById(tab.getAttribute("data-target") || ""))
    .filter(Boolean);

  if ("IntersectionObserver" in window && panels.length > 0) {
    const observer = new IntersectionObserver(
      (entries) => {
        const pageOffsetY =
          typeof window.scrollY === "number"
            ? window.scrollY
            : Number(window.pageYOffset || 0);
        if (pageOffsetY < 8) {
          return;
        }

        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (!visible) {
          return;
        }

        const matchingTab = tabs.find(
          (tab) => tab.getAttribute("data-target") === visible.target.id,
        );

        if (!matchingTab) {
          return;
        }

        syncTabSelection(matchingTab);
      },
      {
        rootMargin: "-20% 0px -55% 0px",
        threshold: [0.15, 0.35, 0.5],
      },
    );

    panels.forEach((panelElement) => observer.observe(panelElement));
  }
})();
