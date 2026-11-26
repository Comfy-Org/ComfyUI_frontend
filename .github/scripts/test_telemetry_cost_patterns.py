from pathlib import Path
import re
import unittest


WORKFLOW = Path(__file__).parents[1] / "workflows" / "telemetry-cost-contract-validate.yml"


def load_patterns() -> list[re.Pattern[str]]:
    lines = WORKFLOW.read_text().splitlines()
    start = lines.index("      patterns: |") + 1
    raw_patterns = []
    for line in lines[start:]:
        if line and not line.startswith("        "):
            break
        if line.strip():
            raw_patterns.append(line.strip())
    return [re.compile(pattern) for pattern in raw_patterns]


class TelemetryCostPatternsTest(unittest.TestCase):
    def test_supported_telemetry_calls_are_detected(self) -> None:
        patterns = load_patterns()
        calls = [
            "reportError(error)",
            "useTelemetry()?.trackUiButtonClicked(metadata)",
            "telemetry?.trackUiButtonClicked(metadata)",
            "datadogRum?.addAction('clicked')",
            "getDatadogRum().addTiming('ready')",
            "posthog.capture('opened')",
            "mixpanel?.track('opened')",
            "analytics.track('opened')",
            "window.__comfyDesktop2?.Telemetry?.capture('opened')",
        ]

        self.assertEqual(
            [any(pattern.search(call) for pattern in patterns) for call in calls],
            [True] * len(calls),
        )

    def test_unrelated_calls_are_not_detected(self) -> None:
        patterns = load_patterns()

        self.assertFalse(any(pattern.search("console.info('ready')") for pattern in patterns))


if __name__ == "__main__":
    unittest.main()
