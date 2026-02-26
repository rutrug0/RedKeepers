from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest import mock


TOOLS_DIR = Path(__file__).resolve().parents[1] / "tools"
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

import frontend_visual_smoke as smoke  # noqa: E402


class _FakeLocator:
    def __init__(self, count: int) -> None:
        self._count = count

    def count(self) -> int:
        return self._count


class _FakeKeyboard:
    def __init__(self) -> None:
        self.presses: list[str] = []

    def press(self, key: str) -> None:
        self.presses.append(key)


class _FakePage:
    def __init__(
        self,
        *,
        region_tab_count: int = 1,
        representative_control_count: int = 1,
        prefers_reduced_motion: bool = True,
        worldmap_selected: bool = True,
        scroll_calls: list[dict[str, str]] | None = None,
    ) -> None:
        self._region_tab_count = region_tab_count
        self._representative_control_count = representative_control_count
        self._prefers_reduced_motion = prefers_reduced_motion
        self._worldmap_selected = worldmap_selected
        self._scroll_calls = scroll_calls if scroll_calls is not None else []
        self.keyboard = _FakeKeyboard()

    def locator(self, selector: str) -> _FakeLocator:
        if selector == ".region-tab":
            return _FakeLocator(self._region_tab_count)
        if selector == ".ghost-btn, .mock-state-btn":
            return _FakeLocator(self._representative_control_count)
        return _FakeLocator(0)

    def evaluate(self, script: str) -> object:
        if "prefers-reduced-motion: reduce" in script:
            return self._prefers_reduced_motion
        if 'data-target="worldmap-panel"' in script:
            return self._worldmap_selected
        if "window.__rkScrollCalls || []" in script:
            return self._scroll_calls
        return None


