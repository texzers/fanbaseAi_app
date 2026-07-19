/**
 * Crowd Service — business logic for crowd data retrieval and AI briefings.
 *
 * Wraps the crowd simulator to provide structured data for API responses.
 * Generates AI operational briefings by injecting simulator data (not user
 * input) into the GenAI prompt, preventing hallucination.
 */

import { CrowdStatusResponse } from '@fanpulse/shared-types';
import { getCrowdState, getCrowdContextForAI } from '../simulator/crowdSimulator.js';
import {
  callClaude,
  buildOperationalBriefingPrompt,
} from '../ai/claudeClient.js';

/**
 * Retrieves the current crowd state and augments it with an AI-generated
 * operational briefing.
 *
 * The AI briefing is generated from the live simulator data — the AI is
 * given real (simulated) numbers, so it cannot hallucinate crowd statistics.
 *
 * @returns Full CrowdStatusResponse including zones, gate readings, and AI briefing
 */
export async function getCurrentCrowdStatus(): Promise<CrowdStatusResponse> {
  const crowdState = getCrowdState();
  const crowdContext = getCrowdContextForAI();

  let operationalBriefing: string;
  try {
    const promptOptions = buildOperationalBriefingPrompt(crowdContext);
    operationalBriefing = await callClaude(promptOptions);
  } catch (error) {
    // Fall back to a structured text briefing if AI call fails
    const congestedZones = crowdState.zones
      .filter((z: any) => z.status === 'congested')
      .map((z: any) => z.zoneName)
      .join(', ');

    operationalBriefing = congestedZones
      ? `Operational briefing unavailable (AI service error). ` +
        `Manual check required for: ${congestedZones}.`
      : `Operational briefing unavailable (AI service error). Overall status: ${crowdState.overallStatus}.`;
  }

  return {
    ...crowdState,
    operationalBriefing,
  };
}
