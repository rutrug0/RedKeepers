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


if __name__ == "__main__":
    unittest.main()
