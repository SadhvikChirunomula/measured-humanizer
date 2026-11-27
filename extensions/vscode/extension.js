/**
 * Measured Humanizer - VS Code / Cursor Extension
 * Real-time inline style linting and quick-fix surgical repair for Markdown documents.
 */

const path = require("path");

function getGate() {
  const gatePath = path.join(__dirname, "..", "..", "skills", "measured-humanizer", "gate", "style_gate.js");
  return require(gatePath);
}

function getProfiles() {
  const profilePath = path.join(__dirname, "..", "..", "lib", "profiles.js");
  return require(profilePath);
}

function activate(context) {
  let vscode;
  try {
    vscode = require("vscode");
  } catch (e) {
    // Allows testing outside VS Code runtime
    return { isMock: true };
  }

  const { gate } = getGate();
  const { resolveProfile } = getProfiles();

  const diagnosticCollection = vscode.languages.createDiagnosticCollection("measured-humanizer");
  context.subscriptions.push(diagnosticCollection);

  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = "measuredHumanizer.evaluateDocument";
  context.subscriptions.push(statusBarItem);

  function lintDocument(document) {
    if (document.languageId !== "markdown") return;

    const config = vscode.workspace.getConfiguration("measuredHumanizer");
    if (!config.get("liveDiagnostics", true)) {
      diagnosticCollection.delete(document.uri);
      statusBarItem.hide();
      return;
    }

    const profileName = config.get("profile", "engineering");
    const thresholds = resolveProfile(profileName);
    const text = document.getText();

    const verdict = gate(text, thresholds, null, { zoning: true });
    const diagnostics = [];

    if (!verdict.pass) {
      statusBarItem.text = `$(warning) Humanizer: ${(verdict.composite * 100).toFixed(0)}% (Failing)`;
      statusBarItem.tooltip = `Profile: ${profileName} | Worst: ${verdict.worst ? verdict.worst.dimension : "Multiple defects"}`;
      statusBarItem.show();

      for (const failure of verdict.failures) {
        // Map failure to document lines
        const lineCount = document.lineCount;
        let startLine = 0;
        let endLine = Math.min(lineCount - 1, 5);

        // Highlight full text or target section
        const range = new vscode.Range(new vscode.Position(startLine, 0), new vscode.Position(endLine, 80));
        const severity = failure.severity >= 9 
          ? vscode.DiagnosticSeverity.Error 
          : vscode.DiagnosticSeverity.Warning;

        const diag = new vscode.Diagnostic(
          range,
          `[Measured Humanizer: ${failure.dimension}] ${failure.instruction}`,
          severity
        );
        diag.source = "measured-humanizer";
        diag.code = failure.dimension;
        diagnostics.push(diag);
      }
    } else {
      statusBarItem.text = `$(check) Humanizer: ${(verdict.composite * 100).toFixed(0)}% (Passing)`;
      statusBarItem.tooltip = `Verified Human-Grade Prose under profile '${profileName}'`;
      statusBarItem.show();
    }

    diagnosticCollection.set(document.uri, diagnostics);
  }

  // Register Code Actions (Quick Fix)
  const codeActionProvider = {
    provideCodeActions(document, range, context) {
      const actions = [];
      for (const diag of context.diagnostics) {
        if (diag.source === "measured-humanizer") {
          const action = new vscode.CodeAction(
            `Fix ${diag.code} with Measured Humanizer`,
            vscode.CodeActionKind.QuickFix
          );
          action.command = {
            command: "measuredHumanizer.humanizeParagraph",
            title: "Humanize Paragraph",
            arguments: [document, range],
          };
          actions.push(action);
        }
      }
      return actions;
    },
  };

  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider("markdown", codeActionProvider, {
      providedCodeActionKinds: [vscode.CodeActionKind.QuickFix],
    })
  );

  // Event Listeners
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(lintDocument),
    vscode.workspace.onDidSaveTextDocument(lintDocument),
    vscode.workspace.onDidChangeTextDocument(event => lintDocument(event.document))
  );

  // Lint active editor on activation
  if (vscode.window.activeTextEditor) {
    lintDocument(vscode.window.activeTextEditor.document);
  }

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand("measuredHumanizer.evaluateDocument", () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) lintDocument(editor.document);
    }),
    vscode.commands.registerCommand("measuredHumanizer.setProfile", async () => {
      const choice = await vscode.window.showQuickPick(
        ["engineering", "executive", "marketing", "academic"],
        { placeHolder: "Select adaptive domain profile" }
      );
      if (choice) {
        const config = vscode.workspace.getConfiguration("measuredHumanizer");
        await config.update("profile", choice, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`Measured Humanizer profile set to '${choice}'`);
        if (vscode.window.activeTextEditor) {
          lintDocument(vscode.window.activeTextEditor.document);
        }
      }
    })
  );
}

function deactivate() {}

module.exports = { activate, deactivate, getGate, getProfiles };
