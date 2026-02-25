from __future__ import annotations

import json
import os
import unittest
from pathlib import Path
from typing import Optional


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PROFILE_PATH = ROOT / "tests" / "fixtures" / "rk-m0-0014-progression-profile.json"
PROFILE_ENV = "RK_M0_0014_PROGRESSION_PROFILE"

CORE_RESOURCES = ("food", "wood", "stone", "iron")
ALLOWED_SCOUT_OUTCOMES = {
    "outcome_scout_dispatched",
    "outcome_scout_report_empty",
    "outcome_scout_report_hostile",
}
ALLOWED_SCOUT_CONTENT_KEYS = {
    "event.world.scout_dispatched",
    "event.world.scout_report_empty",
    "event.world.scout_report_hostile",
}
PLAYABLE_BUILDING_FAMILIES = {"economy", "military", "logistics"}
PLAYABLE_UNITS = {"watch_levy", "bow_crew", "trail_scout", "light_raider"}


class RKM0ProgressionSmokeTests(unittest.TestCase):
    def test_smoke_assertions_for_15m_30m_60m_milestones(self) -> None:
        profile = self._load_profile()
        settlement_snapshots = self._normalize_snapshots(profile["settlement_snapshots"])
        scout_snapshots = self._normalize_scout_snapshots(profile["event_scout_snapshots"])
        upgrade_snapshots = self._normalize_upgrade_snapshots(profile.get("building_upgrades", []))
        building_families = self._normalize_building_families(profile.get("buildings", {}))
        unit_completions = self._normalize_unit_completions(profile.get("unit_completions", []))

        row_results: list[tuple[str, list[str]]] = [
            ("15m", self._check_row_15m(settlement_snapshots, scout_snapshots, upgrade_snapshots)),
            ("30m", self._check_row_30m(settlement_snapshots, scout_snapshots, building_families)),
            ("60m", self._check_row_60m(settlement_snapshots, scout_snapshots, unit_completions)),
        ]

        failures: list[str] = []
        for row_label, issues in row_results:
            status = "PASS" if not issues else "FAIL"
            print(f"RK-M0-0014_SMOKE row={row_label} status={status}")
            if issues:
                detail = "; ".join(issues)
                print(f"RK-M0-0014_SMOKE row={row_label} failure: {detail}")
                failures.append(f"{row_label}: {detail}")

        if failures:
            print("RK-M0-0014_SMOKE status=FAIL")
            self.fail("RK-M0-0014 progression smoke failed\n" + "\n".join(failures))

        print("RK-M0-0014_SMOKE status=PASS")

    def _check_row_15m(
        self,
        settlement_snapshots: list[dict],
        scout_snapshots: list[dict],
        upgrade_snapshots: list[dict],
    ) -> list[str]:
        issues: list[str] = []
        window = self._up_to_time(settlement_snapshots, 15)
        issues.extend(self._check_resource_bounds(window, min_value=0, cap_inclusive=True))
        below10_counts = self._count_resources_below_threshold(window, 10)
        max_below10 = max(below10_counts.values(), default=0)
        if max_below10 > 1:
            issues.append("15m row has >1 resource below 10 in sampled points")

        first_l2 = self._first_l2_upgrade_time(upgrade_snapshots)
        if first_l2 is None:
            issues.append("no building upgrade to level 2 was found")
        elif first_l2 > 15:
            issues.append(f"first level-2 upgrade completed at {first_l2}m (>15m)")

        playable_15m = [
            upgrade
            for upgrade in upgrade_snapshots
            if upgrade.get("to_level") == 2
            and upgrade.get("time_minutes", 9999) <= 15
            and (upgrade.get("playable_family") in PLAYABLE_BUILDING_FAMILIES)
        ]
        if not playable_15m:
            issues.append("first L2 upgrade before 15m is not in a playable family")

        scouts = self._scout_events_in_window(scout_snapshots, 15)
        if len(scouts) < 1:
            issues.append("no valid scout interaction snapshot by 15m")

        return issues

    def _check_row_30m(
        self,
        settlement_snapshots: list[dict],
        scout_snapshots: list[dict],
        building_families: dict[str, str],
    ) -> list[str]:
        issues: list[str] = []
        window = self._up_to_time(settlement_snapshots, 30)
        issues.extend(self._check_resource_bounds(window, min_value=10, cap_inclusive=True))
        below10_counts = self._count_resources_below_threshold(window, 10)
        max_below10 = max(below10_counts.values(), default=0)
        if max_below10 >= 3:
            issues.append(">=3 core resources were below 10 in the sampled 30m window")

        positives = self._resources_with_non_negative_5m_deltas(window)
        if len(positives) < 2:
            issues.append("fewer than two resources had non-negative 5m rolling delta")

        snapshot_30 = self._snapshot_at_or_after(settlement_snapshots, 30)
        if snapshot_30 is None:
            issues.append("no settlement snapshot found for >=30m window")
        else:
            buildings = snapshot_30["buildings"]
            economy_l2 = 0
            logistics_or_military_l1 = 0
            for building_id, level in self._building_levels(snapshot_30).items():
                family = building_families.get(building_id)
                if family == "economy" and level >= 2:
                    economy_l2 += 1
                if family in {"logistics", "military"} and level >= 1:
                    logistics_or_military_l1 += 1

            if not (economy_l2 >= 2 or (economy_l2 >= 1 and logistics_or_military_l1 >= 1)):
                issues.append(
                    "30m row does not satisfy economy/military/logistics upgrade mix: "
                    "expected at least two economy L2 or one economy L2 plus one logistics/military L1"
                )

        scouts = self._scout_events_in_window(scout_snapshots, 30)
        if len(scouts) < 2:
            issues.append("fewer than two valid scout interactions by 30m")

        return issues

    def _check_row_60m(
        self,
        settlement_snapshots: list[dict],
        scout_snapshots: list[dict],
        unit_completions: list[dict],
    ) -> list[str]:
        issues: list[str] = []
        window = self._up_to_time(settlement_snapshots, 60)
        issues.extend(self._check_resource_bounds(window, min_value=0, cap_inclusive=False))

        snapshot_60 = self._snapshot_at_or_after(settlement_snapshots, 60)
        if snapshot_60 is None:
            issues.append("no settlement snapshot found for >=60m window")
            return issues

        above_20_count = self._count_resources_above(snapshot_60, 20)
        if above_20_count < 2:
            issues.append(f"snapshot at >=60m has only {above_20_count} resources above 20")

        barracks_level = snapshot_60["buildings"].get("barracks", {}).get("level", 0)
        final_stage = bool(snapshot_60["buildings"].get("barracks", {}).get("final_production_stage", False))
        if barracks_level < 1 and not final_stage:
            issues.append("60m row missing barracks completion or final production stage")

        unit_times = [
            record["time_minutes"]
            for record in unit_completions
            if record.get("unit_id") in PLAYABLE_UNITS and record["time_minutes"] <= 60
        ]
        if not unit_times:
            issues.append("no playable-unit completion by <=60m")

        scouts = self._scout_events_in_window(scout_snapshots, 60)
        if not scouts:
            issues.append("no valid scout event persisted by 60m")

        return issues

    def _load_profile(self) -> dict:
        path = Path(os.environ.get(PROFILE_ENV, str(DEFAULT_PROFILE_PATH)))
        self.assertTrue(path.exists(), f"progression profile not found: {path}")
        data = json.loads(path.read_text(encoding="utf-8"))
        self.assertIsInstance(data, dict)
        self.assertIn("settlement_snapshots", data)
        self.assertIn("event_scout_snapshots", data)
        return data

    @staticmethod
    def _normalize_snapshots(raw_snapshots: list[dict]) -> list[dict]:
        snapshots = []
        for snapshot in raw_snapshots:
            snaps = {
                "time_minutes": int(snapshot["time_minutes"]),
                "resources": snapshot["resources"],
                "buildings": snapshot["buildings"],
            }
            snapshots.append(snaps)
        snapshots.sort(key=lambda item: item["time_minutes"])
        return snapshots

    @staticmethod
    def _normalize_scout_snapshots(raw_snapshots: list[dict]) -> list[dict]:
        snapshots = []
        for snapshot in raw_snapshots:
            snap = {
                "time_minutes": int(snapshot["time_minutes"]),
                "interaction_outcome": snapshot["interaction_outcome"],
                "event": snapshot.get("event") or {},
            }
            snapshots.append(snap)
        snapshots.sort(key=lambda item: item["time_minutes"])
        return snapshots

    @staticmethod
    def _normalize_upgrade_snapshots(raw_snapshots: list[dict]) -> list[dict]:
        snapshots = []
        for snapshot in raw_snapshots:
            snaps = {
                "time_minutes": int(snapshot["time_minutes"]),
                "building_id": str(snapshot["building_id"]),
                "to_level": int(snapshot["to_level"]),
                "playable_family": str(snapshot.get("playable_family", "")) if snapshot.get("playable_family") else "",
            }
            snapshots.append(snaps)
        snapshots.sort(key=lambda item: item["time_minutes"])
        return snapshots

    @staticmethod
    def _normalize_building_families(raw_buildings: dict) -> dict[str, str]:
        families: dict[str, str] = {}
        for building_id, value in raw_buildings.items():
            if isinstance(value, dict):
                family = value.get("family")
                if isinstance(family, str):
                    families[building_id] = family
        return families

    @staticmethod
    def _normalize_unit_completions(raw_completions: list[dict]) -> list[dict]:
        completions = []
        for completion in raw_completions:
            snap = {
                "time_minutes": int(completion["time_minutes"]),
                "unit_id": str(completion["unit_id"]),
            }
            completions.append(snap)
        completions.sort(key=lambda item: item["time_minutes"])
        return completions

    def _check_resource_bounds(self, snapshots: list[dict], *, min_value: int, cap_inclusive: bool) -> list[str]:
        issues: list[str] = []
        for snapshot in snapshots:
            for resource_id in CORE_RESOURCES:
                resource = snapshot["resources"].get(resource_id)
                if not isinstance(resource, dict):
                    issues.append(
                        f"time {snapshot['time_minutes']}m missing resource block for {resource_id}"
                    )
                    continue
                amount = resource.get("amount")
                cap = resource.get("base_storage_cap")
                if not isinstance(amount, (int, float)) or not isinstance(cap, (int, float)):
                    issues.append(
                        f"time {snapshot['time_minutes']}m resource '{resource_id}' missing numeric amount/cap"
                    )
                    continue
                if amount < min_value:
                    issues.append(f"time {snapshot['time_minutes']}m {resource_id} below min ({amount} < {min_value})")
                if cap_inclusive:
                    if amount > cap:
                        issues.append(
                            f"time {snapshot['time_minutes']}m {resource_id} above cap ({amount} > {cap})"
                        )
                elif amount >= cap:
                    issues.append(
                        f"time {snapshot['time_minutes']}m {resource_id} at/above hard cap ({amount} >= {cap})"
                    )
        return issues

    @staticmethod
    def _count_resources_below_threshold(snapshots: list[dict], threshold: int) -> dict[str, int]:
        below: dict[str, int] = {resource_id: 0 for resource_id in CORE_RESOURCES}
        for snapshot in snapshots:
            for resource_id in CORE_RESOURCES:
                amount = snapshot["resources"].get(resource_id, {}).get("amount", 0)
                if isinstance(amount, (int, float)) and amount < threshold:
                    below[resource_id] += 1
        return below

    @staticmethod
    def _count_resources_above(snapshot: dict, threshold: int) -> int:
        resources = snapshot.get("resources", {})
        return sum(
            1
            for resource_id in CORE_RESOURCES
            if isinstance(resources.get(resource_id, {}).get("amount"), (int, float))
            and resources[resource_id]["amount"] > threshold
        )

    @staticmethod
    def _resources_with_non_negative_5m_deltas(snapshots: list[dict]) -> set[str]:
        if len(snapshots) < 2:
            return set()

        non_negative: set[str] = set()
        for idx in range(len(snapshots) - 1):
            current = snapshots[idx]
            nxt = snapshots[idx + 1]
            delta = nxt["time_minutes"] - current["time_minutes"]
            if delta != 5:
                continue
            for resource_id in CORE_RESOURCES:
                current_value = current["resources"].get(resource_id, {}).get("amount")
                next_value = nxt["resources"].get(resource_id, {}).get("amount")
                if not isinstance(current_value, (int, float)) or not isinstance(next_value, (int, float)):
                    continue
                if next_value - current_value >= 0:
                    non_negative.add(resource_id)
        return non_negative

    @staticmethod
    def _first_l2_upgrade_time(upgrade_snapshots: list[dict]) -> Optional[int]:
        first_l2_snapshots = [snapshot for snapshot in upgrade_snapshots if snapshot.get("to_level", 0) >= 2]
        if not first_l2_snapshots:
            return None
        return int(first_l2_snapshots[0]["time_minutes"])

    @staticmethod
    def _up_to_time(snapshots: list[dict], max_time: int) -> list[dict]:
        return [snapshot for snapshot in snapshots if snapshot["time_minutes"] <= max_time]

    @staticmethod
    def _snapshot_at_or_after(snapshots: list[dict], min_time: int) -> Optional[dict]:
        for snapshot in snapshots:
            if snapshot["time_minutes"] >= min_time:
                return snapshot
        return None

    @staticmethod
    def _scout_events_in_window(scout_snapshots: list[dict], max_time: int) -> list[dict]:
        valid = []
        for snapshot in scout_snapshots:
            if snapshot["time_minutes"] > max_time:
                continue
            if snapshot.get("interaction_outcome") not in ALLOWED_SCOUT_OUTCOMES:
                continue
            event = snapshot.get("event") or {}
            if not isinstance(event, dict):
                continue
            if event.get("content_key") not in ALLOWED_SCOUT_CONTENT_KEYS:
                continue
            valid.append(snapshot)
        return valid

    @staticmethod
    def _building_levels(snapshot: dict) -> dict[str, int]:
        levels: dict[str, int] = {}
        for building_id, value in snapshot.get("buildings", {}).items():
            if isinstance(value, dict):
                level = value.get("level", 0)
                if isinstance(level, int):
                    levels[building_id] = level
        return levels


if __name__ == "__main__":
    unittest.main()
