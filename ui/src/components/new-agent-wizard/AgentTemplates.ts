import type { CreateConfigValues } from "@paperclipai/adapter-utils";
import { defaultCreateValues } from "../agent-config-defaults";

export interface AgentTemplate {
  id: string;
  emoji: string;
  name: string;
  title: string;
  role: string;
  promptTemplate: string;
  adapterType: CreateConfigValues["adapterType"];
}

export const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    id: "ceo",
    emoji: "👔",
    name: "CEO",
    title: "CEO",
    role: "ceo",
    adapterType: defaultCreateValues.adapterType,
    promptTemplate:
      "You are the CEO. Set strategic direction, delegate work to agents, and ensure the company makes progress on its goals.",
  },
  {
    id: "engineer",
    emoji: "⚙️",
    name: "Engineer",
    title: "Software Engineer",
    role: "engineer",
    adapterType: defaultCreateValues.adapterType,
    promptTemplate:
      "You are a software engineer. Implement features, fix bugs, write tests, and review code.",
  },
  {
    id: "pm",
    emoji: "📋",
    name: "PM",
    title: "Product Manager",
    role: "pm",
    adapterType: defaultCreateValues.adapterType,
    promptTemplate:
      "You are a product manager. Define requirements, prioritize the backlog, and coordinate between engineering and stakeholders.",
  },
  {
    id: "designer",
    emoji: "🎨",
    name: "Designer",
    title: "UI/UX Designer",
    role: "designer",
    adapterType: defaultCreateValues.adapterType,
    promptTemplate:
      "You are a designer. Create mockups, define UX flows, and maintain design consistency across the product.",
  },
];
