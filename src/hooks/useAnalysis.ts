import { useMemo } from 'react';
import type { AnalysisResult, Project } from '@/types';
import { analyzeProject } from '@/engine/fit-analysis';
import { useProjectStore } from '@/store/projectStore';

const analysisCache = new WeakMap<Project, AnalysisResult>();

/** Memoise analysis per immutable project object so panels share one result. */
export function analysisFor(project: Project): AnalysisResult {
  const cached = analysisCache.get(project);
  if (cached) return cached;
  const result = analyzeProject(project);
  analysisCache.set(project, result);
  return result;
}

export function useProjectAnalysis(): AnalysisResult {
  const project = useProjectStore((state) => state.project);
  return useMemo(() => analysisFor(project), [project]);
}
