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
    },
    "narrative_templates": {
      "path": "backend/src/app/config/seeds/v1/narrative/first-slice-narrative-template-snapshot.lock.json",
      "manifest_id": "first_slice_content_key_manifest_v1",
      "snapshot_id": "first_slice_narrative_template_snapshot_v1"
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
      }
    ],
    "default_first_session_narrative_templates": {
      "snapshot_id": "first_slice_narrative_template_snapshot_v1",
      "manifest_id": "first_slice_content_key_manifest_v1",
      "lookup_resolution_order_by_canonical_key": [
        {
          "canonical_key": "event.tick.passive_income",
          "resolution_order": [
            "event.tick.passive_income",
            "event.economy.tick_passive_income"
          ]
        },
        {
          "canonical_key": "event.tick.storage_near_cap",
          "resolution_order": [
            "event.tick.storage_near_cap",
            "event.economy.storage_near_cap"
          ]
        },
        {
          "canonical_key": "event.tick.producer_unlocked_hint",
          "resolution_order": [
            "event.tick.producer_unlocked_hint",
            "event.economy.producer_unlocked_hint"
          ]
        },
        {
          "canonical_key": "event.tick.passive_gain_success",
          "resolution_order": [
            "event.tick.passive_gain_success"
          ]
        },
        {
          "canonical_key": "event.tick.passive_gain_reasoned",
          "resolution_order": [
            "event.tick.passive_gain_reasoned"
          ]
        },
        {
          "canonical_key": "event.tick.passive_gain_stalled",
          "resolution_order": [
            "event.tick.passive_gain_stalled"
          ]
        },
        {
          "canonical_key": "event.tick.passive_gain_capped",
          "resolution_order": [
            "event.tick.passive_gain_capped"
          ]
        },
        {
          "canonical_key": "event.build.upgrade_started",
          "resolution_order": [
            "event.build.upgrade_started",
            "event.buildings.upgrade_started"
          ]
        },
        {
          "canonical_key": "event.build.upgrade_completed",
          "resolution_order": [
            "event.build.upgrade_completed",
            "event.buildings.upgrade_completed"
          ]
        },
        {
          "canonical_key": "event.build.queue_blocked_resources",
          "resolution_order": [
            "event.build.queue_blocked_resources",
            "event.buildings.queue_blocked_resources"
          ]
        },
        {
          "canonical_key": "event.build.success",
          "resolution_order": [
            "event.build.success"
          ]
        },
        {
          "canonical_key": "event.build.failure_insufficient_resources",
          "resolution_order": [
            "event.build.failure_insufficient_resources"
          ]
        },
        {
          "canonical_key": "event.build.failure_cooldown",
          "resolution_order": [
            "event.build.failure_cooldown"
          ]
        },
        {
          "canonical_key": "event.build.failure_invalid_state",
          "resolution_order": [
            "event.build.failure_invalid_state"
          ]
        },
        {
          "canonical_key": "event.train.started",
          "resolution_order": [
            "event.train.started",
            "event.units.training_started"
          ]
        },
        {
          "canonical_key": "event.train.completed",
          "resolution_order": [
            "event.train.completed",
            "event.units.training_completed"
          ]
        },
        {
          "canonical_key": "event.train.queue_full",
          "resolution_order": [
            "event.train.queue_full",
            "event.units.training_queue_full"
          ]
        },
        {
          "canonical_key": "event.train.success",
          "resolution_order": [
            "event.train.success"
          ]
        },
        {
          "canonical_key": "event.train.failure_insufficient_resources",
          "resolution_order": [
            "event.train.failure_insufficient_resources"
          ]
        },
        {
          "canonical_key": "event.train.failure_cooldown",
          "resolution_order": [
            "event.train.failure_cooldown"
          ]
        },
        {
          "canonical_key": "event.train.failure_invalid_state",
          "resolution_order": [
            "event.train.failure_invalid_state"
          ]
        },
        {
          "canonical_key": "event.scout.dispatched",
          "resolution_order": [
            "event.scout.dispatched",
            "event.world.scout_dispatched"
          ]
        },
        {
          "canonical_key": "event.scout.report_empty",
          "resolution_order": [
            "event.scout.report_empty",
            "event.world.scout_report_empty"
          ]
        },
        {
          "canonical_key": "event.scout.report_hostile",
          "resolution_order": [
            "event.scout.report_hostile",
            "event.world.scout_report_hostile"
          ]
        },
        {
          "canonical_key": "event.scout.dispatched_success",
          "resolution_order": [
            "event.scout.dispatched_success"
          ]
        },
        {
          "canonical_key": "event.scout.return_empty",
          "resolution_order": [
            "event.scout.return_empty"
          ]
        },
        {
          "canonical_key": "event.scout.return_hostile",
          "resolution_order": [
            "event.scout.return_hostile"
          ]
        },
        {
          "canonical_key": "event.world.hostile_foreign_settlement_spotted",
          "resolution_order": [
            "event.world.hostile_foreign_settlement_spotted"
          ]
        },
        {
          "canonical_key": "event.world.hostile_dispatch_target_required",
          "resolution_order": [
            "event.world.hostile_dispatch_target_required"
          ]
        },
        {
          "canonical_key": "event.world.hostile_dispatch_accepted",
          "resolution_order": [
            "event.world.hostile_dispatch_accepted"
          ]
        },
        {
          "canonical_key": "event.world.hostile_dispatch_en_route",
          "resolution_order": [
            "event.world.hostile_dispatch_en_route",
            "event.world.march_started"
          ]
        },
        {
          "canonical_key": "event.world.hostile_dispatch_failed",
          "resolution_order": [
            "event.world.hostile_dispatch_failed"
          ]
        },
        {
          "canonical_key": "event.world.hostile_dispatch_failed_source_target_not_foreign",
          "resolution_order": [
            "event.world.hostile_dispatch_failed_source_target_not_foreign"
          ]
        },
        {
          "canonical_key": "event.world.hostile_dispatch_failed_max_active_marches_reached",
          "resolution_order": [
            "event.world.hostile_dispatch_failed_max_active_marches_reached"
          ]
        },
        {
          "canonical_key": "event.world.hostile_dispatch_failed_path_blocked_impassable",
          "resolution_order": [
            "event.world.hostile_dispatch_failed_path_blocked_impassable"
          ]
        },
        {
          "canonical_key": "event.world.hostile_dispatch_failed_march_already_exists",
          "resolution_order": [
            "event.world.hostile_dispatch_failed_march_already_exists"
          ]
        },
        {
          "canonical_key": "event.world.hostile_march_arrived_outer_works",
          "resolution_order": [
            "event.world.hostile_march_arrived_outer_works"
          ]
        },
        {
          "canonical_key": "event.world.hostile_march_arrived_gate_contested",
          "resolution_order": [
            "event.world.hostile_march_arrived_gate_contested"
          ]
        },
        {
          "canonical_key": "event.combat.hostile_resolve_attacker_win",
          "resolution_order": [
            "event.combat.hostile_resolve_attacker_win",
            "event.combat.placeholder_skirmish_win"
          ]
        },
        {
          "canonical_key": "event.combat.hostile_resolve_defender_win",
          "resolution_order": [
            "event.combat.hostile_resolve_defender_win",
            "event.combat.placeholder_skirmish_loss"
          ]
        },
        {
          "canonical_key": "event.combat.hostile_resolve_tie_defender_holds",
          "resolution_order": [
            "event.combat.hostile_resolve_tie_defender_holds"
          ]
        },
        {
          "canonical_key": "event.combat.hostile_loss_report",
          "resolution_order": [
            "event.combat.hostile_loss_report"
          ]
        },
        {
          "canonical_key": "event.combat.hostile_garrison_broken",
          "resolution_order": [
            "event.combat.hostile_garrison_broken"
          ]
        },
        {
          "canonical_key": "event.combat.hostile_counterfire_heavy",
          "resolution_order": [
            "event.combat.hostile_counterfire_heavy"
          ]
        },
        {
          "canonical_key": "event.world.hostile_retreat_ordered",
          "resolution_order": [
            "event.world.hostile_retreat_ordered"
          ]
        },
        {
          "canonical_key": "event.world.hostile_retreat_in_motion",
          "resolution_order": [
            "event.world.hostile_retreat_in_motion"
          ]
        },
        {
          "canonical_key": "event.world.hostile_retreat_completed",
          "resolution_order": [
            "event.world.hostile_retreat_completed"
          ]
        },
        {
          "canonical_key": "event.world.hostile_defeat_force_shattered",
          "resolution_order": [
            "event.world.hostile_defeat_force_shattered"
          ]
        },
        {
          "canonical_key": "event.world.hostile_defeat_command_silent",
          "resolution_order": [
            "event.world.hostile_defeat_command_silent"
          ]
        },
        {
          "canonical_key": "event.world.hostile_post_battle_return_started",
          "resolution_order": [
            "event.world.hostile_post_battle_return_started"
          ]
        },
        {
          "canonical_key": "event.world.hostile_post_battle_returned",
          "resolution_order": [
            "event.world.hostile_post_battle_returned",
            "event.world.march_returned"
          ]
        }
      ],
      "templates_by_key": {
        "event.build.failure_cooldown": {
          "template": "{building_id}: work crews are still turning to complete prior orders; new orders resume at {cooldown_ends_at}.",
          "tokens": [
            "building_id",
            "cooldown_ends_at"
          ]
        },
        "event.build.failure_insufficient_resources": {
          "template": "{building_id}: upgrade halted. Missing stores {missing_resources_by_id}; needed {required_cost_by_id}, on hand {available_stock_by_id}.",
          "tokens": [
            "building_id",
            "missing_resources_by_id",
            "required_cost_by_id",
            "available_stock_by_id"
          ]
        },
        "event.build.failure_invalid_state": {
          "template": "{building_id}: command rejected while the builder's ledger reports {invalid_reason}.",
          "tokens": [
            "building_id",
            "invalid_reason"
          ]
        },
        "event.build.queue_blocked_resources": {
          "template": "{settlement_name}: insufficient stores for {building_label}. Required materials have not been gathered.",
          "tokens": [
            "settlement_name",
            "building_label"
          ]
        },
        "event.build.success": {
          "template": "{settlement_name}: work begins on {building_label} (Lv.{from_level} -> Lv.{to_level}).",
          "tokens": [
            "settlement_name",
            "building_label",
            "from_level",
            "to_level"
          ]
        },
        "event.build.upgrade_completed": {
          "template": "{settlement_name}: {building_label} reaches Lv.{new_level}. Crews return to regular duty.",
          "tokens": [
            "settlement_name",
            "building_label",
            "new_level"
          ]
        },
        "event.build.upgrade_started": {
          "template": "{settlement_name}: work begins on {building_label} (Lv.{from_level} -> Lv.{to_level}).",
          "tokens": [
            "settlement_name",
            "building_label",
            "from_level",
            "to_level"
          ]
        },
        "event.buildings.queue_blocked_resources": {
          "template": "{settlement_name}: insufficient stores for {building_label}. Required materials have not been gathered.",
          "tokens": [
            "settlement_name",
            "building_label"
          ]
        },
        "event.buildings.upgrade_completed": {
          "template": "{settlement_name}: {building_label} reaches Lv.{new_level}. Crews return to regular duty.",
          "tokens": [
            "settlement_name",
            "building_label",
            "new_level"
          ]
        },
        "event.buildings.upgrade_started": {
          "template": "{settlement_name}: work begins on {building_label} (Lv.{from_level} -> Lv.{to_level}).",
          "tokens": [
            "settlement_name",
            "building_label",
            "from_level",
            "to_level"
          ]
        },
        "event.combat.hostile_counterfire_heavy": {
          "template": "[PLACEHOLDER] Defender volleys tear through the front rank; command marks this assault as heavy-loss.",
          "tokens": []
        },
        "event.combat.hostile_garrison_broken": {
          "template": "[PLACEHOLDER] Garrison at {target_tile_label} is broken; no shield line remains on the wall.",
          "tokens": [
            "target_tile_label"
          ]
        },
        "event.combat.hostile_loss_report": {
          "template": "[PLACEHOLDER] Casualty ledger: attacker lost {attacker_units_lost}/{attacker_units_dispatched}; defender lost {defender_garrison_lost}/{defender_strength}.",
          "tokens": [
            "attacker_units_lost",
            "attacker_units_dispatched",
            "defender_garrison_lost",
            "defender_strength"
          ]
        },
        "event.combat.hostile_resolve_attacker_win": {
          "template": "[PLACEHOLDER] {army_name} breaks {target_tile_label}. The garrison is cut down and banners fall.",
          "tokens": [
            "army_name",
            "target_tile_label"
          ]
        },
        "event.combat.hostile_resolve_defender_win": {
          "template": "[PLACEHOLDER] {army_name} is repelled at {target_tile_label}; the walls hold through the slaughter.",
          "tokens": [
            "army_name",
            "target_tile_label"
          ]
        },
        "event.combat.hostile_resolve_tie_defender_holds": {
          "template": "[PLACEHOLDER] The clash at {target_tile_label} ends even in blood, but the defender keeps the gate by decree.",
          "tokens": [
            "target_tile_label"
          ]
        },
        "event.combat.placeholder_skirmish_loss": {
          "template": "{army_name} is repelled at {target_tile_label}; the walls hold through the slaughter.",
          "tokens": [
            "army_name",
            "target_tile_label"
          ]
        },
        "event.combat.placeholder_skirmish_win": {
          "template": "{army_name} wins a brief skirmish near {target_tile_label}. Losses are light; survivors regroup for orders.",
          "tokens": [
            "army_name",
            "target_tile_label"
          ]
        },
        "event.economy.producer_unlocked_hint": {
          "template": "{building_label} can be improved to steady {resource_label} output in {settlement_name}.",
          "tokens": [
            "building_label",
            "resource_label",
            "settlement_name"
          ]
        },
        "event.economy.storage_near_cap": {
          "template": "{settlement_name} is nearly full on {resource_label}. Spend or upgrade production priorities before overflow wastes stock.",
          "tokens": [
            "settlement_name",
            "resource_label"
          ]
        },
        "event.economy.tick_passive_income": {
          "template": "{settlement_name} stores rise: +{food_gain} Food, +{wood_gain} Wood, +{stone_gain} Stone, +{iron_gain} Iron.",
          "tokens": [
            "settlement_name",
            "food_gain",
            "wood_gain",
            "stone_gain",
            "iron_gain"
          ]
        },
        "event.scout.dispatched": {
          "template": "{settlement_name}: scouts ride out toward {target_tile_label}.",
          "tokens": [
            "settlement_name",
            "target_tile_label"
          ]
        },
        "event.scout.dispatched_success": {
          "template": "{settlement_name}: scouts ride out toward {target_tile_label} and report on first contact within the cycle.",
          "tokens": [
            "settlement_name",
            "target_tile_label"
          ]
        },
        "event.scout.report_empty": {
          "template": "Scout report from {target_tile_label}: no active host detected. The roads remain quiet for now.",
          "tokens": [
            "target_tile_label"
          ]
        },
        "event.scout.report_hostile": {
          "template": "Scout report from {target_tile_label}: hostile movement sighted ({hostile_force_estimate}).",
          "tokens": [
            "target_tile_label",
            "hostile_force_estimate"
          ]
        },
        "event.scout.return_empty": {
          "template": "Scouting returns to quiet from {target_tile_label}; no active host disturbed the roads.",
          "tokens": [
            "target_tile_label"
          ]
        },
        "event.scout.return_hostile": {
          "template": "Scouts from {target_tile_label} report hostile movement ({hostile_force_estimate}); garrisons should tighten watch.",
          "tokens": [
            "target_tile_label",
            "hostile_force_estimate"
          ]
        },
        "event.tick.passive_gain_capped": {
          "template": "{settlement_name}: storage limits clipped this tick, and excess yield is marked as waste.",
          "tokens": [
            "settlement_name"
          ]
        },
        "event.tick.passive_gain_reasoned": {
          "template": "{settlement_name}: tick logic resolved with {reason_codes} over {duration_ms}ms.",
          "tokens": [
            "settlement_name",
            "reason_codes",
            "duration_ms"
          ]
        },
        "event.tick.passive_gain_stalled": {
          "template": "{settlement_name}: this {duration_ms}ms tick produced no gain; the ledger held steady under poor harvest timing.",
          "tokens": [
            "settlement_name",
            "duration_ms"
          ]
        },
        "event.tick.passive_gain_success": {
          "template": "{settlement_name}: the harvest cycle clears after {duration_ms}ms, and stores are restocked without incident.",
          "tokens": [
            "settlement_name",
            "duration_ms"
          ]
        },
        "event.tick.passive_income": {
          "template": "{settlement_name} stores rise: +{food_gain} Food, +{wood_gain} Wood, +{stone_gain} Stone, +{iron_gain} Iron.",
          "tokens": [
            "settlement_name",
            "food_gain",
            "wood_gain",
            "stone_gain",
            "iron_gain"
          ]
        },
        "event.tick.producer_unlocked_hint": {
          "template": "{building_label} can be improved to steady {resource_label} output in {settlement_name}.",
          "tokens": [
            "building_label",
            "resource_label",
            "settlement_name"
          ]
        },
        "event.tick.storage_near_cap": {
          "template": "{settlement_name} is nearly full on {resource_label}. Spend or upgrade production priorities before overflow wastes stock.",
          "tokens": [
            "settlement_name",
            "resource_label"
          ]
        },
        "event.train.completed": {
          "template": "{settlement_name}: {quantity} {unit_label} report ready for orders.",
          "tokens": [
            "settlement_name",
            "quantity",
            "unit_label"
          ]
        },
        "event.train.failure_cooldown": {
          "template": "{unit_id}: barracks queue is locked until {queue_available_at}, {cooldown_remaining_ms}ms remaining.",
          "tokens": [
            "unit_id",
            "queue_available_at",
            "cooldown_remaining_ms"
          ]
        },
        "event.train.failure_insufficient_resources": {
          "template": "{unit_id}: muster delayed; missing resources {missing_resources_by_id} against required {required_cost_by_id}.",
          "tokens": [
            "unit_id",
            "missing_resources_by_id",
            "required_cost_by_id"
          ]
        },
        "event.train.failure_invalid_state": {
          "template": "{unit_id}: muster rejected as state contract reads {invalid_reason}.",
          "tokens": [
            "unit_id",
            "invalid_reason"
          ]
        },
        "event.train.queue_full": {
          "template": "{settlement_name}: barracks queue is full. Resolve current musters before issuing more training orders.",
          "tokens": [
            "settlement_name"
          ]
        },
        "event.train.started": {
          "template": "{settlement_name}: training begins for {quantity} {unit_label}.",
          "tokens": [
            "settlement_name",
            "quantity",
            "unit_label"
          ]
        },
        "event.train.success": {
          "template": "{settlement_name}: training begins for {quantity} {unit_label}.",
          "tokens": [
            "settlement_name",
            "quantity",
            "unit_label"
          ]
        },
        "event.units.training_completed": {
          "template": "{settlement_name}: {quantity} {unit_label} report ready for orders.",
          "tokens": [
            "settlement_name",
            "quantity",
            "unit_label"
          ]
        },
        "event.units.training_queue_full": {
          "template": "{settlement_name}: barracks queue is full. Resolve current musters before issuing more training orders.",
          "tokens": [
            "settlement_name"
          ]
        },
        "event.units.training_started": {
          "template": "{settlement_name}: training begins for {quantity} {unit_label}.",
          "tokens": [
            "settlement_name",
            "quantity",
            "unit_label"
          ]
        },
        "event.world.hostile_defeat_command_silent": {
          "template": "[PLACEHOLDER] Defeat report: no further signals from {army_name}; command slate marks column missing.",
          "tokens": [
            "army_name"
          ]
        },
        "event.world.hostile_defeat_force_shattered": {
          "template": "[PLACEHOLDER] Defeat at {target_tile_label}: {army_name} is shattered and combat cohesion is lost.",
          "tokens": [
            "target_tile_label",
            "army_name"
          ]
        },
        "event.world.hostile_dispatch_accepted": {
          "template": "[PLACEHOLDER] {army_name} receives the black-seal order and departs {origin_settlement_name} for {target_tile_label}.",
          "tokens": [
            "army_name",
            "origin_settlement_name",
            "target_tile_label"
          ]
        },
        "event.world.hostile_dispatch_en_route": {
          "template": "[PLACEHOLDER] {army_name} crosses killing ground toward {target_tile_label}. ETA {eta_seconds}s.",
          "tokens": [
            "army_name",
            "target_tile_label",
            "eta_seconds"
          ]
        },
        "event.world.hostile_dispatch_failed": {
          "template": "[PLACEHOLDER] Hostile march dispatch failed ({error_code}) near {target_tile_label}: {message}",
          "tokens": [
            "error_code",
            "target_tile_label",
            "message"
          ]
        },
        "event.world.hostile_dispatch_failed_march_already_exists": {
          "template": "[PLACEHOLDER] Dispatch denied: march id {march_id} already carries a standing war order.",
          "tokens": [
            "march_id"
          ]
        },
        "event.world.hostile_dispatch_failed_max_active_marches_reached": {
          "template": "[PLACEHOLDER] Dispatch denied: {source_settlement_name} has no free march slot; active columns must resolve first.",
          "tokens": [
            "source_settlement_name"
          ]
        },
        "event.world.hostile_dispatch_failed_path_blocked_impassable": {
          "template": "[PLACEHOLDER] Dispatch denied: route to {target_tile_label} breaks on impassable ground.",
          "tokens": [
            "target_tile_label"
          ]
        },
        "event.world.hostile_dispatch_failed_source_target_not_foreign": {
          "template": "[PLACEHOLDER] Dispatch denied: {source_settlement_name} cannot declare hostile action against its own banner.",
          "tokens": [
            "source_settlement_name"
          ]
        },
        "event.world.hostile_dispatch_target_required": {
          "template": "[PLACEHOLDER] Select a foreign settlement tile before dispatching a hostile march.",
          "tokens": []
        },
        "event.world.hostile_foreign_settlement_spotted": {
          "template": "[PLACEHOLDER] Foreign settlement sighted: {target_tile_label}. Scout glyphs mark it hostile.",
          "tokens": [
            "target_tile_label"
          ]
        },
        "event.world.hostile_march_arrived_gate_contested": {
          "template": "[PLACEHOLDER] {army_name} closes on the gate at {target_tile_label}; defenders form under torchlight.",
          "tokens": [
            "army_name",
            "target_tile_label"
          ]
        },
        "event.world.hostile_march_arrived_outer_works": {
          "template": "[PLACEHOLDER] {army_name} reaches {target_tile_label}; horns sound from the outer works.",
          "tokens": [
            "army_name",
            "target_tile_label"
          ]
        },
        "event.world.hostile_post_battle_return_started": {
          "template": "[PLACEHOLDER] Post-battle return: {army_name} turns for {settlement_name} under dim watchfires.",
          "tokens": [
            "army_name",
            "settlement_name"
          ]
        },
        "event.world.hostile_post_battle_returned": {
          "template": "[PLACEHOLDER] {army_name} returns to {settlement_name}; tally survivors and prepare the next war order.",
          "tokens": [
            "army_name",
            "settlement_name"
          ]
        },
        "event.world.hostile_retreat_completed": {
          "template": "[PLACEHOLDER] Retreat complete: {army_name} reaches {settlement_name} with {attacker_units_remaining} fighters fit for duty.",
          "tokens": [
            "army_name",
            "settlement_name",
            "attacker_units_remaining"
          ]
        },
        "event.world.hostile_retreat_in_motion": {
          "template": "[PLACEHOLDER] Survivors of {army_name} are in retreat formation; rear guard buys distance.",
          "tokens": [
            "army_name"
          ]
        },
        "event.world.hostile_retreat_ordered": {
          "template": "[PLACEHOLDER] Retreat ordered: {army_name} withdraws from {target_tile_label} toward {settlement_name}.",
          "tokens": [
            "army_name",
            "target_tile_label",
            "settlement_name"
          ]
        },
        "event.world.march_returned": {
          "template": "{army_name} returns to {settlement_name}; tally survivors and prepare the next war order.",
          "tokens": [
            "army_name",
            "settlement_name"
          ]
        },
        "event.world.march_started": {
          "template": "{army_name} crosses killing ground toward {target_tile_label}. ETA {eta_seconds}s.",
          "tokens": [
            "army_name",
            "target_tile_label",
            "eta_seconds"
          ]
        },
        "event.world.scout_dispatched": {
          "template": "{settlement_name}: scouts ride out toward {target_tile_label}.",
          "tokens": [
            "settlement_name",
            "target_tile_label"
          ]
        },
        "event.world.scout_report_empty": {
          "template": "Scout report from {target_tile_label}: no active host detected. The roads remain quiet for now.",
          "tokens": [
            "target_tile_label"
          ]
        },
        "event.world.scout_report_hostile": {
          "template": "Scout report from {target_tile_label}: hostile movement sighted ({hostile_force_estimate}).",
          "tokens": [
            "target_tile_label",
            "hostile_force_estimate"
          ]
        }
      }
    }
  }
});
