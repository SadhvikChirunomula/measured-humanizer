# Contributing to Measured Humanizer

Thank you for your interest in contributing to Measured Humanizer! We welcome bug reports, feature enhancements, documentation improvements, and statistical calibration feedback.

## Ground Rules & Philosophy

Measured Humanizer is built on empirical, structural measurement rather than subjective style guides or arbitrary word bans:
1. **Evidence-driven changes**: Any changes or additions to metrics, thresholds, or heuristics must be accompanied by empirical justification or test data.
2. **Zero external runtime dependencies**: The core scoring gate (`skills/measured-humanizer/gate/style_gate.js`) must remain dependency-free and runnable under standard Node.js (14+).
3. **Deterministic scoring**: Scorer outputs must remain reproducible and deterministic across repeated runs on the same input.

## Getting Started

### Local Setup
1. Fork and clone the repository:
   ```bash
   git clone https://github.com/SadhvikChirunomula/measured-humanizer.git
   cd measured-humanizer
   ```
2. Verify that Node.js (version 14 or higher) and bash are available on your system.
3. Run the automated test suite to ensure everything passes:
   ```bash
   npm test
   ```

### Project Structure
- `lib/`: Autonomous multi-agent orchestrator, AST integrity interlock, profiles, and local patch engines.
- `profiles/`: Calibrated domain configurations (`engineering`, `executive`, `marketing`, `academic`).
- `skills/measured-humanizer/gate/style_gate.js`: Core scoring engine and CLI entry point.
- `skills/measured-humanizer/gate/thresholds.json`: Default baseline calibrated thresholds.
- `skills/measured-humanizer/reference/`: Derivation notes and calibration methodology.
- `tests/`: Comprehensive verification suites, fixtures, and adversarial stress tests.

## How to Contribute

### Reporting Issues
- Check existing issues before opening a new one to avoid duplicates.
- Use our [Issue Templates](https://github.com/SadhvikChirunomula/measured-humanizer/issues/new/choose) to report bugs or propose enhancements.
- When filing a bug report, include the draft text or minimal reproducible snippet, the command executed, the expected behavior, and the actual output.

### Improving Calibration or Proposing New Metrics
If you want to propose or adjust metrics:
- Provide sample documents or corpus statistics illustrating the separation power (e.g., AUC or distribution spread).
- Ensure new dimensions do not penalize valid code blocks, math formulas, or technical citations.

### Submitting a Pull Request
1. Create a descriptive feature branch from `main`:
   ```bash
   git checkout -b feature/my-enhancement
   ```
2. Make your edits cleanly and adhere to existing coding conventions.
3. Add or update tests under `tests/` where applicable.
4. Run the test suite:
   ```bash
   npm test
   ```
5. Commit your changes with clear, descriptive commit messages.
6. Push your branch to your fork and submit a Pull Request targeting `main`.
7. Fill out the Pull Request template completely so reviewers can evaluate your work efficiently.

## Code Style
- Keep Node.js code vanilla, clean, and well-structured.
- Preserve comments explaining mathematical derivations or scoring constants.
- Follow Unix line-endings (`LF`) and standard indentation.

Thank you for helping keep technical writing genuine and measurable!
