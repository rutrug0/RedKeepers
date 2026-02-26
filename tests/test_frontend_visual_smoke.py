from __future__ import annotations

import sys
import unittest
from pathlib import Path


TOOLS_DIR = Path(__file__).resolve().parents[1] / "tools"
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

import frontend_visual_smoke as smoke  # noqa: E402


class FrontendVisualSmokeHelperTests(unittest.TestCase):
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

    def test_first_slice_action_feedback_paths_cover_build_train_scout_success_and_failure(self) -> None:
        paths = smoke._required_action_feedback_paths("first-slice-shell")
        self.assertEqual(len(paths), 6)
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
            },
        )

    def test_non_shell_surface_has_no_action_feedback_paths(self) -> None:
        self.assertEqual(smoke._required_action_feedback_paths("hero-wireframes"), [])


if __name__ == "__main__":
    unittest.main()
