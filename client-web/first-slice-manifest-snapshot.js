window.__RK_FIRST_SLICE_MANIFEST_SNAPSHOT_V1__ = Object.freeze({
  "schema_version": "rk-v1-first-slice-manifest-snapshot",
  "source_manifests": {
    "playable": {
      "path": "backend/src/app/config/seeds/v1/first-slice-playable-manifest.json",
      "manifest_id": "first_slice_playable_manifest_lock_v1"
    },
    "content_keys": {
      "path": "backend/src/app/config/seeds/v1/narrative/first-slice-content-key-manifest.json",
      "manifest_id": "first_slice_content_key_manifest_v1"
    }
  },
  "playable": {
    "manifest_id": "first_slice_playable_manifest_lock_v1",
    "canonical_playable_now": {
      "civilization_profile_id": "cinder_throne_legates",
      "primary_settlement": {
        "settlement_id": "settlement_alpha",
        "settlement_name": "Cinderwatch Hold"
      },
      "foreign_hostile_profile": {
        "profile_id": "foreign_settlement_profile_v1_ruin_holdfast",
        "settlement_id": "settlement_hostile",
        "settlement_name": "Ruin Holdfast",
        "target_tile_label": "Ruin Holdfast",
        "map_coordinate": {
          "x": 2,
          "y": 1
        },
        "defender_garrison_strength": 40
      },
      "resources": [
        "food",
        "wood",
        "stone",
        "iron"
      ],
      "buildings": [
        "grain_plot",
        "timber_camp",
        "stone_quarry",
        "iron_pit",
        "barracks",
        "rally_post"
      ],
      "units": [
        "watch_levy",
        "bow_crew",
        "trail_scout",
        "light_raider"
      ],
      "map_fixture_ids": {
        "world_id": "world_alpha",
        "world_seed": "seed_world_alpha",
        "hostile_target_settlement_id": "settlement_hostile",
        "scout_tile_ids": [
          "tile_unknown_demo",
          "tile_quiet_watch",
          "tile_hostile_glade"
        ],
        "deterministic_attack_fixture_ids": [
          "attack_fixture_attacker_win_50v40",
          "attack_fixture_attacker_loss_30v40",
          "attack_fixture_tie_40v40"
        ]
      }
    },
    "default_consumption_contract": {
      "frontend": {
        "default_session_entry_settlement_id": "settlement_alpha",
        "default_hostile_target_settlement_id": "settlement_hostile"
      }
    }
  },
  "content_keys": {
    "manifest_id": "first_slice_content_key_manifest_v1",
    "default_first_slice_seed_usage": {
      "include_only_content_keys": [
        "event.tick.passive_income",
        "event.tick.storage_near_cap",
        "event.tick.producer_unlocked_hint",
        "event.tick.passive_gain_success",
        "event.tick.passive_gain_reasoned",
        "event.tick.passive_gain_stalled",
        "event.tick.passive_gain_capped",
        "event.build.upgrade_started",
        "event.build.upgrade_completed",
        "event.build.queue_blocked_resources",
        "event.build.success",
        "event.build.failure_insufficient_resources",
        "event.build.failure_cooldown",
        "event.build.failure_invalid_state",
        "event.train.started",
        "event.train.completed",
        "event.train.queue_full",
        "event.train.success",
        "event.train.failure_insufficient_resources",
        "event.train.failure_cooldown",
        "event.train.failure_invalid_state",
        "event.scout.dispatched",
        "event.scout.report_empty",
        "event.scout.report_hostile",
        "event.scout.dispatched_success",
        "event.scout.return_empty",
        "event.scout.return_hostile",
        "event.world.hostile_foreign_settlement_spotted",
        "event.world.hostile_dispatch_target_required",
        "event.world.hostile_dispatch_accepted",
        "event.world.hostile_dispatch_en_route",
        "event.world.hostile_dispatch_failed",
        "event.world.hostile_dispatch_failed_source_target_not_foreign",
        "event.world.hostile_dispatch_failed_max_active_marches_reached",
        "event.world.hostile_dispatch_failed_path_blocked_impassable",
        "event.world.hostile_dispatch_failed_march_already_exists",
        "event.world.hostile_march_arrived_outer_works",
        "event.world.hostile_march_arrived_gate_contested",
        "event.combat.hostile_resolve_attacker_win",
        "event.combat.hostile_resolve_defender_win",
        "event.combat.hostile_resolve_tie_defender_holds",
        "event.combat.hostile_loss_report",
        "event.combat.hostile_garrison_broken",
        "event.combat.hostile_counterfire_heavy",
        "event.world.hostile_retreat_ordered",
        "event.world.hostile_retreat_in_motion",
        "event.world.hostile_retreat_completed",
        "event.world.hostile_defeat_force_shattered",
        "event.world.hostile_defeat_command_silent",
        "event.world.hostile_post_battle_return_started",
        "event.world.hostile_post_battle_returned"
      ]
    },
    "legacy_alias_mapping": [
      {
        "canonical_key": "event.tick.passive_income",
        "legacy_keys": [
          "event.economy.tick_passive_income"
        ]
      },
      {
        "canonical_key": "event.tick.storage_near_cap",
        "legacy_keys": [
          "event.economy.storage_near_cap"
        ]
      },
      {
        "canonical_key": "event.tick.producer_unlocked_hint",
        "legacy_keys": [
          "event.economy.producer_unlocked_hint"
        ]
      },
      {
        "canonical_key": "event.build.upgrade_started",
        "legacy_keys": [
          "event.buildings.upgrade_started"
        ]
      },
      {
        "canonical_key": "event.build.upgrade_completed",
        "legacy_keys": [
          "event.buildings.upgrade_completed"
        ]
      },
      {
        "canonical_key": "event.build.queue_blocked_resources",
        "legacy_keys": [
          "event.buildings.queue_blocked_resources"
        ]
      },
      {
        "canonical_key": "event.train.started",
        "legacy_keys": [
          "event.units.training_started"
        ]
      },
      {
        "canonical_key": "event.train.completed",
        "legacy_keys": [
          "event.units.training_completed"
        ]
      },
      {
        "canonical_key": "event.train.queue_full",
        "legacy_keys": [
          "event.units.training_queue_full"
        ]
      },
      {
        "canonical_key": "event.scout.dispatched",
        "legacy_keys": [
          "event.world.scout_dispatched"
        ]
      },
      {
        "canonical_key": "event.scout.report_empty",
        "legacy_keys": [
          "event.world.scout_report_empty"
        ]
      },
      {
        "canonical_key": "event.scout.report_hostile",
        "legacy_keys": [
          "event.world.scout_report_hostile"
        ]
      },
      {
        "canonical_key": "event.world.hostile_dispatch_en_route",
        "legacy_keys": [
          "event.world.march_started"
        ]
      },
      {
        "canonical_key": "event.world.hostile_post_battle_returned",
        "legacy_keys": [
          "event.world.march_returned"
        ]
      },
      {
        "canonical_key": "event.world.hostile_retreat_completed",
        "legacy_keys": [
          "event.world.march_returned"
        ]
      },
      {
        "canonical_key": "event.world.hostile_defeat_force_shattered",
        "legacy_keys": [
          "event.world.march_returned"
        ]
      },
      {
        "canonical_key": "event.combat.hostile_resolve_attacker_win",
        "legacy_keys": [
          "event.combat.placeholder_skirmish_win"
        ]
      },
      {
        "canonical_key": "event.combat.hostile_resolve_defender_win",
        "legacy_keys": [
          "event.combat.placeholder_skirmish_loss"
        ]
      },
      {
        "canonical_key": "event.combat.hostile_resolve_tie_defender_holds",
        "legacy_keys": [
          "event.combat.placeholder_skirmish_loss"
        ]
      }
    ]
  }
});
