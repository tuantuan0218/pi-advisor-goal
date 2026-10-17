/**
 * Shared mode/model resolution utilities.
 *
 * Used by handoff and subagent to resolve -mode and -model parameters
 * against modes.json.
 */

import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";

export type ModeSpec = {
	provider?: string;
	modelId?: string;
	thinkingLevel?: string;
	/** 上游降级链：主模型挂了按顺序换，每项 {provider, modelId}。跨上游设计（不同 key/域名）。 */
	fallbackModels?: Array<{ provider: string; modelId: string }>;
};

/**
 * Load a mode spec from modes.json by name.
 * Checks project-level .pi/modes.json first, then global ~/.pi/agent/modes.json.
 * Returns the spec if found, or undefined.
 */
export async function loadModeSpec(
	cwd: string,
	modeName: string,
): Promise<ModeSpec | undefined> {
	const expandUser = (p: string) => {
		if (p === "~") return os.homedir();
		if (p.startsWith("~/")) return path.join(os.homedir(), p.slice(2));
		return p;
	};

	const agentDir = process.env.PI_CODING_AGENT_DIR
		? expandUser(process.env.PI_CODING_AGENT_DIR)
		: path.join(os.homedir(), ".pi", "agent");

	const candidates = [
		path.join(cwd, ".pi", "modes.json"),
		path.join(agentDir, "modes.json"),
	];

	for (const modesPath of candidates) {
		try {
			const raw = fs.readFileSync(modesPath, "utf8");
			const parsed = JSON.parse(raw);
			if (parsed.modes && typeof parsed.modes === "object" && parsed.modes[modeName]) {
				const spec = parsed.modes[modeName];
				const fallbackModels = Array.isArray(spec.fallbackModels)
					? spec.fallbackModels
							.filter(
								(f: any) =>
									f && typeof f.provider === "string" && typeof f.modelId === "string",
							)
							.map((f: any) => ({ provider: f.provider, modelId: f.modelId }))
					: undefined;
				return {
					provider: typeof spec.provider === "string" ? spec.provider : undefined,
					modelId: typeof spec.modelId === "string" ? spec.modelId : undefined,
					thinkingLevel: typeof spec.thinkingLevel === "string" ? spec.thinkingLevel : undefined,
					fallbackModels: fallbackModels && fallbackModels.length ? fallbackModels : undefined,
				};
			}
		} catch {
			continue;
		}
	}
	return undefined;
}

/**
 * Resolve a target model and thinking level from mode/model parameters.
 * Returns the resolved model and thinking level, using defaults from the
 * current context if not overridden.
 */
export async function resolveModelAndThinking(
	cwd: string,
	modelRegistry: any,
	currentModel: any,
	currentThinkingLevel: string,
	params: { mode?: string; model?: string },
): Promise<{ model: any; thinkingLevel: string }> {
	let targetModel = currentModel;
	let targetThinkingLevel = currentThinkingLevel;

	if (params.mode) {
		const spec = await loadModeSpec(cwd, params.mode);
		if (spec) {
			if (spec.provider && spec.modelId) {
				const m = modelRegistry.find(spec.provider, spec.modelId);
				if (m) targetModel = m;
			}
			if (spec.thinkingLevel) targetThinkingLevel = spec.thinkingLevel;
		}
	}

	if (params.model) {
		const slashIdx = params.model.indexOf("/");
		if (slashIdx > 0) {
			const m = modelRegistry.find(
				params.model.slice(0, slashIdx),
				params.model.slice(slashIdx + 1),
			);
			if (m) targetModel = m;
		}
	}

	return { model: targetModel, thinkingLevel: targetThinkingLevel };
}