class FrontendVisualSmokeHelperTests(unittest.TestCase):
    def test_default_devices_include_mobile_390_and_360_profiles(self) -> None:
        with mock.patch.object(sys, "argv", ["frontend_visual_smoke.py"]):
            args = smoke.parse_args()
        self.assertIn("mobile-390", args.devices)
        self.assertIn("mobile-360", args.devices)
        self.assertEqual(smoke.DEVICE_PROFILES["mobile-390"]["viewport"]["width"], 390)
        self.assertEqual(smoke.DEVICE_PROFILES["mobile-360"]["viewport"]["width"], 360)

    def test_shell_surface_container_selector_is_shell(self) -> None:
        self.assertEqual(smoke._surface_container_selector("first-slice-shell"), ".shell")
        self.assertIsNone(smoke._surface_container_selector("hero-wireframes"))

    def test_parse_px_handles_numeric_and_invalid_values(self) -> None:
        self.assertEqual(smoke._parse_px("2px"), 2.0)
        self.assertEqual(smoke._parse_px("0"), 0.0)
        self.assertEqual(smoke._parse_px("not-a-px"), 0.0)

    def test_focus_indicator_visible_with_outline(self) -> None:
        style = {
            "outlineStyle": "solid",
            "outlineWidth": "2px",
            "boxShadow": "none",
        }
        self.assertTrue(smoke._focus_indicator_visible(style))

    def test_focus_indicator_visible_with_box_shadow(self) -> None:
        style = {
            "outlineStyle": "none",
            "outlineWidth": "0px",
            "boxShadow": "rgb(217, 122, 59) 0px 0px 0px 4px",
        }
        self.assertTrue(smoke._focus_indicator_visible(style))

    def test_focus_indicator_not_visible_when_outline_and_shadow_absent(self) -> None:
        style = {
            "outlineStyle": "none",
            "outlineWidth": "0px",
            "boxShadow": "none",
        }
        self.assertFalse(smoke._focus_indicator_visible(style))

    def test_surface_detection_distinguishes_shell_and_hero_wireframes(self) -> None:
        self.assertEqual(smoke._surface_id_from_url("http://127.0.0.1:4173/index.html"), "first-slice-shell")
        self.assertEqual(smoke._surface_id_from_url("http://127.0.0.1:4173/hero-wireframes.html"), "hero-wireframes")

    def test_baseline_path_for_shell_uses_legacy_device_filename(self) -> None:
        baseline_dir = Path("coordination/runtime/frontend-visual/baseline")
        path = smoke._baseline_path_for_device(baseline_dir, "http://127.0.0.1:4173/index.html", "desktop-1440")
        self.assertEqual(path, baseline_dir / "desktop-1440.png")

    def test_baseline_path_for_hero_wireframes_is_page_scoped(self) -> None:
        baseline_dir = Path("coordination/runtime/frontend-visual/baseline")
        path = smoke._baseline_path_for_device(
            baseline_dir,
            "http://127.0.0.1:4173/hero-wireframes.html",
            "desktop-1440",
        )
        self.assertEqual(path, baseline_dir / "hero-wireframes--desktop-1440.png")

    def test_first_slice_action_feedback_paths_cover_build_train_scout_and_hostile_attack(self) -> None:
        paths = smoke._required_action_feedback_paths("first-slice-shell")
        self.assertEqual(len(paths), 7)
        path_ids = {path["path_id"] for path in paths}
        self.assertEqual(
            path_ids,
            {
                "build_success_feedback",
                "build_failure_feedback",
                "train_success_feedback",
                "train_failure_feedback",
                "scout_success_feedback",
                "scout_failure_feedback",
                "hostile_attack_completion_feedback",
            },
        )
        hostile_path = next(path for path in paths if path["path_id"] == "hostile_attack_completion_feedback")
        self.assertEqual(
            hostile_path["pre_click_selector"],
            '[data-worldmap-marker-id="marker_hostile_ruin_holdfast"]',
        )
        self.assertEqual(hostile_path["trigger_selector"], '[data-worldmap-adapter-action="attack"]')
        self.assertEqual(hostile_path["expected_content_key"], "event.combat.placeholder_skirmish_win")

    def test_non_shell_surface_has_no_action_feedback_paths(self) -> None:
        self.assertEqual(smoke._required_action_feedback_paths("hero-wireframes"), [])

    def test_collect_accessibility_issues_reports_missing_region_tabs(self) -> None:
        page = _FakePage(region_tab_count=0)
        issues = smoke._collect_accessibility_issues(page)
        self.assertEqual(issues, ["keyboard navigation check failed: no .region-tab controls found"])

    def test_collect_accessibility_issues_passes_keyboard_focus_and_reduced_motion_checks(self) -> None:
        page = _FakePage(
            scroll_calls=[
                {
                    "targetId": "worldmap-panel",
                    "behavior": "auto",
                }
            ]
        )
        focus_style = {
            "outlineStyle": "solid",
            "outlineWidth": "2px",
            "boxShadow": "none",
        }

        with (
            mock.patch.object(smoke, "_install_scroll_capture", return_value=None),
            mock.patch.object(smoke, "_tab_until_focus", side_effect=[True, True]),
            mock.patch.object(smoke, "_active_focus_style", side_effect=[focus_style, focus_style]),
        ):
            issues = smoke._collect_accessibility_issues(page)

        self.assertEqual(issues, [])
        self.assertEqual(page.keyboard.presses, ["ArrowRight", "Enter"])

    def test_collect_accessibility_issues_fails_when_region_activation_uses_smooth_scroll(self) -> None:
        page = _FakePage(
            scroll_calls=[
                {
                    "targetId": "worldmap-panel",
                    "behavior": "smooth",
                }
            ]
        )
        focus_style = {
            "outlineStyle": "solid",
            "outlineWidth": "2px",
            "boxShadow": "none",
        }

        with (
            mock.patch.object(smoke, "_install_scroll_capture", return_value=None),
            mock.patch.object(smoke, "_tab_until_focus", side_effect=[True, True]),
            mock.patch.object(smoke, "_active_focus_style", side_effect=[focus_style, focus_style]),
        ):
            issues = smoke._collect_accessibility_issues(page)

        self.assertTrue(
            any("reduced-motion check failed: worldmap-panel activation requested smooth scrolling" in issue for issue in issues)
        )


if __name__ == "__main__":
    unittest.main()
