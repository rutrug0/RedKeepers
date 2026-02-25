from __future__ import annotations

import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class BackendScaffoldSmokeTests(unittest.TestCase):
    def test_backend_scaffold_paths_exist(self) -> None:
        expected_paths = [
            ROOT / "backend" / "README.md",
            ROOT / "backend" / "src" / "app" / "index.ts",
            ROOT / "backend" / "src" / "app" / "composition.ts",
            ROOT / "backend" / "src" / "modules" / "README.md",
            ROOT / "backend" / "src" / "shared" / "index.ts",
            ROOT / "backend" / "src" / "app" / "config" / "seeds",
        ]

        for path in expected_paths:
            with self.subTest(path=str(path.relative_to(ROOT))):
                self.assertTrue(path.exists(), f"missing backend scaffold artifact: {path}")

    def test_core_backend_module_layout_matches_m1_scaffold(self) -> None:
        expected_modules = [
            "economy",
            "buildings",
            "units",
            "settlement",
            "world_map",
            "events",
        ]
        expected_subdirs = ["api", "application", "domain", "infra", "ports"]

        modules_root = ROOT / "backend" / "src" / "modules"
        for module_name in expected_modules:
            module_root = modules_root / module_name
            with self.subTest(module=module_name):
                self.assertTrue(module_root.is_dir(), f"missing module dir: {module_root}")
                self.assertTrue((module_root / "README.md").is_file())
                for subdir in expected_subdirs:
                    self.assertTrue(
                        (module_root / subdir).is_dir(),
                        f"missing module scaffold subdir: {module_root / subdir}",
                    )


class ClientShellSmokeTests(unittest.TestCase):
    def test_client_shell_artifacts_exist(self) -> None:
        for rel_path in [
            Path("client-web/index.html"),
            Path("client-web/styles.css"),
            Path("client-web/app.js"),
        ]:
            with self.subTest(path=str(rel_path)):
                self.assertTrue((ROOT / rel_path).is_file(), f"missing client artifact: {rel_path}")

    def test_client_shell_wireframe_regions_and_placeholder_markers_exist(self) -> None:
        html = (ROOT / "client-web" / "index.html").read_text(encoding="utf-8")

        required_markers = [
            "<title>RedKeepers Client Shell Wireframe</title>",
            'id="settlement-panel"',
            'id="worldmap-panel"',
            'id="event-feed-panel"',
            'class="resource-grid"',
            'class="map-stage"',
            'class="event-list"',
            "Placeholder",
            "Wireframe",
        ]

        for marker in required_markers:
            with self.subTest(marker=marker):
                self.assertIn(marker, html)

    def test_client_shell_responsive_and_nav_behavior_markers_exist(self) -> None:
        css = (ROOT / "client-web" / "styles.css").read_text(encoding="utf-8")
        js = (ROOT / "client-web" / "app.js").read_text(encoding="utf-8")

        for marker in [
            "@media (max-width: 1220px)",
            "@media (max-width: 860px)",
            "@media (prefers-reduced-motion: reduce)",
            ".app-grid",
            ".region-nav__group",
        ]:
            with self.subTest(css_marker=marker):
                self.assertIn(marker, css)

        for marker in [
            'document.querySelectorAll(".region-tab")',
            "IntersectionObserver",
            "aria-selected",
            "scrollIntoView",
        ]:
            with self.subTest(js_marker=marker):
                self.assertIn(marker, js)


class StarterDesignDataSmokeTests(unittest.TestCase):
    def test_starter_data_tables_document_contains_core_sections_and_status_conventions(self) -> None:
        doc_path = ROOT / "docs" / "design" / "v1-starter-data-tables.md"
        self.assertTrue(doc_path.is_file(), f"missing design data artifact: {doc_path}")
        text = doc_path.read_text(encoding="utf-8")

        required_sections = [
            "# V1 Starter Economy, Building, and Unit Data Tables",
            "## Scope and Data Conventions",
            "## Field Annotations (Module Ownership + Frontend Needs)",
            "### Resource Table Fields (`economy`)",
            "### Building Tables Fields (`buildings`)",
            "### Unit Tables Fields (`units`)",
            "## Starter Resource Set (`economy.resource_definitions`)",
            "## Starter Building Lines (`buildings.building_lines`)",
            "## Baseline Starter Unit Roster (`units.unit_lines`)",
            "## Civilization Activation and Slice Status (`economy/buildings/units`)",
            "## Implementation Notes (M1-safe)",
        ]

        for section in required_sections:
            with self.subTest(section=section):
                self.assertIn(section, text)

        for token in [
            "slice_status",
            "playable_now",
            "balance_stub",
            "data_stub_post_slice",
            "| resource_id |",
            "| building_id |",
            "| unit_id |",
        ]:
            with self.subTest(token=token):
                self.assertIn(token, text)


if __name__ == "__main__":
    unittest.main()
