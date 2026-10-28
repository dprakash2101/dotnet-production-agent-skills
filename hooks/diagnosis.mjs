// Pure, dependency-free diagnosis. Inputs are evidence, never executable code.
// Messages deliberately avoid echoing commands, paths, output, or credentials.
const LIMIT = 32_768;
const text = value => typeof value === "string" ? value.slice(0, LIMIT) : "";

const advice = {
  success: ["verify-result", "The command reported exit code 0. Verify the requested result; do not rerun it because of a displayed control marker."],
  "transport-corruption": ["use-structured-runner", "Execution evidence differs from the submitted command in a known corruption pattern. Do not retry through the same interactive terminal path. Use the run_process MCP tool with an explicit executable, arguments, and verified project directory to avoid interactive transport. Preserve the intended operation and verify possible prior side effects before rerunning it."],
  "suspected-transport-corruption": ["use-structured-runner", "The shell error names a corrupted form of the clean submitted executable. Terminal transport corruption is suspected, not proven. Do not retry through the same interactive terminal path. Use the run_process MCP tool with an explicit executable, arguments, and verified project directory to avoid interactive transport, then inspect its result. Verify possible prior side effects before repeating the operation."],
  "wrong-directory": ["verify-project-directory", "Directory evidence does not match the requested project operation. Establish the intended workspace or package directory and verify it before retrying. Do not move into an executable installation directory."],
  "executable-unavailable": ["check-executable-resolution", "The shell could not resolve the executable. Use read-only executable lookup in the same failing environment. Do not guess binary paths, change PATH, or install software without evidence."],
  "shell-syntax": ["inspect-shell-syntax", "The submitted command or reported parser error indicates incompatible command syntax. Establish the actual shell, preserve the requested arguments, and correct only the supported syntax error."],
  "application-failure": ["inspect-application-error", "The intended tool reported an application error. Investigate the first actionable build, test, dependency, authentication, or service error. Do not treat a displayed control marker as proof of an executable-resolution problem."],
  "uncertain-completion": ["verify-completion", "Command completion is uncertain. Check process status, exit evidence, and the intended result before repeating an operation that may already have had side effects."],
  unknown: ["collect-execution-evidence", "Insufficient evidence to select a correction. Inspect the actual shell, working directory, executable, exit status, and first actionable error before retrying."],
};

function result(category, confidence, evidence, retrySafe = false) {
  const [nextAction, message] = advice[category];
  return { category, confidence, evidence, nextAction, message, retrySafe };
}

/** Diagnose a terminal result without executing commands or changing state.
 * exitCode must be an authoritative numeric process exit code. Displayed text
 * alone never establishes success, process interruption, or transport corruption.
 */
export function diagnose(input = {}) {
  const value = input && typeof input === "object" ? input : {};
  const command = text(value.command);
  const submitted = text(value.submittedCommand) || command;
  const executed = text(value.executedCommand);
  const output = `${text(value.output)}\n${text(value.error)}`;
  const exitCode = Number.isInteger(value.exitCode) ? value.exitCode : undefined;
  const hasError = Boolean(text(value.error).trim());

  if (exitCode === 0) return result("success", "high", ["authoritative-zero-exit"]);

  const unavailable = /command not found|(?:is not recognized as|not recognized as) (?:an? |the )?(?:internal|name)|CommandNotFoundException|(?:^|\n)[^\n]*:\s*not found\b/i.test(output);
  if (/not a git repository|MSB1003|(?:could not|cannot|couldn't) (?:read|find|locate)[^\n]*package\.json|ENOENT[^\n]*package\.json|(?:working|starting) directory[^\n]*(?:does not exist|not found)|Set-Location[^\n]*(?:cannot find|does not exist)|cd:[^\n]*(?:no such file|not a directory)/i.test(output)) {
    return result("wrong-directory", "high", ["project-directory-error"]);
  }
  const appError = /\b(?:MSB\d{4}|CS\d{4}|NU\d{4}|npm (?:ERR!|error)|ERR_PNPM_[A-Z_]+|ModuleNotFoundError|ImportError|SyntaxError:|AssertionError|Traceback \(most recent call last\)|FAILED\s+[^\n]*::|error TS\d+|Cannot connect to the Docker daemon|Error response from daemon|fatal: Authentication failed|fatal: unable to access|BUILD FAILED|Tests? failed)(?![a-z0-9_])/i.test(output);
  // A diagnostic from a running tool outweighs a cosmetic marker in output.
  if (appError) return result("application-failure", "high", ["tool-specific-error"]);

  const cleanExecuted = executed.trim().replace(/^(?:\^U|\u0015)\s*/, "");
  const knownMismatch = submitted && executed && submitted.trim() !== executed.trim()
    && (cleanExecuted === submitted.trim()
      || (submitted.trim().length > 2 && executed.trim() === submitted.trim().slice(1)));
  if (knownMismatch && unavailable) {
    return result("transport-corruption", "high", ["submitted-executed-mismatch", "shell-executable-resolution-error"]);
  }

  // Native hooks may not expose the executed command. A shell lookup error
  // naming the submitted executable with a known mutation is useful but weaker
  // evidence: it cannot establish where that mutation was introduced.
  const submittedExecutable = /^([a-zA-Z][\w.-]*)(?:\s|$)/.exec(submitted.trim())?.[1];
  if (submittedExecutable && unavailable) {
    const errorTokens = [
      ...output.matchAll(/(?:^|\n)\s*(?:(?:-?bash|sh):\s*)?([^\s:]+)\s*:\s*(?:command not found|not found)(?:\s|$)/gi),
      ...output.matchAll(/(?:^|\n)\s*zsh:\s*command not found:\s*([^\s]+)(?:\s|$)/gi),
      ...output.matchAll(/(?:^|\n)[^\n]*?The term ['"]([^'"\n]+)['"] is not recognized/gi),
      ...output.matchAll(/(?:^|\n)\s*['"]([^'"\n]+)['"] is not recognized as/gi),
    ].map(match => match[1]);
    const corrupted = errorTokens.some(token => token === `^U${submittedExecutable}` || token === `\u0015${submittedExecutable}`
      || (submittedExecutable.length > 2 && token === submittedExecutable.slice(1)));
    if (corrupted) return result("suspected-transport-corruption", "medium", ["submitted-executable-clean", "shell-error-names-corrupted-executable"]);
  }

  if (/^(?:\^U|\u0015)\s*\S/.test(command.trim())) {
    return result("shell-syntax", "high", ["submitted-control-prefix"]);
  }
  if (unavailable) return result("executable-unavailable", "high", ["shell-executable-resolution-error"]);
  if (/ParserError|Unexpected token[^\n]*(?:expression|statement)|syntax error near unexpected token|unexpected EOF while looking for matching|The token ['"]?&&['"]? is not a valid statement separator|Missing closing ['"\])}]/i.test(output)) {
    return result("shell-syntax", "high", ["shell-parser-error"]);
  }
  if (/timed? out|timeout|(?:process|command|execution)[^\n]*(?:cancelled|canceled|interrupted)|SIGINT|SIGTERM|still running|terminal[^\n]*(?:disconnected|closed)|no exit (?:code|status)/i.test(output) || (executed && submitted && executed.trim() !== submitted.trim())) {
    return result("uncertain-completion", "medium", ["completion-or-command-identity-unverified"]);
  }
  if (exitCode !== undefined && exitCode !== 0) return result("application-failure", "medium", ["authoritative-nonzero-exit"]);
  if (hasError) return result("unknown", "low", ["unclassified-tool-error"]);
  return result("unknown", "low", ["insufficient-execution-evidence"]);
}
