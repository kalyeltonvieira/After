export type ThemeMode = "light" | "dark" | "system";

export interface UserPreferences {
  theme: ThemeMode;
  notifications: boolean;
  autoAnalysis: boolean;
  weeklySummary: boolean;
  experimentalFeatures: boolean;
  accentColor?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  username: string;
  photoURL?: string;
  bio?: string;
  createdAt: string;
  updatedAt?: string;
  preferences: UserPreferences;
}

export interface Project {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  repository: string;
  branch: string;
  framework: string;
  language: string;
  createdAt: string;
  updatedAt: string;
  githubConnected?: boolean;
  defaultBranch?: string;
  stars?: number;
  openIssues?: number;
  telemetryConnected?: boolean;
  telemetryProvider?: string;
  graphNodes?: GraphNode[];
  graphEdges?: GraphEdge[];
}

export interface ProjectEvent {
  id: string;
  projectId: string;
  event: string;
  actor: string;
  timestamp: string;
  affectedComponents: string[];
  reason: string;
  metadata?: Record<string, any>;
}

export type InsightCategory =
  | "Bug risk"
  | "Security"
  | "Performance"
  | "UX"
  | "Cost"
  | "Dependency"
  | "Architecture"
  | "Opportunity";

export type SeverityLevel = "low" | "medium" | "high" | "critical";
export type ConfidenceLevel = "low" | "medium" | "high";

export interface ProjectInsight {
  id: string;
  projectId: string;
  title: string;
  description: string;
  category: InsightCategory;
  evidence: string;
  impact: SeverityLevel;
  confidence: ConfidenceLevel;
  affectedComponents: string[];
  affectedFiles?: string[];
  suggestedAction: string;
  createdAt: string;
}

export type ExperimentStatus = "draft" | "running" | "completed" | "cancelled";

export interface ProjectExperiment {
  id: string;
  projectId: string;
  title: string;
  hypothesis: string;
  control: string;
  variant: string;
  metric: string;
  expectedResult: string;
  risk: string;
  duration: string;
  status: ExperimentStatus;
  createdAt: string;
  updatedAt?: string;
}

export type NodeType =
  | "page"
  | "component"
  | "function"
  | "api"
  | "database"
  | "dependency"
  | "user"
  | "config"
  | "experiment";

export interface GraphNode {
  id: string;
  label: string;
  type: NodeType;
  category: string;
  status: "healthy" | "warning" | "updated" | "monitored" | "running";
  changesCount: number;
  filePath?: string;
  symbol?: string;
  line?: number;
  dependency?: string;
  endpoint?: string;
  configKey?: string;
  description?: string;
  lastModified?: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  label?: string;
  evidence?: string;
}

export interface WhyAnalysisResult {
  entityName: string;
  summary: string;
  whyExists: {
    status: "KNOWN" | "INFERRED" | "UNKNOWN";
    explanation: string;
  };
  createdContext: {
    status: "KNOWN" | "INFERRED" | "UNKNOWN";
    explanation: string;
  };
  problemSolved: {
    status: "KNOWN" | "INFERRED" | "UNKNOWN";
    explanation: string;
  };
  dependencies: {
    status: "KNOWN" | "INFERRED" | "UNKNOWN";
    dependsOn: string[];
    dependedOnBy: string[];
  };
  removalRisks: {
    status: "KNOWN" | "INFERRED" | "UNKNOWN";
    riskLevel: SeverityLevel;
    details: string[];
  };
  recommendation?: string;
}

export interface AskAfterResult {
  answer: string;
  citedEvidence: string[];
  suggestedInvestigation: string[];
  confidence: ConfidenceLevel;
}
