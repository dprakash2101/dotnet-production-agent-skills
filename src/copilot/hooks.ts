/**
 * Future host-specific command enforcement belongs here. Copilot clients differ
 * in hook support and configuration; no hook is installed until a supported
 * format and a safe opt-in policy can be verified.
 */
export interface CommandGuardrailAdapter {
  readonly host: "copilot";
  supportsHooks(): Promise<boolean>;
  install(projectRoot: string, policy: CommandGuardrailPolicy): Promise<void>;
  uninstall(projectRoot: string): Promise<void>;
}

export interface CommandGuardrailPolicy {
  readonly blockForcePush: boolean;
  readonly blockDestructiveGitOperations: boolean;
  readonly protectSensitiveFiles: readonly string[];
}
